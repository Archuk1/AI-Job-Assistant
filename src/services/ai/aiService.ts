import { z } from 'zod';
import { openai } from './openaiClient';
import { env } from '../../config/env';
import { ExperienceLevel } from '../../generated/prisma/enums';
import { logger } from '../../utils/logger';

interface JobContext {
  title: string;
  company: string;
  description: string;
}

interface CandidateProfile {
  level: string;
  workFormats: string[];
  englishLevel: string;
  skills: string[];
}

const LANGUAGE_RULE =
  'Пиши виключно українською мовою, кирилицею. Категорично заборонено вставляти слова, склади чи символи будь-якої іншої мови чи писемності (англійської, китайської, тощо) — єдиний виняток - загальновживані власні назви технологій латиницею (React, Docker, Node.js і подібні).';

async function chatJSON<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  const response = await openai.chat.completions.create({
    model: env.AI_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    logger.error({ err, raw }, 'AI response is not valid JSON');
    throw new Error('AI response is not valid JSON', { cause: err });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues, raw }, 'AI response failed schema validation');
    throw new Error('AI response validation failed');
  }
  return parsed.data;
}

async function chatText(system: string, user: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: env.AI_MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}

const jobAnalysisSchema = z.object({
  summary: z.string(),
  requirements: z.array(z.string()),
  complexity: z.enum([ExperienceLevel.JUNIOR, ExperienceLevel.MIDDLE, ExperienceLevel.SENIOR]),
  keySkills: z.array(z.string()),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

export async function analyzeJob(job: JobContext): Promise<JobAnalysis> {
  return chatJSON(
    `Ти — технічний рекрутер-асистент. Аналізуй вакансії стисло й по суті. ${LANGUAGE_RULE} Відповідай лише у форматі JSON, без пояснень.`,
    `Проаналізуй вакансію і поверни JSON з полями:
- summary: короткий опис вакансії (2-3 речення)
- requirements: масив головних вимог (5-7 пунктів)
- complexity: одне з "JUNIOR", "MIDDLE", "SENIOR" — рівень складності вакансії
- keySkills: масив ключових технологій/навичок (до 10)

Назва: ${job.title}
Компанія: ${job.company}
Опис:
${job.description.slice(0, 4000)}

Нагадування: ${LANGUAGE_RULE}`,
    jobAnalysisSchema,
  );
}

const matchSchema = z.object({
  matchPercent: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendation: z.string(),
});

export type MatchAnalysis = z.infer<typeof matchSchema>;

export async function analyzeMatch(
  job: JobContext,
  profile: CandidateProfile,
): Promise<MatchAnalysis> {
  return chatJSON(
    `Ти — кар'єрний консультант. Оцінюєш відповідність кандидата вакансії чесно й конкретно. ${LANGUAGE_RULE} Відповідай лише у форматі JSON.`,
    `Профіль кандидата:
Рівень: ${profile.level}
Формат роботи: ${profile.workFormats.join(', ') || 'не вказано'}
Англійська: ${profile.englishLevel}
Навички: ${profile.skills.join(', ') || 'не вказано'}

Вакансія:
Назва: ${job.title}
Компанія: ${job.company}
Опис: ${job.description.slice(0, 4000)}

Поверни JSON з полями:
- matchPercent: число від 0 до 100 — наскільки кандидат підходить
- strengths: масив сильних сторін кандидата відносно цієї вакансії
- gaps: масив того, чого кандидату бракує
- recommendation: чи варто подаватися і чому (2-3 речення)

Нагадування: ${LANGUAGE_RULE}`,
    matchSchema,
  );
}

export async function generateCoverLetter(
  job: JobContext,
  profile: Pick<CandidateProfile, 'level' | 'skills'>,
): Promise<string> {
  return chatText(
    `Ти пишеш супровідні листи для кандидатів на IT-вакансії. ${LANGUAGE_RULE}

Стиль: пиши природно, як жива людина, а не як шаблон. Уникай канцеляризмів і кліше на кшталт "широкий спектр навичок", "важливу роль", "інноваційні технології", "хотів би зробити внесок" — заміняй їх конкретикою.

Структура (100-150 слів):
1. Одне речення: яку вакансію хоче кандидат і чому взагалі пише.
2. Основна частина: конкретно, які навички/технології кандидата закривають вимоги вакансії — без переказу опису вакансії словами кандидата.
3. Максимум одне речення про саму компанію — і тільки якщо в описі є щось справді специфічне (галузь, продукт), а не загальні фрази. Не переказуй факти про компанію з опису вакансії розлогим абзацом.
4. Коротке завершення.

Не вигадуй фактів про кандидата (роки досвіду, попередні місця роботи тощо), яких немає в наданих даних, і не став плейсхолдери на кшталт "[X]" — просто оминай ту інформацію, якої немає.`,
    `Напиши супровідний лист для вакансії "${job.title}" у компанії ${job.company}.

Кандидат: рівень ${profile.level}, навички: ${profile.skills.join(', ') || 'не вказано'}. Інших даних про кандидата немає.

Опис вакансії:
${job.description.slice(0, 3000)}

Нагадування: ${LANGUAGE_RULE}`,
  );
}

export async function answerJobQuestion(job: JobContext, question: string): Promise<string> {
  return chatText(
    `Ти — AI-консультант, що відповідає на питання про конкретну вакансію: пояснюєш технології простими словами, оцінюєш складність, підказуєш питання для співбесіди. ${LANGUAGE_RULE} Відповідай стисло і по суті.`,
    `Вакансія "${job.title}" у компанії ${job.company}.
Опис:
${job.description.slice(0, 3000)}

Питання користувача: ${question}

Нагадування: ${LANGUAGE_RULE}`,
  );
}
