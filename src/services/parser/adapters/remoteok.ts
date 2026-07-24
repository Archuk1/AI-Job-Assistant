import * as cheerio from 'cheerio';
import { JobSource, WorkFormat } from '../../../generated/prisma/enums';
import { NormalizedJob } from '../../../types/job';
import { JobParser } from '../types';
import { parserHttp } from '../http';
import { logger } from '../../../utils/logger';

const REMOTEOK_API_URL = 'https://remoteok.com/api';

interface RemoteOkItem {
  id?: string;
  slug?: string;
  position?: string;
  company?: string;
  tags?: string[];
  description?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  salary_min?: number;
  salary_max?: number;
}

function stripHtml(html: string): string {
  return cheerio.load(html).text().trim();
}

function toNormalizedJob(item: RemoteOkItem): NormalizedJob | null {
  if (!item.id || !item.position || !item.company) {
    return null;
  }

  const url = item.url ?? item.apply_url;
  if (!url) {
    return null;
  }

  const salaryMin = item.salary_min && item.salary_min > 0 ? item.salary_min : undefined;
  const salaryMax = item.salary_max && item.salary_max > 0 ? item.salary_max : undefined;
  const publishedAt = item.date ? new Date(item.date) : undefined;

  return {
    source: JobSource.REMOTEOK,
    externalId: item.id,
    title: item.position,
    company: item.company,
    url,
    description: item.description ? stripHtml(item.description) : '',
    location: item.location && item.location.trim() !== '' ? item.location : undefined,
    workFormat: WorkFormat.REMOTE,
    salaryMin,
    salaryMax,
    salaryCurrency: salaryMin || salaryMax ? 'USD' : undefined,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    tags: item.tags ?? [],
  };
}

export const remoteOkParser: JobParser = {
  source: JobSource.REMOTEOK,

  async fetchJobs(): Promise<NormalizedJob[]> {
    const { data } = await parserHttp.get<RemoteOkItem[]>(REMOTEOK_API_URL);

    if (!Array.isArray(data)) {
      logger.warn('RemoteOK API returned unexpected payload shape');
      return [];
    }

    const jobs = data.map(toNormalizedJob).filter((job): job is NormalizedJob => job !== null);

    logger.info(`RemoteOK: fetched ${jobs.length} jobs`);
    return jobs;
  },
};
