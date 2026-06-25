"use client";

import { useEffect, useState, useCallback } from "react";
import { Filter, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { LoadingSpinner, EmptyState, Badge } from "@/components/ui/modal";
import {
  formatCurrency,
  formatMonthYear,
  getCurrentMonthYear,
  getMonthOptions,
  getYearOptions,
} from "@/lib/utils";

interface TargetRow {
  id: string;
  month: number;
  year: number;
  targetAmount: number;
  achievedAmount: number;
  currency: string;
  completionPercentage: number;
  remainingAmount: number;
  hasTarget?: boolean;
  status?: string;
  seller?: { id: string; name: string; email: string; status?: string };
}

interface SellerOption {
  id: string;
  name: string;
  email: string;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "NO_TARGET") {
    return (
      <Badge variant="default">
        <AlertCircle className="mr-1 h-3 w-3" />
        No Target
      </Badge>
    );
  }
  if (status === "COMPLETED") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Achieved
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <Clock className="mr-1 h-3 w-3" />
      In Progress
    </Badge>
  );
}

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all ${percentage >= 100 ? "bg-green-600" : "bg-indigo-600"}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium">{percentage}%</span>
    </div>
  );
}

export function TargetsPage({ isAdmin }: { isAdmin?: boolean }) {
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));
  const [sellerId, setSellerId] = useState("");

  const fetchSellers = useCallback(async () => {
    if (!isAdmin) return;
    const res = await fetch("/api/sellers?limit=100");
    const data = await res.json();
    setSellers(data.data || []);
  }, [isAdmin]);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });

    if (isAdmin) {
      params.set("summary", "true");
      params.set("month", month);
      params.set("year", year);
      if (sellerId) params.set("sellerId", sellerId);
    } else {
      params.set("limit", "24");
    }

    const res = await fetch(`/api/targets?${params}`);
    const data = await res.json();
    setTargets(data.data || []);
    setLoading(false);
  }, [isAdmin, month, year, sellerId]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const currentMonthTarget = !isAdmin
    ? targets.find((t) => t.month === currentMonth && t.year === currentYear)
    : null;

  const filteredAdminRows = targets;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "Monthly Targets" : "My Targets"}</h1>
        <p className="text-slate-500">
          {isAdmin
            ? "View each seller's monthly target and achievement"
            : "Track your monthly sales targets and achievements"}
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={getMonthOptions()}
            />
            <Select
              label="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={getYearOptions()}
            />
            <Select
              label="Seller"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              options={[
                { value: "", label: "All Sellers" },
                ...sellers.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Showing records for {formatMonthYear(parseInt(month, 10), parseInt(year, 10))}
          </p>
        </Card>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : !isAdmin && targets.length === 0 ? (
        <EmptyState
          title="No targets assigned"
          description="Your admin hasn't assigned any monthly targets yet"
        />
      ) : !isAdmin ? (
        <>
          {currentMonthTarget ? (
            <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30">
              <CardHeader>
                <CardTitle>Current Month — {formatMonthYear(currentMonth, currentYear)}</CardTitle>
              </CardHeader>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-slate-500">Target</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(currentMonthTarget.targetAmount, currentMonthTarget.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Achieved</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(currentMonthTarget.achievedAmount, currentMonthTarget.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Remaining</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(currentMonthTarget.remainingAmount, currentMonthTarget.currency)}
                  </p>
                </div>
                <div className="sm:col-span-3">
                  <ProgressBar percentage={currentMonthTarget.completionPercentage} />
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Current Month — {formatMonthYear(currentMonth, currentYear)}</CardTitle>
              </CardHeader>
              <p className="text-sm text-slate-500">No target assigned for this month yet.</p>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Monthly History</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                    <th className="pb-3 pr-4 font-medium">Month</th>
                    <th className="pb-3 pr-4 font-medium">Target</th>
                    <th className="pb-3 pr-4 font-medium">Achieved</th>
                    <th className="pb-3 pr-4 font-medium">Remaining</th>
                    <th className="pb-3 pr-4 font-medium">Progress</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr
                      key={target.id}
                      className={`border-b border-slate-100 dark:border-slate-800 ${
                        target.month === currentMonth && target.year === currentYear
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20"
                          : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium">
                        {formatMonthYear(target.month, target.year)}
                      </td>
                      <td className="py-3 pr-4">
                        {formatCurrency(target.targetAmount, target.currency)}
                      </td>
                      <td className="py-3 pr-4 text-green-600">
                        {formatCurrency(target.achievedAmount, target.currency)}
                      </td>
                      <td className="py-3 pr-4 text-orange-600">
                        {formatCurrency(target.remainingAmount, target.currency)}
                      </td>
                      <td className="py-3 pr-4 min-w-[140px]">
                        <ProgressBar percentage={target.completionPercentage} />
                      </td>
                      <td className="py-3">
                        <StatusBadge
                          status={
                            target.achievedAmount >= target.targetAmount && target.targetAmount > 0
                              ? "COMPLETED"
                              : "IN_PROGRESS"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : filteredAdminRows.length === 0 ? (
        <EmptyState
          title="No sellers found"
          description="Add sellers or adjust your filters"
        />
      ) : isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Seller Performance — {formatMonthYear(parseInt(month, 10), parseInt(year, 10))}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                  <th className="pb-3 pr-4 font-medium">Seller</th>
                  <th className="pb-3 pr-4 font-medium">Email</th>
                  <th className="pb-3 pr-4 font-medium">Target</th>
                  <th className="pb-3 pr-4 font-medium">Achieved</th>
                  <th className="pb-3 pr-4 font-medium">Remaining</th>
                  <th className="pb-3 pr-4 font-medium">Progress</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdminRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-4 font-medium">{row.seller?.name}</td>
                    <td className="py-3 pr-4 text-slate-500">{row.seller?.email}</td>
                    <td className="py-3 pr-4">
                      {row.hasTarget
                        ? formatCurrency(row.targetAmount, row.currency)
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 font-medium text-green-600">
                      {formatCurrency(row.achievedAmount, row.currency)}
                    </td>
                    <td className="py-3 pr-4 text-orange-600">
                      {row.hasTarget
                        ? formatCurrency(row.remainingAmount, row.currency)
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 min-w-[140px]">
                      {row.hasTarget ? (
                        <ProgressBar percentage={row.completionPercentage} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
