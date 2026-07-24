import { Markup } from 'telegraf';
import { BotContext } from '../context';
import { getUserWithProfile } from '../../services/user/userService';
import { englishLabel, levelLabel, workFormatLabel } from '../keyboards';

export async function profileCommand(ctx: BotContext) {
  if (!ctx.from) return;
  const user = await getUserWithProfile(ctx.from.id);

  if (!user?.profile) {
    await ctx.reply('У тебе ще немає профілю. Створюємо!');
    return ctx.scene.enter('profile-wizard');
  }

  const { profile, skills } = user;
  const lines = [
    `Рівень: ${levelLabel(profile.level)}`,
    `Формат роботи: ${profile.workFormats.map(workFormatLabel).join(', ') || '—'}`,
    `Країна/регіон: ${profile.country ?? '—'}`,
    `Англійська: ${englishLabel(profile.englishLevel)}`,
    `Навички: ${skills.map((s) => s.skill.name).join(', ') || '—'}`,
  ];

  await ctx.reply(
    lines.join('\n'),
    Markup.inlineKeyboard([Markup.button.callback('Редагувати профіль', 'profile:edit')]),
  );
}

export async function profileEditAction(ctx: BotContext) {
  await ctx.answerCbQuery();
  return ctx.scene.enter('profile-wizard');
}
