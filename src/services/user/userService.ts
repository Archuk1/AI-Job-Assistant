import { prisma } from '../../db/prisma';
import { EnglishLevel, ExperienceLevel, WorkFormat } from '../../generated/prisma/enums';
import { findOrCreateSkills } from '../skill/skillService';

export interface TelegramProfile {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export async function upsertUserFromTelegram(from: TelegramProfile) {
  const telegramId = BigInt(from.id);

  return prisma.user.upsert({
    where: { telegramId },
    update: {
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    },
    create: {
      telegramId,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    },
  });
}

export async function getUserWithProfile(telegramId: number) {
  return prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: {
      profile: true,
      skills: { include: { skill: true } },
    },
  });
}

export interface ProfileInput {
  level: ExperienceLevel;
  workFormats: WorkFormat[];
  country?: string;
  region?: string;
  englishLevel: EnglishLevel;
}

export async function saveProfile(userId: number, data: ProfileInput) {
  return prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

export async function setUserSkills(userId: number, skillNames: string[]) {
  const skills = await findOrCreateSkills(skillNames);

  await prisma.$transaction([
    prisma.userSkill.deleteMany({ where: { userId } }),
    prisma.userSkill.createMany({
      data: skills.map((skill) => ({ userId, skillId: skill.id })),
    }),
  ]);

  return skills;
}
