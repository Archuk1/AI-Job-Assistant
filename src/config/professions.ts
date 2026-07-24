import { Profession } from '../generated/prisma/enums';

export interface ProfessionDef {
  id: Profession;
  label: string;
  keywords: string[];
}

export const PROFESSIONS: ProfessionDef[] = [
  {
    id: Profession.FRONTEND,
    label: 'Frontend-розробник',
    keywords: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'html', 'css'],
  },
  {
    id: Profession.BACKEND,
    label: 'Backend-розробник',
    keywords: [
      'backend',
      'back-end',
      'back end',
      'node.js',
      'java',
      'python',
      'php',
      '.net',
      'golang',
      'django',
      'laravel',
      'spring',
    ],
  },
  {
    id: Profession.FULLSTACK,
    label: 'Full-Stack розробник',
    keywords: ['full-stack', 'fullstack', 'full stack'],
  },
  {
    id: Profession.MOBILE,
    label: 'Mobile-розробник',
    keywords: ['android', 'ios', 'flutter', 'react native', 'mobile', 'kotlin', 'swift'],
  },
  {
    id: Profession.DEVOPS,
    label: 'DevOps-інженер',
    keywords: ['devops', 'docker', 'kubernetes', 'ci/cd', 'sre', 'terraform'],
  },
  {
    id: Profession.QA,
    label: 'QA-інженер',
    keywords: ['qa', 'quality assurance', 'tester', 'testing', 'test automation'],
  },
  {
    id: Profession.DATA_SCIENCE,
    label: 'Data Science / ML',
    keywords: ['data science', 'machine learning', 'data analyst', 'data engineer', 'ml engineer'],
  },
  {
    id: Profession.DESIGN,
    label: 'UI/UX Дизайнер',
    keywords: ['ui/ux', 'ux/ui', 'designer', 'дизайнер', 'figma'],
  },
  {
    id: Profession.PROJECT_MANAGEMENT,
    label: 'Project/Product Manager',
    keywords: [
      'project manager',
      'product manager',
      'scrum master',
      'проєктний менеджер',
      'продукт менеджер',
    ],
  },
];

export function getProfessionDef(id: Profession): ProfessionDef | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}
