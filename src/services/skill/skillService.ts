import { prisma } from '../../db/prisma';

type Skill = Awaited<ReturnType<typeof prisma.skill.create>>;

const cache = new Map<string, Promise<Skill>>();

async function loadOrCreateSkill(trimmed: string): Promise<Skill> {
  const existing = await prisma.skill.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) {
    return existing;
  }
  return prisma.skill.create({ data: { name: trimmed } });
}

export function findOrCreateSkill(name: string): Promise<Skill> {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();

  let pending = cache.get(key);
  if (!pending) {
    pending = loadOrCreateSkill(trimmed);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}

export async function findOrCreateSkills(names: string[]): Promise<Skill[]> {
  const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  return Promise.all(uniqueNames.map(findOrCreateSkill));
}
