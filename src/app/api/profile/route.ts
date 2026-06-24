import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireAuth();
    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;

    if (data.newPassword) {
      if (!data.currentPassword) {
        return NextResponse.json({ error: "Current password required" }, { status: 400 });
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid current password" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(data.newPassword, 12);
    }

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    await logActivity({
      userId: sessionUser.id,
      type: "PROFILE_UPDATED",
      description: "Updated profile information",
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
