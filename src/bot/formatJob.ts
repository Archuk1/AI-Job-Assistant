interface JobLike {
  title: string;
  company: string;
  url: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  aiSummary?: string | null;
  aiComplexity?: string | null;
}

export function formatJobMessage(job: JobLike): string {
  const salary =
    job.salaryMin || job.salaryMax
      ? `💰 ${job.salaryMin ?? '?'}–${job.salaryMax ?? '?'} ${job.salaryCurrency ?? ''}\n`
      : '';
  const location = job.location ? `📍 ${job.location}\n` : '';
  const aiPart = job.aiSummary
    ? `\n🤖 ${job.aiSummary}${job.aiComplexity ? ` (рівень: ${job.aiComplexity})` : ''}\n`
    : '';

  return `${job.title} — ${job.company}\n${salary}${location}${aiPart}${job.url}`;
}
