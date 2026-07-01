-- Remove demo seed payment links from production
DELETE FROM "payment_links" WHERE "id" IN ('seed-link-1', 'seed-link-2');
