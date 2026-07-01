import { BrandLogo } from "@/components/ui/brand-logo";

export interface BrandDisplay {
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  tagline?: string | null;
}

const DEFAULT_BRAND: BrandDisplay = {
  name: "BMD Digital",
  logo: "/logo-rename.png",
  primaryColor: "#2563eb",
  tagline: "Secure Payment",
};

export function resolveBrand(brand?: BrandDisplay | null): BrandDisplay {
  if (!brand?.name) return DEFAULT_BRAND;
  return {
    name: brand.name,
    logo: brand.logo ?? null,
    primaryColor: brand.primaryColor || DEFAULT_BRAND.primaryColor,
    tagline: brand.tagline || DEFAULT_BRAND.tagline,
  };
}

interface PaymentBrandHeaderProps {
  brand?: BrandDisplay | null;
  compact?: boolean;
  logoOnly?: boolean;
  size?: number;
}

export function PaymentBrandHeader({
  brand,
  compact,
  logoOnly,
  size,
}: PaymentBrandHeaderProps) {
  const resolved = resolveBrand(brand);
  const color = resolved.primaryColor || "#2563eb";
  const heroHeight = size ?? 80;

  if (logoOnly) {
    return (
      <div className="flex items-center justify-center">
        {resolved.logo ? (
          <div style={{ maxHeight: heroHeight }}>
            <BrandLogo
              src={resolved.logo}
              alt={resolved.name}
              variant="hero"
              className="h-full w-auto max-w-[240px] object-contain"
              style={{ maxHeight: heroHeight }}
            />
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-xl text-2xl font-bold text-white shadow-sm"
            style={{ backgroundColor: color, width: heroHeight, height: heroHeight }}
          >
            {resolved.name.charAt(0)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
        style={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          border: `2px solid ${color}20`,
        }}
      >
        {resolved.logo ? (
          <BrandLogo
            src={resolved.logo}
            alt={resolved.name}
            size={compact ? 36 : 44}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {resolved.name.charAt(0)}
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold" style={{ color }}>
          {resolved.name}
        </p>
        <p className="text-xs text-slate-400">{resolved.tagline}</p>
      </div>
    </div>
  );
}
