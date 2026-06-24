import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
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
      phone: "+1-555-0101",
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
      phone: "+1-555-0102",
    },
  });

  const client1 = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      name: "Acme Corp",
      email: "billing@acme.com",
      phone: "+1-555-1000",
      company: "Acme Corporation",
      country: "USA",
      createdBy: seller1.id,
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "seed-client-2" },
    update: {},
    create: {
      id: "seed-client-2",
      name: "TechStart Inc",
      email: "finance@techstart.io",
      phone: "+1-555-2000",
      company: "TechStart Inc",
      country: "USA",
      createdBy: seller2.id,
    },
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  await prisma.monthlyTarget.upsert({
    where: {
      sellerId_month_year: {
        sellerId: seller1.id,
        month,
        year,
      },
    },
    update: {},
    create: {
      sellerId: seller1.id,
      month,
      year,
      targetAmount: 10000,
      achievedAmount: 2500,
      currency: "USD",
    },
  });

  await prisma.monthlyTarget.upsert({
    where: {
      sellerId_month_year: {
        sellerId: seller2.id,
        month,
        year,
      },
    },
    update: {},
    create: {
      sellerId: seller2.id,
      month,
      year,
      targetAmount: 15000,
      achievedAmount: 4200,
      currency: "USD",
    },
  });

  await prisma.paymentLink.upsert({
    where: { id: "seed-link-1" },
    update: {},
    create: {
      id: "seed-link-1",
      sellerId: seller1.id,
      clientId: client1.id,
      amount: 499.99,
      currency: "USD",
      description: "Monthly subscription - Acme Corp",
      provider: "STRIPE",
      status: "ACTIVE",
    },
  });

  await prisma.paymentLink.upsert({
    where: { id: "seed-link-2" },
    update: {},
    create: {
      id: "seed-link-2",
      sellerId: seller2.id,
      clientId: client2.id,
      amount: 1299.0,
      currency: "USD",
      description: "Enterprise license - TechStart",
      provider: "PAYPAL",
      status: "ACTIVE",
    },
  });

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
