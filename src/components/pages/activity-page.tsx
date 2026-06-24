"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Pagination, LoadingSpinner, EmptyState } from "@/components/ui/modal";
import { formatDateTime } from "@/lib/utils";

interface ActivityLog {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

export function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/activity?page=${page}`);
    const data = await res.json();
    setLogs(data.data || []);
    setTotalPages(data.pagination?.totalPages || 1);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-slate-500">Monitor all system activities</p>
      </div>

      {loading ? <LoadingSpinner /> : logs.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 text-sm font-medium">
                  {log.user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{log.user.name}</span>
                    <span className="text-xs text-slate-400">{log.type.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{log.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}
