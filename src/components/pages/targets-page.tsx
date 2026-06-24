"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";

interface Target {
  id: string;
  month: number;
  year: number;
  targetAmount: number;
  achievedAmount: number;
  currency: string;
  completionPercentage: number;
  remainingAmount: number;
  seller?: { name: string; email: string };
}

export function TargetsPage({ isAdmin }: { isAdmin?: boolean }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const params = new URLSearchParams({
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    });
    const res = await fetch(`/api/targets?${params}`);
    const data = await res.json();
    setTargets(data.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? "Monthly Targets" : "My Target"}</h1>
        <p className="text-slate-500">Track monthly sales target progress</p>
      </div>

      {targets.length === 0 ? (
        <EmptyState title="No targets assigned" description={isAdmin ? "Assign targets to sellers from the Sellers page" : "Your admin hasn't assigned a target yet"} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {targets.map((target) => (
            <Card key={target.id}>
              <CardHeader>
                <CardTitle>
                  {isAdmin ? target.seller?.name : `${target.month}/${target.year}`}
                </CardTitle>
                {isAdmin && (
                  <p className="text-sm text-slate-500">{target.seller?.email}</p>
                )}
              </CardHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Target</span>
                  <span className="font-medium">{formatCurrency(target.targetAmount, target.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Achieved</span>
                  <span className="font-medium text-green-600">{formatCurrency(target.achievedAmount, target.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Remaining</span>
                  <span className="font-medium text-orange-600">{formatCurrency(target.remainingAmount, target.currency)}</span>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-medium">{target.completionPercentage}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${target.completionPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
