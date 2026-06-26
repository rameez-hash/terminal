import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

const MAX_SIZE = 1024 * 1024; // 1MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPG, WEBP, or SVG images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Image must be 1MB or smaller" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({ url: dataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 }
    );
  }
}
