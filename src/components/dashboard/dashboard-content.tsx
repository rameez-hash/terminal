"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCircle,
  DollarSign,
  TrendingUp,
  Link2,
  Target,
  Clock,
  Trophy,
} from "lucide-react";
import { StatCard, Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/modal";
import { RevenueLineChart, RevenueBarChart, ProviderPieChart } from "@/components/charts";
import { formatCurrency, formatMonthYear, getCurrentMonthYear } from "@/lib/utils";

interface AnalyticsData {
  stats: {
    totalSellers: number;
    totalClients: number;
    totalRevenue: number;
    monthlyRevenue: number;
    activePaymentLinks: number;
    targetAchievementRate: number;
    pendingTargets: number;
  };
  currentTarget: {
    month: number;
    year: number;
    targetAmount: number;
    achievedAmount: number;
    completionPercentage: number;
    remainingAmount: number;
    currency?: string;
  } | null;
  monthlyTargetHistory?: Array<{
    id: string;
    month: number;
    year: number;
    targetAmount: number;
    achievedAmount: number;
    completionPercentage: number;
    remainingAmount: number;
    currency: string;
  }>;
  topPerformingSellers: Array<{ id: string; name: string; revenue: number; transactionCount: number }>;
  revenueByProvider: Array<{ provider: string; revenue: number }>;
  monthlySales: Array<{ month: string; revenue: number }>;
}

interface DashboardContentProps {
  role: "SUPER_ADMIN" | "SELLER";
}

export function DashboardContent({ role }: DashboardContentProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return <p>Failed to load dashboard data</p>;

  const { stats, currentTarget, monthlyTargetHistory, topPerformingSellers, revenueByProvider, monthlySales } = data;
  const isAdmin = role === "SUPER_ADMIN";
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isAdmin ? "Admin Dashboard" : "Seller Dashboard"}
        </h1>
        <p className="text-slate-500">Overview of your sales performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
          <StatCard title="Total Sellers" value={stats.totalSellers} icon={<Users className="h-6 w-6" />} />
        )}
        <StatCard title="Total Clients" value={stats.totalClients} icon={<UserCircle className="h-6 w-6" />} />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<DollarSign className="h-6 w-6" />}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <StatCard
          title="Active Payment Links"
          value={stats.activePaymentLinks}
          icon={<Link2 className="h-6 w-6" />}
        />
        <StatCard
          title="Target Achievement"
          value={`${stats.targetAchievementRate}%`}
          icon={<Target className="h-6 w-6" />}
        />
        <StatCard
          title="Pending Targets"
          value={stats.pendingTargets}
          icon={<Clock className="h-6 w-6" />}
        />
        {isAdmin && topPerformingSellers.length > 0 && (
          <StatCard
            title="Top Seller"
            value={topPerformingSellers[0]?.name || "N/A"}
            subtitle={formatCurrency(topPerformingSellers[0]?.revenue || 0)}
            icon={<Trophy className="h-6 w-6" />}
          />
        )}
      </div>

      {!isAdmin && currentTarget && (
        <Card>
          <CardHeader>
            <CardTitle>
              Monthly Target — {formatMonthYear(currentTarget.month ?? currentMonth, currentTarget.year ?? currentYear)}
            </CardTitle>
          </CardHeader>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Target Amount</p>
              <p className="text-2xl font-bold">{formatCurrency(currentTarget.targetAmount, currentTarget.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Achieved This Month</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(currentTarget.achievedAmount, currentTarget.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Remaining</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(currentTarget.remainingAmount, currentTarget.currency)}
              </p>
            </div>
            <div className="md:col-span-3">
              <div className="h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${currentTarget.completionPercentage >= 100 ? "bg-green-600" : "bg-indigo-600"}`}
                  style={{ width: `${currentTarget.completionPercentage}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {currentTarget.completionPercentage}% complete
              </p>
            </div>
          </div>
        </Card>
      )}

      {!isAdmin && monthlyTargetHistory && monthlyTargetHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Achievement History</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                  <th className="pb-3 pr-4 font-medium">Month</th>
                  <th className="pb-3 pr-4 font-medium">Target</th>
                  <th className="pb-3 pr-4 font-medium">Achieved</th>
                  <th className="pb-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTargetHistory.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 dark:border-slate-800 ${
                      row.month === currentMonth && row.year === currentYear
                        ? "bg-indigo-50/50 dark:bg-indigo-950/20"
                        : ""
                    }`}
                  >
                    <td className="py-3 pr-4 font-medium">{formatMonthYear(row.month, row.year)}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.targetAmount, row.currency)}</td>
                    <td className="py-3 pr-4 text-green-600">{formatCurrency(row.achievedAmount, row.currency)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className={`h-full rounded-full ${row.completionPercentage >= 100 ? "bg-green-600" : "bg-indigo-600"}`}
                            style={{ width: `${Math.min(100, row.completionPercentage)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{row.completionPercentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          {monthlySales.length > 0 ? (
            <RevenueLineChart data={monthlySales} />
          ) : (
            <p className="py-8 text-center text-slate-500">No sales data yet</p>
          )}
        </Card>

        {isAdmin && topPerformingSellers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Sellers</CardTitle>
            </CardHeader>
            <RevenueBarChart
              data={topPerformingSellers.map((s) => ({ name: s.name, revenue: s.revenue }))}
            />
          </Card>
        )}

        {revenueByProvider.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payment Method</CardTitle>
            </CardHeader>
            <ProviderPieChart data={revenueByProvider} />
          </Card>
        )}
      </div>
    </div>
  );
}
