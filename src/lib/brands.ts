export function brandLogoUrl(brandId: string, updatedAt?: Date | string | null) {
  const version =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : updatedAt
        ? new Date(updatedAt).getTime()
        : Date.now();
  return `/api/brands/${brandId}/logo?v=${version}`;
}

export function withBrandLogoUrl<T extends { id: string; logo?: string | null; updatedAt?: Date | string }>(
  brand: T
): T & { logo: string | null } {
  return {
    ...brand,
    logo: brand.logo ? brandLogoUrl(brand.id, brand.updatedAt) : null,
  };
}
