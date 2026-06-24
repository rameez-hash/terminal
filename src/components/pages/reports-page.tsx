"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/modal";
import { RevenueLineChart, RevenueBarChart, ProviderPieChart } from "@/components/charts";

export function ReportsPage({ isAdmin }: { isAdmin?: boolean }) {
  const [data, setData] = useState<{
    monthlySales: Array<{ month: string; revenue: number }>;
    sellerPerformance: Array<{ name: string; revenue: number }>;
    revenueByProvider: Array<{ provider: string; revenue: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const exportReport = (type: string, format: string) => {
    window.open(`/api/export?type=${type}&format=${format}`, "_blank");
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-slate-500">Analytics and exportable reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportReport("transactions", "excel")}>
            <Download className="h-4 w-4" /> Transactions Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReport("transactions", "pdf")}>
            <Download className="h-4 w-4" /> Transactions PDF
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => exportReport("sellers", "excel")}>
                <Download className="h-4 w-4" /> Sellers Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport("clients", "excel")}>
                <Download className="h-4 w-4" /> Clients Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Monthly Revenue</CardTitle></CardHeader>
          {data?.monthlySales?.length ? (
            <RevenueLineChart data={data.monthlySales} />
          ) : (
            <p className="py-8 text-center text-slate-500">No data</p>
          )}
        </Card>

        {isAdmin && data?.sellerPerformance?.length ? (
          <Card>
            <CardHeader><CardTitle>Revenue by Seller</CardTitle></CardHeader>
            <RevenueBarChart data={data.sellerPerformance} />
          </Card>
        ) : null}

        {data?.revenueByProvider?.length ? (
          <Card>
            <CardHeader><CardTitle>Revenue by Payment Method</CardTitle></CardHeader>
            <ProviderPieChart data={data.revenueByProvider} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
