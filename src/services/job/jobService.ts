import { prisma } from '../../db/prisma';
import { NormalizedJob } from '../../types/job';
import { findOrCreateSkills } from '../skill/skillService';
import { logger } from '../../utils/logger';
import { mapWithConcurrency } from '../../utils/concurrency';

export async function upsertJob(normalized: NormalizedJob): Promise<{ created: boolean }> {
  const job = await prisma.job.upsert({
    where: { source_externalId: { source: normalized.source, externalId: normalized.externalId } },
    update: {
      title: normalized.title,
      company: normalized.company,
      url: normalized.url,
      description: normalized.description,
      location: normalized.location,
      workFormat: normalized.workFormat,
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

  return { created: job.createdAt.getTime() === job.updatedAt.getTime() };
}

export async function upsertJobs(jobs: NormalizedJob[]) {
  const results = await mapWithConcurrency(jobs, 8, upsertJob);

  const created = results.filter((r) => r.created).length;
  const updated = results.length - created;

  logger.info({ created, updated, total: jobs.length }, 'Jobs upserted into DB');
  return { created, updated };
}

export async function listLatestJobs(limit = 10) {
  return prisma.job.findMany({
    orderBy: { publishedAt: 'desc' },
    take: limit,
    include: { skills: { include: { skill: true } } },
  });
}

export async function listJobsForUser(userId: number, limit = 10) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const userSkills = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: true },
  });
  const skillNames = userSkills.map((us) => us.skill.name.toLowerCase());

  if (!profile || skillNames.length === 0) {
    return listLatestJobs(limit);
  }

  const matched = await prisma.job.findMany({
    where: {
      workFormat: profile.workFormats.length > 0 ? { in: profile.workFormats } : undefined,
      skills: { some: { skill: { name: { in: skillNames, mode: 'insensitive' } } } },
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    include: { skills: { include: { skill: true } } },
  });

  return matched.length > 0 ? matched : listLatestJobs(limit);
}
