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
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-0.5 truncate whitespace-nowrap text-lg font-semibold leading-6 text-slate-900 dark:text-slate-100">
          {value}
        </p>
        {subtitle && (
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
        {trend && (
          <p className={cn("text-[11px] font-medium", trend.positive ? "text-green-600" : "text-red-600")}>
            {trend.positive ? "+" : "-"}{Math.abs(trend.value)}%
          </p>
        )}
      </div>
      {icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f8f5] text-[#2d9a84]">
          {icon}
        </div>
      )}
    </div>
  );
}
