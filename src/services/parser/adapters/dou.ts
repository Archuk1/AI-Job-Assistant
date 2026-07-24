import * as cheerio from 'cheerio';
import { JobSource, WorkFormat } from '../../../generated/prisma/enums';
import { NormalizedJob } from '../../../types/job';
import { JobParser } from '../types';
import { parserHttp } from '../http';
import { parseUkrainianDate } from '../ukrainianDate';
import { extractSkillsFromText } from '../skillExtraction';
import { detectLevelFromText } from '../levelDetection';
import { logger } from '../../../utils/logger';

const DOU_VACANCIES_URL = 'https://jobs.dou.ua/vacancies/';

const DEFAULT_CATEGORIES = [
  'Node.js',
  'Front End',
  'Python',
  'Java',
  'PHP',
  '.NET',
  'Golang',
  'QA',
  'DevOps',
];

function extractExternalId(url: string): string | undefined {
  const match = url.match(/\/vacancies\/(\d+)/);
  return match?.[1];
}

function detectWorkFormat(citiesText: string): WorkFormat | undefined {
  const text = citiesText.toLowerCase();
  const remoteWord = 'віддалено';
  const isRemote = text.includes(remoteWord);
  if (!isRemote) {
    return text.trim() === '' ? undefined : WorkFormat.OFFICE;
  }
  const hasOnsiteCity = text.replace(remoteWord, '').replace(/,/g, '').trim() !== '';
  return hasOnsiteCity ? WorkFormat.HYBRID : WorkFormat.REMOTE;
}

function parseCategoryPage(html: string, category: string): NormalizedJob[] {
  const $ = cheerio.load(html);
  const jobs: NormalizedJob[] = [];

  $('li.l-vacancy').each((_, el) => {
    const titleLink = $(el).find('.title a.vt');
    const url = titleLink.attr('href');
    const title = titleLink.text().trim();
    const company = $(el).find('.title a.company').text().replace(/\s+/g, ' ').trim();
    const citiesText = $(el).find('.cities').text().replace(/\s+/g, ' ').trim();
    const dateText = $(el).find('.date').text().trim();
    const description = $(el).find('.sh-info').text().trim();

    if (!url || !title || !company) {
      return;
    }

    const externalId = extractExternalId(url);
    if (!externalId) {
      return;
    }

    jobs.push({
      source: JobSource.DOU,
      externalId,
      title,
      company,
      url,
      description,
      location: citiesText || undefined,
      workFormat: detectWorkFormat(citiesText),
      detectedLevel: detectLevelFromText(title),
      publishedAt: parseUkrainianDate(dateText),
      tags: Array.from(new Set([category, ...extractSkillsFromText(`${title} ${description}`)])),
    });
  });

  return jobs;
}

async function fetchCategory(category: string): Promise<NormalizedJob[]> {
  const { data } = await parserHttp.get<string>(DOU_VACANCIES_URL, {
    params: { category },
  });
  return parseCategoryPage(data, category);
}

export const douParser: JobParser = {
  source: JobSource.DOU,

  async fetchJobs(): Promise<NormalizedJob[]> {
    const byExternalId = new Map<string, NormalizedJob>();

    for (const category of DEFAULT_CATEGORIES) {
      const jobs = await fetchCategory(category);
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
    logger.info(`DOU: fetched ${jobs.length} jobs across ${DEFAULT_CATEGORIES.length} categories`);
    return jobs;
  },
};
