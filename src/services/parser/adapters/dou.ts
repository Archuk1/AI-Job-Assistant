import * as cheerio from 'cheerio';
import { JobSource, WorkFormat } from '../../../generated/prisma/enums';
import { NormalizedJob } from '../../../types/job';
import { JobParser } from '../types';
import { parserHttp } from '../http';
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

const UKRAINIAN_MONTHS: Record<string, number> = {
  січня: 0,
  лютого: 1,
  березня: 2,
  квітня: 3,
  травня: 4,
  червня: 5,
  липня: 6,
  серпня: 7,
  вересня: 8,
  жовтня: 9,
  листопада: 10,
  грудня: 11,
};

function parseDouDate(text: string): Date | undefined {
  const match = text.trim().match(/^(\d{1,2})\s+(\S+)$/u);
  if (!match) {
    return undefined;
  }

  const day = Number(match[1]);
  const month = UKRAINIAN_MONTHS[match[2].toLowerCase()];
  if (month === undefined) {
    return undefined;
  }

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);

  // If the parsed date lands more than a month in the future, the post is from last year
  // (e.g. scraping a "грудня" listing in January).
  if (candidate.getTime() - now.getTime() > 30 * 24 * 60 * 60 * 1000) {
    year -= 1;
  }

  return new Date(year, month, day);
}

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
      publishedAt: parseDouDate(dateText),
      tags: [category],
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
