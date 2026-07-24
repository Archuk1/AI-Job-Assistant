import { Scenes, session, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { BotContext } from './context';
import { profileScene } from './scenes/profileWizard';
import { startCommand } from './commands/start';
import { profileCommand, profileEditAction } from './commands/profile';
import { jobsCommand, jobsPageAction } from './commands/jobs';
import { askAction, coverLetterAction, handleFreeTextQuestion, matchAction } from './commands/ai';

export const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);

const stage = new Scenes.Stage<BotContext>([profileScene]);

bot.use(session());
bot.use(stage.middleware());

bot.command('start', startCommand);
bot.command('profile', profileCommand);
bot.command('jobs', jobsCommand);
bot.action('profile:edit', profileEditAction);
bot.action(/match:(\d+)/, matchAction);
bot.action(/cover:(\d+)/, coverLetterAction);
bot.action(/ask:(\d+)/, askAction);
bot.action(/jobs:page:(\d+)/, jobsPageAction);
bot.on(message('text'), (ctx) => handleFreeTextQuestion(ctx, ctx.message.text));

bot.catch((err, ctx) => {
  logger.error({ err, updateType: ctx.updateType }, 'Unhandled bot error');
});
