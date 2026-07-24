-- CreateEnum
CREATE TYPE "Profession" AS ENUM ('FRONTEND', 'BACKEND', 'FULLSTACK', 'MOBILE', 'DEVOPS', 'QA', 'DATA_SCIENCE', 'DESIGN', 'PROJECT_MANAGEMENT');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "detectedLevel" "ExperienceLevel";

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "profession" "Profession";
