-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CLIENT_DELETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'CLIENT_RESTORED';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clients_deletedAt_idx" ON "clients"("deletedAt");
