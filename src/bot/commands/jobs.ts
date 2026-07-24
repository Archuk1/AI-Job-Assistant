import { Markup } from 'telegraf';
import { BotContext } from '../context';
import { getUserWithProfile } from '../../services/user/userService';
import { ensureJobAnalyzed, listJobsForUser } from '../../services/job/jobService';
import { formatJobMessage } from '../formatJob';

const PAGE_SIZE = 5;
const PAGE_WINDOW = 5;

type ActionContext = BotContext & { match: RegExpExecArray };

interface JobsSession {
  jobsMessageIds?: number[];
}

function buildPaginationKeyboard(page: number, totalPages: number) {
  if (totalPages <= 1) {
    return undefined;
  }

  let start = Math.max(1, page - Math.floor(PAGE_WINDOW / 2));
  const end = Math.min(totalPages, start + PAGE_WINDOW - 1);
  start = Math.max(1, end - PAGE_WINDOW + 1);

  const buttons = [];
  for (let p = start; p <= end; p++) {
    const label = p === page ? `· ${p} ·` : `${p}`;
    buttons.push(Markup.button.callback(label, `jobs:page:${p}`));
  }

  return Markup.inlineKeyboard([buttons]);
}

async function clearPreviousPage(ctx: BotContext) {
  const session = ctx.session as JobsSession;
  for (const messageId of session.jobsMessageIds ?? []) {
    try {
      await ctx.deleteMessage(messageId);
    } catch {
      // Already gone, or too old for Telegram to allow deleting — safe to ignore.
    }
  }
  session.jobsMessageIds = [];
}

async function sendJobsPage(ctx: BotContext, userId: number, page: number) {
  await clearPreviousPage(ctx);

  const offset = (page - 1) * PAGE_SIZE;
  const { jobs, total } = await listJobsForUser(userId, PAGE_SIZE, offset);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const session = ctx.session as JobsSession;
  const messageIds: number[] = [];

  if (jobs.length === 0) {
    const message = await ctx.reply(
      page === 1
        ? 'Поки що вакансій не знайдено. Спробуй трохи пізніше — вони підвантажуються автоматично.'
        : 'Більше вакансій немає.',
    );
    session.jobsMessageIds = [message.message_id];
    return;
  }

  for (const job of jobs) {
    const analyzed = await ensureJobAnalyzed(job.id);
    const message = await ctx.reply(
      formatJobMessage(analyzed),
      Markup.inlineKeyboard([
        Markup.button.callback('🎯 Відповідність', `match:${job.id}`),
        Markup.button.callback('✉️ Лист', `cover:${job.id}`),
        Markup.button.callback('❓ Питання', `ask:${job.id}`),
      ]),
    );
    messageIds.push(message.message_id);
  }

  const paginationMessage = await ctx.reply(
    `Сторінка ${page} з ${totalPages}`,
    buildPaginationKeyboard(page, totalPages),
  );
  messageIds.push(paginationMessage.message_id);

  session.jobsMessageIds = messageIds;
}

export async function jobsCommand(ctx: BotContext) {
  if (!ctx.from) return;

  const user = await getUserWithProfile(ctx.from.id);
  if (!user) {
    await ctx.reply('Спершу напиши /start');
    return;
  }

  await sendJobsPage(ctx, user.id, 1);
}

export async function jobsPageAction(ctx: ActionContext) {
  const page = Number(ctx.match[1]);
  await ctx.answerCbQuery();
  if (!ctx.from) return;

  const user = await getUserWithProfile(ctx.from.id);
  if (!user) return;

  await sendJobsPage(ctx, user.id, page);
}
