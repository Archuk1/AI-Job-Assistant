import { JobSource, WorkFormat } from '../generated/prisma/enums';

export interface NormalizedJob {
  source: JobSource;
  externalId: string;
  title: string;
  company: string;
  url: string;
  description: string;
  location?: string;
  workFormat?: WorkFormat;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  publishedAt?: Date;
  tags: string[];
}
