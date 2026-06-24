import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Prisma } from "@/generated/prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toJson(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getCompletionPercentage(achieved: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((achieved / target) * 100));
}

export function getRemainingTarget(achieved: number, target: number) {
  return Math.max(0, target - achieved);
}

export function getCurrentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function parsePaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  return { page, limit, search, sortBy, sortOrder, skip: (page - 1) * limit };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
