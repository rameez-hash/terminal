-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SELLER_RESTORED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");
