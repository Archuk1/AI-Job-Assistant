import { prisma } from '../db/prisma';
import { notifyUsersAboutJob } from '../services/notification/notificationService';
import { logger } from '../utils/logger';

async function main() {
  const users = await prisma.user.findMany({
    include: { profile: true, skills: { include: { skill: true } } },
  });

  for (const user of users) {
    if (!user.profile || user.skills.length === 0) {
      logger.warn({ userId: user.id }, 'User has no profile/skills yet, skipping');
      continue;
    }

    const skillNames = user.skills.map((s) => s.skill.name.toLowerCase());
    const job = await prisma.job.findFirst({
      where: {
        workFormat: user.profile.workFormats.length > 0 ? { in: user.profile.workFormats } : undefined,
        skills: { some: { skill: { name: { in: skillNames, mode: 'insensitive' } } } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    if (!job) {
      logger.warn({ userId: user.id }, 'No matching job found for test notification');
      continue;
    }

    logger.info({ userId: user.id, jobId: job.id, title: job.title }, 'Sending test notification');
    await notifyUsersAboutJob(job.id);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err, 'testNotification script failed');
    process.exit(1);
  });
