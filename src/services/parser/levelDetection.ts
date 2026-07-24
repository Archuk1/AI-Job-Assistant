import { ExperienceLevel } from '../../generated/prisma/enums';

const JUNIOR_PATTERN = /\b(junior|trainee|intern|internship|джуніор|стажист|стажування)\b/i;
const SENIOR_PATTERN = /\b(senior|lead|principal|синьйор|тімлід|team\s*lead)\b/i;
const MIDDLE_PATTERN = /\b(middle|мідл)\b/i;

/**
 * Detects a level explicitly stated in a job title (a near-universal IT hiring
 * convention), so listings can be level-filtered instantly without waiting on an
 * AI call. Returns undefined when the title doesn't mention one — such jobs are
 * treated as open to all levels rather than excluded.
 */
export function detectLevelFromText(text: string): ExperienceLevel | undefined {
  if (JUNIOR_PATTERN.test(text)) return ExperienceLevel.JUNIOR;
  if (SENIOR_PATTERN.test(text)) return ExperienceLevel.SENIOR;
  if (MIDDLE_PATTERN.test(text)) return ExperienceLevel.MIDDLE;
  return undefined;
}
