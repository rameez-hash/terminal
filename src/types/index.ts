import type { Role, UserStatus, PaymentProvider, PaymentLinkStatus, TransactionStatus } from "@/generated/prisma/client";

export type { Role, UserStatus, PaymentProvider, PaymentLinkStatus, TransactionStatus };

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface DashboardStats {
  totalSellers: number;
  totalClients: number;
  totalRevenue: number;
  monthlyRevenue: number;
  activePaymentLinks: number;
  targetAchievementRate: number;
  pendingTargets: number;
}

export interface SellerPerformance {
  id: string;
  name: string;
  email: string;
  revenue: number;
  targetAmount: number;
  achievedAmount: number;
  completionPercentage: number;
  transactionCount: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}
