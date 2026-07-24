import { JobSource } from '../../generated/prisma/enums';
import { NormalizedJob } from '../../types/job';

export interface JobParser {
  source: JobSource;
  fetchJobs(): Promise<NormalizedJob[]>;
}
