import { fetchAllJobs } from '../services/parser';
import { cleanupStaleJobs, upsertJobs } from '../services/job/jobService';
import { notifyUsersAboutNewJobs } from '../services/notification/notificationService';
import { logger } from '../utils/logger';

export async function refreshJobsAndNotify() {
  const jobs = await fetchAllJobs();
  const { created, updated, createdJobs } = await upsertJobs(jobs);

  logger.info({ created, updated }, 'Scheduled job refresh complete');

  if (createdJobs.length > 0) {
    await notifyUsersAboutNewJobs(createdJobs.map((job) => job.id));
  }

  await cleanupStaleJobs();
}
