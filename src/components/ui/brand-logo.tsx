import Image from "next/image";

interface BrandLogoProps {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}

export function BrandLogo({ src, alt, size = 48, className }: BrandLogoProps) {
  if (!src) return null;

  if (src.startsWith("data:")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={className || "h-full w-full object-contain p-1"}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className || "h-full w-full object-contain p-1"}
      unoptimized={src.startsWith("http")}
    />
  );
}
