import { fetchAllJobs } from '../services/parser';
import { logger } from '../utils/logger';

async function main() {
  const jobs = await fetchAllJobs();

  const bySource = new Map<string, number>();
  for (const job of jobs) {
    bySource.set(job.source, (bySource.get(job.source) ?? 0) + 1);
  }

  logger.info(Object.fromEntries(bySource), 'Jobs fetched per source');
  logger.info(`Total: ${jobs.length}`);
  logger.info(jobs.slice(0, 3), 'Sample jobs');
}

main().catch((err) => {
  logger.error(err, 'testParsers script failed');
  process.exit(1);
});
