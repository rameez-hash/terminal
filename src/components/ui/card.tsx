import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function CardTitle({ children, className }: CardProps) {
  return (
    <h3 className={cn("text-lg font-semibold text-slate-900 dark:text-slate-100", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }: CardProps) {
  return (
    <p className={cn("text-sm text-slate-500 dark:text-slate-400", className)}>{children}</p>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <p className={cn("mt-0.5 text-xs font-medium", trend.positive ? "text-green-600" : "text-red-600")}>
              {trend.positive ? "+" : "-"}{Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="rounded-md bg-[#e8f8f5] p-2 text-[#2d9a84]">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
