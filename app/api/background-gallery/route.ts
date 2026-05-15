import { readdir, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const GALLERY_DIR = path.join(process.cwd(), "public", "backgrounds", "gallery");
const PUBLIC_PREFIX = "/backgrounds/gallery";
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export async function GET() {
  try {
    const entries = await readdir(GALLERY_DIR, { withFileTypes: true }).catch(() => []);

    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const extension = path.extname(entry.name).toLowerCase();
          if (!SUPPORTED_EXTENSIONS.has(extension)) return null;

          const fullPath = path.join(GALLERY_DIR, entry.name);
          const fileStat = await stat(fullPath).catch(() => null);
          const baseName = path.basename(entry.name, extension);
          const prettyTitle = baseName
            .replace(/^\d+[-_ ]*/, "")
            .replace(/[-_]+/g, " ")
            .trim();

          return {
            id: `local-gallery-${baseName}`,
            title: prettyTitle || "خلفية محلية",
            description: "صورة محلية من معرض الخلفيات",
            image: `${PUBLIC_PREFIX}/${encodeURIComponent(entry.name)}`,
            fileName: entry.name,
            size: fileStat?.size || 0,
            updatedAt: fileStat?.mtime?.toISOString() || null,
          };
        }),
    );

    const backgrounds = files
      .filter(Boolean)
      .sort((a: any, b: any) => String(a.fileName).localeCompare(String(b.fileName), "ar"));

    return NextResponse.json({ backgrounds });
  } catch (error: any) {
    console.error("BACKGROUND_GALLERY_ERROR:", error);

    return NextResponse.json(
      {
        backgrounds: [],
        message: "تعذر قراءة معرض الخلفيات المحلية",
      },
      { status: 200 },
    );
  }
}
