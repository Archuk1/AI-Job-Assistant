import { BotContext } from '../context';
import { prisma } from '../../db/prisma';
import { getUserWithProfile } from '../../services/user/userService';
import { analyzeMatch, answerJobQuestion, generateCoverLetter } from '../../services/ai/aiService';
import { englishLabel, levelLabel, workFormatLabel } from '../keyboards';
import { logger } from '../../utils/logger';

type ActionContext = BotContext & { match: RegExpExecArray };

async function getJobOrReply(ctx: BotContext, jobId: number) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    await ctx.reply('Вакансію не знайдено — можливо, її вже прибрали.');
    return null;
  }
  return job;
}

export async function matchAction(ctx: ActionContext) {
  const jobId = Number(ctx.match[1]);
  await ctx.answerCbQuery();
  if (!ctx.from) return;

  const user = await getUserWithProfile(ctx.from.id);
  if (!user?.profile) {
    await ctx.reply('Спершу створи профіль через /start.');
    return;
  }

  const job = await getJobOrReply(ctx, jobId);
  if (!job) return;

  await ctx.reply('Аналізую відповідність, зачекай...');
  try {
    const result = await analyzeMatch(job, {
      level: levelLabel(user.profile.level),
      workFormats: user.profile.workFormats.map(workFormatLabel),
      englishLevel: englishLabel(user.profile.englishLevel),
      skills: user.skills.map((s) => s.skill.name),
    });

    const lines = [
      `🎯 Відповідність: ${result.matchPercent}%`,
      '',
      '✅ Сильні сторони:',
      ...result.strengths.map((s) => `• ${s}`),
      '',
      '⚠️ Чого бракує:',
      ...result.gaps.map((g) => `• ${g}`),
      '',
      `💡 ${result.recommendation}`,
    ];
    await ctx.reply(lines.join('\n'));
  } catch (err) {
    logger.error(err, 'analyzeMatch failed');
    await ctx.reply('Не вдалося проаналізувати відповідність. Спробуй пізніше.');
  }
}

export async function coverLetterAction(ctx: ActionContext) {
  const jobId = Number(ctx.match[1]);
  await ctx.answerCbQuery();
  if (!ctx.from) return;

  const user = await getUserWithProfile(ctx.from.id);
  if (!user?.profile) {
    await ctx.reply('Спершу створи профіль через /start.');
    return;
  }

  const job = await getJobOrReply(ctx, jobId);
  if (!job) return;

  await ctx.reply('Генерую супровідний лист, зачекай...');
  try {
    const letter = await generateCoverLetter(job, {
      level: levelLabel(user.profile.level),
      skills: user.skills.map((s) => s.skill.name),
    });
    await ctx.reply(letter);
  } catch (err) {
    logger.error(err, 'generateCoverLetter failed');
    await ctx.reply('Не вдалося згенерувати лист. Спробуй пізніше.');
  }
}

export async function askAction(ctx: ActionContext) {
  const jobId = Number(ctx.match[1]);
  await ctx.answerCbQuery();

  const job = await getJobOrReply(ctx, jobId);
  if (!job) return;

  (ctx.session as Record<string, unknown>).activeJobId = jobId;
  await ctx.reply(`Постав своє питання про вакансію "${job.title}" текстом.`);
}

export async function handleFreeTextQuestion(ctx: BotContext, text: string) {
  const session = ctx.session as { activeJobId?: number };
  if (!session.activeJobId) {
    return;
  }

  const job = await getJobOrReply(ctx, session.activeJobId);
  if (!job) {
    session.activeJobId = undefined;
    return;
  }

  await ctx.reply('Думаю над відповіддю...');
  try {
    const answer = await answerJobQuestion(job, text);
    await ctx.reply(answer);
  } catch (err) {
    logger.error(err, 'answerJobQuestion failed');
    await ctx.reply('Не вдалося отримати відповідь. Спробуй пізніше.');
  }
}
