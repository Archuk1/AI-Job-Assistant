import { prisma } from '../../db/prisma';
import { bot } from '../../bot/bot';
import { formatJobMessage } from '../../bot/formatJob';
import { logger } from '../../utils/logger';
import { WorkFormat } from '../../generated/prisma/enums';

async function findMatchingUsers(jobId: number, workFormat: WorkFormat | null) {
  const jobSkills = await prisma.jobSkill.findMany({
    where: { jobId },
    include: { skill: true },
  });
  const skillNames = jobSkills.map((js) => js.skill.name.toLowerCase());
  if (skillNames.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      profile: workFormat ? { workFormats: { has: workFormat } } : undefined,
      skills: { some: { skill: { name: { in: skillNames, mode: 'insensitive' } } } },
    },
    select: { id: true, telegramId: true },
  });
}

export async function notifyUsersAboutJob(jobId: number) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return;
  }

  const users = await findMatchingUsers(jobId, job.workFormat);

  for (const user of users) {
    const already = await prisma.notification.findUnique({
      where: { userId_jobId: { userId: user.id, jobId } },
    });
    if (already) {
      continue;
    }

    try {
      await bot.telegram.sendMessage(user.telegramId.toString(), formatJobMessage(job));
      await prisma.notification.create({
        data: { userId: user.id, jobId, status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      logger.error({ err, userId: user.id, jobId }, 'Failed to send job notification');
      await prisma.notification.create({
        data: { userId: user.id, jobId, status: 'FAILED' },
      });
    }
  }
}

export async function notifyUsersAboutNewJobs(jobIds: number[]) {
  for (const jobId of jobIds) {
    await notifyUsersAboutJob(jobId);
  }
}
