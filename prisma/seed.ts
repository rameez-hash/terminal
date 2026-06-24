import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);
  const sellerPassword = await bcrypt.hash("seller123", 12);

  await prisma.user.upsert({
    where: { email: "admin@salesportal.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@salesportal.com",
      password: adminPassword,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  const seller1 = await prisma.user.upsert({
    where: { email: "john@salesportal.com" },
    update: {},
    create: {
      name: "John Seller",
      email: "john@salesportal.com",
      password: sellerPassword,
      role: "SELLER",
      status: "ACTIVE",
      phone: "+1 555-0101",
    },
  });

  const seller2 = await prisma.user.upsert({
    where: { email: "jane@salesportal.com" },
    update: {},
    create: {
      name: "Jane Seller",
      email: "jane@salesportal.com",
      password: sellerPassword,
      role: "SELLER",
      status: "ACTIVE",
      phone: "+1 555-0102",
    },
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  await prisma.monthlyTarget.upsert({
    where: { sellerId_month_year: { sellerId: seller1.id, month, year } },
    update: {},
    create: {
      sellerId: seller1.id,
      month,
      year,
      targetAmount: 10000,
      achievedAmount: 3500,
      currency: "USD",
    },
  });

  await prisma.monthlyTarget.upsert({
    where: { sellerId_month_year: { sellerId: seller2.id, month, year } },
    update: {},
    create: {
      sellerId: seller2.id,
      month,
      year,
      targetAmount: 15000,
      achievedAmount: 8200,
      currency: "USD",
    },
  });

  const client1 = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      name: "Acme Corporation",
      email: "contact@acme.com",
      phone: "+1 555-1000",
      company: "Acme Corp",
      country: "United States",
      notes: "Enterprise client",
      createdBy: seller1.id,
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "seed-client-2" },
    update: {},
    create: {
      id: "seed-client-2",
      name: "Global Tech Ltd",
      email: "info@globaltech.com",
      phone: "+44 20 7946 0958",
      company: "Global Tech",
      country: "United Kingdom",
      createdBy: seller2.id,
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        sellerId: seller1.id,
        clientId: client1.id,
        amount: 2000,
        currency: "USD",
        provider: "STRIPE",
        status: "COMPLETED",
        externalId: "seed_tx_1",
      },
      {
        sellerId: seller1.id,
        clientId: client1.id,
        amount: 1500,
        currency: "USD",
        provider: "STRIPE",
        status: "COMPLETED",
        externalId: "seed_tx_2",
      },
      {
        sellerId: seller2.id,
        clientId: client2.id,
        amount: 5000,
        currency: "USD",
        provider: "PAYPAL",
        status: "COMPLETED",
        externalId: "seed_tx_3",
      },
      {
        sellerId: seller2.id,
        clientId: client2.id,
        amount: 3200,
        currency: "USD",
        provider: "STRIPE",
        status: "COMPLETED",
        externalId: "seed_tx_4",
      },
    ],
  });

  console.log("Seed completed:");
  console.log("  Admin: admin@salesportal.com / admin123");
  console.log("  Seller 1: john@salesportal.com / seller123");
  console.log("  Seller 2: jane@salesportal.com / seller123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
