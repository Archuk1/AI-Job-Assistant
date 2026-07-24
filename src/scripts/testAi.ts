import { analyzeJob } from '../services/ai/aiService';
import { logger } from '../utils/logger';

async function main() {
  const result = await analyzeJob({
    title: 'Node.js Backend Developer',
    company: 'Test Co',
    description:
      'We are looking for a Node.js developer with TypeScript, PostgreSQL and Docker experience. 3+ years required.',
  });
  logger.info(result, 'AI analysis result');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err, 'testAi script failed');
    process.exit(1);
  });
