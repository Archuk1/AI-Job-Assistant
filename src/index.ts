import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { bot } from './bot/bot';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

bot
  .launch()
  .then(() => logger.info('Telegram bot started (long polling)'))
  .catch((err) => logger.error(err, 'Failed to start Telegram bot'));

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down`);
  bot.stop(signal);
  server.close();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
