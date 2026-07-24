import { BotContext } from '../context';
import { getUserWithProfile, upsertUserFromTelegram } from '../../services/user/userService';

export async function startCommand(ctx: BotContext) {
  if (!ctx.from) return;

  await upsertUserFromTelegram(ctx.from);
  const user = await getUserWithProfile(ctx.from.id);

  if (!user?.profile) {
    await ctx.reply(
      'Привіт! Я AI Job Assistant — допоможу знайти релевантні вакансії.\n\nДавай спершу створимо твій профіль.',
    );
    return ctx.scene.enter('profile-wizard');
  }

  await ctx.reply(
    'З поверненням! /profile — переглянути профіль, /jobs — побачити вакансії.',
  );
}
