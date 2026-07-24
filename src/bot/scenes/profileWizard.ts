import { Scenes } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext } from '../context';
import { EnglishLevel, ExperienceLevel, WorkFormat } from '../../generated/prisma/enums';
import {
  englishKeyboard,
  englishLabel,
  levelKeyboard,
  levelLabel,
  skillsKeyboard,
  workFormatKeyboard,
} from '../keyboards';
import { saveProfile, setUserSkills, upsertUserFromTelegram } from '../../services/user/userService';

interface ProfileDraft {
  step?: 'country';
  level?: ExperienceLevel;
  workFormats: WorkFormat[];
  country?: string;
  englishLevel?: EnglishLevel;
  skills: string[];
}

function draft(ctx: BotContext): ProfileDraft {
  const session = ctx.scene.session as { draft?: ProfileDraft };
  if (!session.draft) {
    session.draft = { workFormats: [], skills: [] };
  }
  return session.draft;
}

export const profileScene = new Scenes.BaseScene<BotContext>('profile-wizard');

profileScene.enter(async (ctx) => {
  const session = ctx.scene.session as { draft?: ProfileDraft };
  session.draft = { workFormats: [], skills: [] };
  await ctx.reply('Який у тебе рівень?', levelKeyboard());
});

profileScene.action(/level:(.+)/, async (ctx) => {
  const level = ctx.match[1] as ExperienceLevel;
  draft(ctx).level = level;
  await ctx.answerCbQuery();
  await ctx.editMessageText(`Рівень: ${levelLabel(level)}`);
  await ctx.reply('Обери формати роботи (можна декілька), потім тисни «Далі ➡️»:', workFormatKeyboard([]));
});

profileScene.action(/workformat:(.+)/, async (ctx) => {
  const value = ctx.match[1];
  const d = draft(ctx);

  if (value === 'done') {
    if (d.workFormats.length === 0) {
      await ctx.answerCbQuery('Обери хоча б один формат', { show_alert: true });
      return;
    }
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined);
    d.step = 'country';
    await ctx.reply('У якій країні/місті шукаєш роботу? Напиши текстом.');
    return;
  }

  const format = value as WorkFormat;
  d.workFormats = d.workFormats.includes(format)
    ? d.workFormats.filter((f) => f !== format)
    : [...d.workFormats, format];

  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(workFormatKeyboard(d.workFormats).reply_markup);
});

profileScene.on(message('text'), async (ctx) => {
  const d = draft(ctx);
  if (d.step !== 'country') {
    return;
  }
  d.country = ctx.message.text.trim();
  d.step = undefined;
  await ctx.reply('Який рівень англійської?', englishKeyboard());
});

profileScene.action(/english:(.+)/, async (ctx) => {
  const level = ctx.match[1] as EnglishLevel;
  draft(ctx).englishLevel = level;
  await ctx.answerCbQuery();
  await ctx.editMessageText(`Англійська: ${englishLabel(level)}`);
  await ctx.reply('Познач свої навички (можна декілька), потім тисни «Готово ✅»:', skillsKeyboard([]));
});

profileScene.action(/skill:(.+)/, async (ctx) => {
  const value = ctx.match[1];
  const d = draft(ctx);

  if (value === 'done') {
    if (!ctx.from || !d.level || !d.englishLevel) {
      await ctx.answerCbQuery();
      await ctx.reply('Щось пішло не так, почни спочатку через /start.');
      return ctx.scene.leave();
    }

    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined);

    const user = await upsertUserFromTelegram(ctx.from);
    await saveProfile(user.id, {
      level: d.level,
      workFormats: d.workFormats,
      country: d.country,
      englishLevel: d.englishLevel,
    });
    await setUserSkills(user.id, d.skills);

    await ctx.reply('Профіль збережено! /profile — переглянути, /jobs — побачити вакансії.');
    return ctx.scene.leave();
  }

  d.skills = d.skills.includes(value) ? d.skills.filter((s) => s !== value) : [...d.skills, value];

  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup(skillsKeyboard(d.skills).reply_markup);
});
