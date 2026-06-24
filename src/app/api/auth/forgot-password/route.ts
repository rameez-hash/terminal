import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: "If the email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000);

    await prisma.passwordResetToken.deleteMany({ where: { email } });
    await prisma.passwordResetToken.create({
      data: { email, token, expires },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    console.log(`Password reset link for ${email}: ${resetUrl}`);

    return NextResponse.json({ message: "If the email exists, a reset link has been sent." });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
