import { Markup } from 'telegraf';
import { EnglishLevel, ExperienceLevel, Profession, WorkFormat } from '../generated/prisma/enums';
import { CURATED_SKILLS } from '../config/skills';
import { PROFESSIONS } from '../config/professions';

const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  JUNIOR: 'Junior',
  MIDDLE: 'Middle',
  SENIOR: 'Senior',
};

const WORK_FORMAT_LABELS: Record<WorkFormat, string> = {
  REMOTE: 'Віддалено',
  OFFICE: 'В офісі',
  HYBRID: 'Гібрид',
};

const ENGLISH_LABELS: Record<EnglishLevel, string> = {
  NONE: 'Не володію',
  BASIC: 'Basic (A1)',
  PRE_INTERMEDIATE: 'Pre-Intermediate (A2)',
  INTERMEDIATE: 'Intermediate (B1)',
  UPPER_INTERMEDIATE: 'Upper-Intermediate (B2)',
  ADVANCED: 'Advanced (C1)',
  FLUENT: 'Fluent (C2)',
};

export function professionKeyboard() {
  return Markup.inlineKeyboard(
    PROFESSIONS.map((p) => Markup.button.callback(p.label, `profession:${p.id}`)),
    { columns: 1 },
  );
}

export function professionLabel(profession: Profession): string {
  return PROFESSIONS.find((p) => p.id === profession)?.label ?? profession;
}

export function levelKeyboard() {
  return Markup.inlineKeyboard(
    Object.values(ExperienceLevel).map((level) =>
      Markup.button.callback(LEVEL_LABELS[level], `level:${level}`),
    ),
    { columns: 3 },
  );
}

export function workFormatKeyboard(selected: WorkFormat[]) {
  const buttons = Object.values(WorkFormat).map((format) => {
    const mark = selected.includes(format) ? '✅ ' : '';
    return Markup.button.callback(`${mark}${WORK_FORMAT_LABELS[format]}`, `workformat:${format}`);
  });
  return Markup.inlineKeyboard(
    [...buttons, Markup.button.callback('Далі ➡️', 'workformat:done')],
    { columns: 3 },
  );
}

export function englishKeyboard() {
  return Markup.inlineKeyboard(
    Object.values(EnglishLevel).map((level) =>
      Markup.button.callback(ENGLISH_LABELS[level], `english:${level}`),
    ),
    { columns: 2 },
  );
}

export function skillsKeyboard(selected: string[]) {
  const buttons = CURATED_SKILLS.map((skill) => {
    const mark = selected.includes(skill) ? '✅ ' : '';
    return Markup.button.callback(`${mark}${skill}`, `skill:${skill}`);
  });
  return Markup.inlineKeyboard(
    [...buttons, Markup.button.callback('Готово ✅', 'skill:done')],
    { columns: 2 },
  );
}

export function levelLabel(level: ExperienceLevel): string {
  return LEVEL_LABELS[level];
}

export function workFormatLabel(format: WorkFormat): string {
  return WORK_FORMAT_LABELS[format];
}

export function englishLabel(level: EnglishLevel): string {
  return ENGLISH_LABELS[level];
}
