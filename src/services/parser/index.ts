import { NormalizedJob } from '../../types/job';
import { JobParser } from './types';
import { douParser } from './adapters/dou';
import { remoteOkParser } from './adapters/remoteok';
import { logger } from '../../utils/logger';

export const parsers: JobParser[] = [remoteOkParser, douParser];

export async function fetchAllJobs(): Promise<NormalizedJob[]> {
  const results = await Promise.allSettled(parsers.map((parser) => parser.fetchJobs()));

  const jobs: NormalizedJob[] = [];
  results.forEach((result, index) => {
    const parser = parsers[index];
    if (result.status === 'fulfilled') {
      jobs.push(...result.value);
    } else {
      logger.error({ err: result.reason, source: parser.source }, 'Parser failed');
    }
  });

  return jobs;
}
