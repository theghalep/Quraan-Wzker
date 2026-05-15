import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

function getSafeFilePath(rawName: string) {
  const decoded = decodeURIComponent(String(rawName || ""));
  const safeName = path.basename(decoded);

  if (!safeName || safeName !== decoded || safeName.includes("..")) {
    return null;
  }

  return path.join(UPLOAD_DIR, safeName);
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> | { name: string } },
) {
  const resolvedParams = await params;
  const filePath = getSafeFilePath(resolvedParams.name);

  if (!filePath) {
    return new NextResponse(null, { status: 400 });
  }

  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile()) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> | { name: string } },
) {
  const resolvedParams = await params;
  const filePath = getSafeFilePath(resolvedParams.name);

  if (!filePath) {
    return NextResponse.json({ message: "اسم الملف غير صالح" }, { status: 400 });
  }

  const file = await readFile(filePath).catch(() => null);
  if (!file) {
    return NextResponse.json({ message: "الملف غير موجود" }, { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
