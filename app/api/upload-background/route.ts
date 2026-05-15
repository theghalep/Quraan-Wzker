import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { message: "لم يتم إرسال ملف" },
        { status: 400 },
      );
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: "نوع الملف غير مدعوم. ارفع صورة أو فيديو فقط." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "حجم الملف كبير جدًا. الحد الأقصى 200MB." },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const extension = getSafeExtension(file.name, file.type);
    const fileId = crypto.randomUUID();
    const safeName = `background-${Date.now()}-${fileId}${extension}`;
    const filePath = path.join(uploadDir, safeName);

    await writeFile(filePath, buffer);

    const publicUploadUrl = `/api/upload-background/file/${encodeURIComponent(safeName)}`;

    return NextResponse.json({
      url: publicUploadUrl,
      publicUrl: publicUploadUrl,
      type: file.type.startsWith("image/") ? "image" : "video",
      name: file.name,
      storedName: safeName,
      size: file.size,
      mimeType: file.type,
    });
  } catch (error: any) {
    console.error("UPLOAD_BACKGROUND_ERROR:", error);

    return NextResponse.json(
      {
        message: "حدث خطأ أثناء رفع الخلفية",
        error: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}

function getSafeExtension(fileName: string, type: string) {
  const extensionFromName = path.extname(fileName).toLowerCase();

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".mp4",
    ".webm",
    ".mov",
  ];

  if (allowedExtensions.includes(extensionFromName)) {
    return extensionFromName;
  }

  return getExtensionFromType(type);
}

function getExtensionFromType(type: string) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "video/mp4") return ".mp4";
  if (type === "video/webm") return ".webm";
  if (type === "video/quicktime") return ".mov";

  return ".bin";
}
