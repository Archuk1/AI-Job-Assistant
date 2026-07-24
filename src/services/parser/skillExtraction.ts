import { CURATED_SKILLS } from '../../config/skills';

export function extractSkillsFromText(text: string): string[] {
  return CURATED_SKILLS.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });
}
