import { BotContext } from '../context';
import { getUserWithProfile } from '../../services/user/userService';
import { listJobsForUser, upsertJobs } from '../../services/job/jobService';
import { fetchAllJobs } from '../../services/parser';
import { logger } from '../../utils/logger';

function formatJob(job: {
  title: string;
  company: string;
  url: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}): string {
  const salary =
    job.salaryMin || job.salaryMax
      ? `💰 ${job.salaryMin ?? '?'}–${job.salaryMax ?? '?'} ${job.salaryCurrency ?? ''}\n`
      : '';
  const location = job.location ? `📍 ${job.location}\n` : '';

  return `${job.title} — ${job.company}\n${salary}${location}${job.url}`;
}

export async function jobsCommand(ctx: BotContext) {
  if (!ctx.from) return;

  const user = await getUserWithProfile(ctx.from.id);
  if (!user) {
    await ctx.reply('Спершу напиши /start');
    return;
  }

  await ctx.reply('Шукаю свіжі вакансії, зачекай хвилинку...');

  try {
    const fresh = await fetchAllJobs();
    await upsertJobs(fresh);
  } catch (err) {
    logger.error(err, 'Failed to refresh jobs before /jobs command');
  }

  const jobs = await listJobsForUser(user.id, 5);
  if (jobs.length === 0) {
    await ctx.reply('Поки що вакансій не знайдено. Спробуй пізніше.');
    return;
  }

  for (const job of jobs) {
    await ctx.reply(formatJob(job));
  }
}
