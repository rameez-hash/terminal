/** Pooled URL for app runtime (Neon + Vercel serverless). */
export function getDatabaseUrl(): string {
  const url =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      "Database URL not set. Add DATABASE_URL or POSTGRES_PRISMA_URL from Neon."
    );
  }

  return url;
}

/** Direct URL for Prisma migrations (Neon unpooled). */
export function getMigrationDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      "Migration database URL not set. Add DATABASE_URL_UNPOOLED from Neon."
    );
  }

  return url;
}
