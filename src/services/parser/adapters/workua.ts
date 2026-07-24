import * as cheerio from 'cheerio';
import { JobSource, WorkFormat } from '../../../generated/prisma/enums';
import { NormalizedJob } from '../../../types/job';
import { JobParser } from '../types';
import { parserHttp } from '../http';
import { parseUkrainianDate } from '../ukrainianDate';
import { extractSkillsFromText } from '../skillExtraction';
import { detectLevelFromText } from '../levelDetection';
import { logger } from '../../../utils/logger';

const WORKUA_ORIGIN = 'https://www.work.ua';
const IT_CATEGORY_ID = 1;

// work.ua has no "all IT vacancies" listing (the base /jobs-it/ page only server-renders
// a small promoted subset) — real coverage requires searching per keyword, same as DOU's
// category pages. `category=1` pins results to the IT sphere so ambiguous words (e.g.
// "docker" also means a port/warehouse worker) don't leak in unrelated vacancies.
const DEFAULT_KEYWORDS = [
  'javascript',
  'typescript',
  'node-js',
  'react',
  'python',
  'java',
  'php',
  'net',
  'golang',
  'docker',
  'qa',
  'devops',
];

function extractExternalId(href: string): string | undefined {
  const match = href.match(/\/jobs\/(\d+)/);
  return match?.[1];
}

function parsePublishedAt(titleAttr: string): Date | undefined {
  const match = titleAttr.match(/вакансія від (.+)$/u);
  return match ? parseUkrainianDate(match[1]) : undefined;
}

function parseSalary(raw: string): { min?: number; max?: number } {
  const digitsAndDashes = raw.replace(/[^\d–-]/g, '');
  const parts = digitsAndDashes
    .split(/[–-]/)
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 0);

  if (parts.length === 0) return {};
  if (parts.length === 1) return { min: parts[0], max: parts[0] };
  return { min: parts[0], max: parts[1] };
}

function parseListPage(html: string, keyword: string): NormalizedJob[] {
  const $ = cheerio.load(html);
  const jobs: NormalizedJob[] = [];

  $('.card.job-link').each((_, el) => {
    const card = $(el);
    const titleLink = card.find('h2 a[href^="/jobs/"]').first();
    const href = titleLink.attr('href');
    const title = titleLink.text().trim();

    if (!href || !title) {
      return;
    }

    const externalId = extractExternalId(href);
    if (!externalId) {
      return;
    }

    const companyBlock = card
      .find('.text-indent')
      .filter((_i, block) => $(block).find('.glyphicon-company').length > 0)
      .first();
    const company = companyBlock.find('.strong-600').first().text().trim();

    const salaryBlock = card
      .find('.text-indent')
      .filter((_i, block) => $(block).find('.glyphicon-hryvnia-fill').length > 0)
      .first();
    const salaryText = salaryBlock.find('.strong-600').first().text().trim();
    const { min: salaryMin, max: salaryMax } = parseSalary(salaryText);

    const companyRawText = companyBlock.text().replace(/\s+/g, ' ').trim();
    const isRemote = companyRawText.includes('Дистанційно');
    const location = companyRawText
      .replace(company, '')
      .replace('Дистанційно', '')
      .replace(/\d+([.,]\d+)?\s*км\s*від\s*центру/iu, '')
      .replace(/,\s*Агенція/u, '')
      .replace(/[,\s]+/g, ' ')
      .trim();

    const description = card.find('p.ellipsis').first().text().replace(/\s+/g, ' ').trim();
    const publishedAt = parsePublishedAt(titleLink.attr('title') ?? '');

    jobs.push({
      source: JobSource.WORK_UA,
      externalId,
      title,
      company: company || 'Не вказано',
      url: `${WORKUA_ORIGIN}${href}`,
      description,
      location: location || undefined,
      workFormat: isRemote ? WorkFormat.REMOTE : WorkFormat.OFFICE,
      detectedLevel: detectLevelFromText(title),
      salaryMin,
      salaryMax,
      salaryCurrency: salaryMin || salaryMax ? 'UAH' : undefined,
      publishedAt,
      tags: Array.from(new Set([keyword, ...extractSkillsFromText(`${title} ${description}`)])),
    });
  });

  return jobs;
}

async function fetchKeyword(keyword: string): Promise<NormalizedJob[]> {
  const { data } = await parserHttp.get<string>(`${WORKUA_ORIGIN}/jobs-${keyword}/`, {
    params: { category: IT_CATEGORY_ID },
  });
  return parseListPage(data, keyword);
}

export const workUaParser: JobParser = {
  source: JobSource.WORK_UA,

  async fetchJobs(): Promise<NormalizedJob[]> {
    const byExternalId = new Map<string, NormalizedJob>();

    for (const keyword of DEFAULT_KEYWORDS) {
      const jobs = await fetchKeyword(keyword);
      for (const job of jobs) {
        const existing = byExternalId.get(job.externalId);
        if (existing) {
          existing.tags = Array.from(new Set([...existing.tags, ...job.tags]));
        } else {
          byExternalId.set(job.externalId, job);
        }
      }
    }

    const jobs = Array.from(byExternalId.values());
    logger.info(`Work.ua: fetched ${jobs.length} jobs across ${DEFAULT_KEYWORDS.length} keywords`);
    return jobs;
  },
};
