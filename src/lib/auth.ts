import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { Role, UserStatus } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    status: UserStatus;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      status: UserStatus;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: UserStatus;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;
        if (user.status === "SUSPENDED") return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  return user;
}

export async function requireSeller() {
  const user = await requireAuth();
  if (user.role !== "SELLER" && user.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  return user;
}
