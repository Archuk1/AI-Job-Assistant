import { prisma } from '../../db/prisma';
import { NormalizedJob } from '../../types/job';
import { findOrCreateSkills } from '../skill/skillService';
import { analyzeJob } from '../ai/aiService';
import { getProfessionDef } from '../../config/professions';
import { logger } from '../../utils/logger';
import { mapWithConcurrency } from '../../utils/concurrency';

type Job = Awaited<ReturnType<typeof prisma.job.upsert>>;

export async function upsertJob(normalized: NormalizedJob): Promise<{ job: Job; created: boolean }> {
  const job = await prisma.job.upsert({
    where: { source_externalId: { source: normalized.source, externalId: normalized.externalId } },
    update: {
      title: normalized.title,
      company: normalized.company,
      url: normalized.url,
      description: normalized.description,
      location: normalized.location,
      workFormat: normalized.workFormat,
      detectedLevel: normalized.detectedLevel,
      salaryMin: normalized.salaryMin,
      salaryMax: normalized.salaryMax,
      salaryCurrency: normalized.salaryCurrency,
      publishedAt: normalized.publishedAt,
    },
    create: {
      source: normalized.source,
      externalId: normalized.externalId,
      title: normalized.title,
      company: normalized.company,
      url: normalized.url,
      description: normalized.description,
      location: normalized.location,
      workFormat: normalized.workFormat,
      detectedLevel: normalized.detectedLevel,
      salaryMin: normalized.salaryMin,
      salaryMax: normalized.salaryMax,
      salaryCurrency: normalized.salaryCurrency,
      publishedAt: normalized.publishedAt,
    },
  });

  if (normalized.tags.length > 0) {
    const skills = await findOrCreateSkills(normalized.tags);
    await prisma.$transaction([
      prisma.jobSkill.deleteMany({ where: { jobId: job.id } }),
      prisma.jobSkill.createMany({
        data: skills.map((skill) => ({ jobId: job.id, skillId: skill.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  return { job, created: job.createdAt.getTime() === job.updatedAt.getTime() };
}

export async function upsertJobs(jobs: NormalizedJob[]) {
  const results = await mapWithConcurrency(jobs, 8, upsertJob);

  const createdJobs = results.filter((r) => r.created).map((r) => r.job);
  const updated = results.length - createdJobs.length;

  logger.info({ created: createdJobs.length, updated, total: jobs.length }, 'Jobs upserted into DB');
  return { created: createdJobs.length, updated, createdJobs };
}

const STALE_JOB_MAX_AGE_DAYS = 14;

/**
 * Deletes jobs that haven't turned up in a scrape for a while. `updatedAt` doubles as
 * "last seen" here — upsertJob touches it every time a job is re-fetched, so a job that
 * stops appearing in any of our searches (closed, or just aged off the source's own
 * listing) goes stale and eventually gets pruned instead of lingering forever.
 */
export async function cleanupStaleJobs(maxAgeDays = STALE_JOB_MAX_AGE_DAYS) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  const { count } = await prisma.job.deleteMany({ where: { updatedAt: { lt: cutoff } } });
  if (count > 0) {
    logger.info({ count, maxAgeDays }, 'Removed stale jobs not seen in recent scrapes');
  }
  return count;
}

export async function ensureJobAnalyzed(jobId: number): Promise<Job> {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (job.aiAnalyzedAt) {
    return job;
  }

  try {
    const analysis = await analyzeJob({
      title: job.title,
      company: job.company,
      description: job.description,
    });

    return await prisma.job.update({
      where: { id: jobId },
      data: {
        aiSummary: analysis.summary,
        aiRequirements: analysis.requirements,
        aiComplexity: analysis.complexity,
        aiKeySkills: analysis.keySkills,
        aiAnalyzedAt: new Date(),
      },
    });
  } catch (err) {
    logger.error({ err, jobId }, 'Job analysis failed');
    return job;
  }
}

export async function listLatestJobs(limit = 10) {
  return prisma.job.findMany({
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: limit,
    include: { skills: { include: { skill: true } } },
  });
}

/**
 * Interleaves round-robin across source buckets (preserving each bucket's relative
 * order) instead of a flat concat, so a high-volume source can't crowd out the others
 * when many jobs share the same day-only publishedAt and would otherwise tie-break
 * arbitrarily in whichever source happens to sort first.
 */
function interleaveBySource<T extends { source: string }>(jobs: T[]): T[] {
  const bySource = new Map<string, T[]>();
  for (const job of jobs) {
    const bucket = bySource.get(job.source);
    if (bucket) {
      bucket.push(job);
    } else {
      bySource.set(job.source, [job]);
    }
  }

  const buckets = Array.from(bySource.values());
  const result: T[] = [];
  let index = 0;
  while (result.length < jobs.length) {
    for (const bucket of buckets) {
      if (index < bucket.length) {
        result.push(bucket[index]);
      }
    }
    index += 1;
  }

  return result;
}

const MATCH_POOL_SIZE = 1000;
const MIN_MATCHING_SKILLS = 2;

export interface JobsPage<T> {
  jobs: T[];
  total: number;
}

export async function listJobsForUser(
  userId: number,
  limit = 10,
  offset = 0,
): Promise<JobsPage<Awaited<ReturnType<typeof listLatestJobs>>[number]>> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const userSkills = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: true },
  });
  const skillNames = userSkills.map((us) => us.skill.name.toLowerCase());

  let ordered: Awaited<ReturnType<typeof listLatestJobs>>;

  if (!profile || skillNames.length === 0) {
    ordered = await listLatestJobs(MATCH_POOL_SIZE);
  } else {
    const pool = await prisma.job.findMany({
      where: {
        workFormat: profile.workFormats.length > 0 ? { in: profile.workFormats } : undefined,
        skills: { some: { skill: { name: { in: skillNames, mode: 'insensitive' } } } },
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: MATCH_POOL_SIZE,
      include: { skills: { include: { skill: true } } },
    });

    // Requiring only a single overlapping skill let through a lot of noise (e.g. a sales
    // role tagged "docker" alongside dozens of unrelated tags). Require at least two
    // matches — but never more than the candidate actually has selected. A level stated
    // in the job title is checked against the profile; jobs with no stated level are
    // left open to everyone.
    const requiredOverlap = Math.min(MIN_MATCHING_SKILLS, skillNames.length);
    const qualified = pool.filter((job) => {
      const overlap = job.skills.filter((js) => skillNames.includes(js.skill.name.toLowerCase()));
      if (overlap.length < requiredOverlap) return false;
      if (job.detectedLevel && job.detectedLevel !== profile.level) return false;
      return true;
    });

    if (qualified.length === 0) {
      ordered = await listLatestJobs(MATCH_POOL_SIZE);
    } else {
      const professionDef = profile.profession ? getProfessionDef(profile.profession) : undefined;
      if (professionDef) {
        const keywords = professionDef.keywords;
        const matchesProfession = (job: (typeof qualified)[number]) => {
          const haystack = `${job.title} ${job.skills.map((s) => s.skill.name).join(' ')}`.toLowerCase();
          return keywords.some((keyword) => haystack.includes(keyword));
        };
        const prioritized = qualified.filter(matchesProfession);
        const rest = qualified.filter((job) => !matchesProfession(job));
        ordered = [...interleaveBySource(prioritized), ...interleaveBySource(rest)];
      } else {
        ordered = interleaveBySource(qualified);
      }
    }
  }

  return {
    jobs: ordered.slice(offset, offset + limit),
    total: ordered.length,
  };
}
