-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT DEFAULT '#2563eb',
    "tagline" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "payment_links" ADD COLUMN "brandId" TEXT;

-- CreateIndex
CREATE INDEX "payment_links_brandId_idx" ON "payment_links"("brandId");

-- AddForeignKey
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default brands
INSERT INTO "brands" ("id", "name", "logo", "primaryColor", "tagline", "isActive", "createdAt", "updatedAt")
VALUES
  ('seed-brand-bmd', 'BMD Digital', '/logo-rename.png', '#2563eb', 'Secure Payment', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-brand-terminal', 'Terminal', '/logo-rename.png', '#4f46e5', 'Business Payments', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
