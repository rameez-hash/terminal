import Image from "next/image";

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
    logo: brand.logo || DEFAULT_BRAND.logo,
    primaryColor: brand.primaryColor || DEFAULT_BRAND.primaryColor,
    tagline: brand.tagline || DEFAULT_BRAND.tagline,
  };
}

interface PaymentBrandHeaderProps {
  brand?: BrandDisplay | null;
  compact?: boolean;
}

export function PaymentBrandHeader({ brand, compact }: PaymentBrandHeaderProps) {
  const resolved = resolveBrand(brand);
  const color = resolved.primaryColor || "#2563eb";

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
          <Image
            src={resolved.logo}
            alt={resolved.name}
            width={compact ? 36 : 44}
            height={compact ? 36 : 44}
            className="h-full w-full object-contain p-1"
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
