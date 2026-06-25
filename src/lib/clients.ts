import { prisma } from "@/lib/prisma";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  return phone.trim().replace(/[\s\-()]/g, "");
}

export async function findClientDuplicate(
  email: string,
  phone?: string | null,
  excludeId?: string
) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = phone?.trim() ? normalizePhone(phone) : null;

  const emailMatch = await prisma.client.findFirst({
    where: {
      ...(excludeId && { id: { not: excludeId } }),
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
    select: { id: true, email: true, phone: true, name: true },
  });

  if (emailMatch) {
    return { field: "email" as const, client: emailMatch };
  }

  if (!normalizedPhone) {
    return null;
  }

  const clientsWithPhone = await prisma.client.findMany({
    where: {
      ...(excludeId && { id: { not: excludeId } }),
      phone: { not: null },
    },
    select: { id: true, email: true, phone: true, name: true },
  });

  for (const client of clientsWithPhone) {
    if (client.phone && normalizePhone(client.phone) === normalizedPhone) {
      return { field: "phone" as const, client };
    }
  }

  return null;
}

export function duplicateClientMessage(field: "email" | "phone") {
  return field === "email"
    ? "A client with this email already exists"
    : "A client with this phone number already exists";
}
