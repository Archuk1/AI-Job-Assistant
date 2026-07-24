import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { refreshJobsAndNotify } from './refreshJobs';

const INITIAL_RUN_DELAY_MS = 5_000;

function runRefresh(trigger: string) {
  refreshJobsAndNotify().catch((err) => logger.error(err, `Job refresh failed (${trigger})`));
}

export function startScheduler() {
  if (!cron.validate(env.CRON_SCHEDULE)) {
    logger.error({ schedule: env.CRON_SCHEDULE }, 'Invalid CRON_SCHEDULE, scheduler not started');
    return;
  }

  cron.schedule(env.CRON_SCHEDULE, () => runRefresh('cron'));
  logger.info({ schedule: env.CRON_SCHEDULE }, 'Job refresh scheduler started');

  setTimeout(() => runRefresh('startup'), INITIAL_RUN_DELAY_MS);
}
