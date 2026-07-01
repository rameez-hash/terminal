import type { CSSProperties } from "react";
import Image from "next/image";

interface BrandLogoProps {
  src?: string | null;
  alt: string;
  size?: number;
  variant?: "default" | "hero";
  className?: string;
  style?: CSSProperties;
}

export function BrandLogo({ src, alt, size = 48, variant = "default", className, style }: BrandLogoProps) {
  if (!src) return null;

  const defaultClass =
    variant === "hero"
      ? "h-20 w-auto max-w-[240px] object-contain"
      : "h-full w-full object-contain p-1";

  const resolvedClass = className || defaultClass;

  if (src.startsWith("data:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={resolvedClass} style={style} />
    );
  }

  if (src.startsWith("/api/brands/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={resolvedClass} style={style} />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={variant === "hero" ? 240 : size}
      height={variant === "hero" ? 80 : size}
      className={resolvedClass}
      unoptimized={src.startsWith("http") || src.startsWith("/")}
    />
  );
}
