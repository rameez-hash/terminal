import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { logo: true, updatedAt: true },
  });

  if (!brand?.logo) {
    return new NextResponse(null, { status: 404 });
  }

  const logo = brand.logo;

  if (logo.startsWith("data:")) {
    const match = logo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  if (logo.startsWith("http://") || logo.startsWith("https://")) {
    return NextResponse.redirect(logo);
  }

  return NextResponse.redirect(new URL(logo, getBaseUrl()));
}
