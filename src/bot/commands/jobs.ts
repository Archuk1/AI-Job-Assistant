import { Markup } from 'telegraf';
import { BotContext } from '../context';
import { getUserWithProfile } from '../../services/user/userService';
import { ensureJobAnalyzed, listJobsForUser } from '../../services/job/jobService';
import { formatJobMessage } from '../formatJob';

export async function jobsCommand(ctx: BotContext) {
  if (!ctx.from) return;

  const user = await getUserWithProfile(ctx.from.id);
  if (!user) {
    await ctx.reply('Спершу напиши /start');
    return;
  }

  const jobs = await listJobsForUser(user.id, 5);
  if (jobs.length === 0) {
    await ctx.reply('Поки що вакансій не знайдено. Спробуй трохи пізніше — вони підвантажуються автоматично.');
    return;
  }

  for (const job of jobs) {
    const analyzed = await ensureJobAnalyzed(job.id);
    await ctx.reply(
      formatJobMessage(analyzed),
      Markup.inlineKeyboard([
        Markup.button.callback('🎯 Відповідність', `match:${job.id}`),
        Markup.button.callback('✉️ Лист', `cover:${job.id}`),
        Markup.button.callback('❓ Питання', `ask:${job.id}`),
      ]),
    );
  }
}
