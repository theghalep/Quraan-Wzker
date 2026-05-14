import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TafsirCacheItem = {
  tafsir: string;
  loadedAt: number;
};

type TafsirSourceResult = {
  tafsir: string;
  source: string;
};

const CACHE_DURATION_MS = 1000 * 60 * 60 * 24;
const tafsirCache = new Map<string, TafsirCacheItem>();

const TAFSIR_SOURCES: Record<string, {
  label: string;
  quranComId?: number;
  quranTafseerId?: number;
  alQuranCloudEdition?: string;
}> = {
  muyassar: {
    label: "التفسير الميسر",
    quranComId: 16,
    quranTafseerId: 1,
    alQuranCloudEdition: "ar.muyassar",
  },
  jalalayn: {
    label: "تفسير الجلالين",
    alQuranCloudEdition: "ar.jalalayn",
  },
  muyassarCloud: {
    label: "الميسر - مصدر بديل",
    alQuranCloudEdition: "ar.muyassar",
  },
};

const DISJOINT_LETTERS: Record<string, string> = {
  "2:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، وفيها إشارة إلى إعجاز القرآن وأنه مؤلف من حروف يعرفها العرب ومع ذلك عجزوا عن الإتيان بمثله.",
  "3:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، وفيها إشارة إلى إعجاز القرآن وأنه مؤلف من حروف يعرفها العرب ومع ذلك عجزوا عن الإتيان بمثله.",
  "7:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، وفيها إشارة إلى إعجاز القرآن وأنه مؤلف من حروف يعرفها العرب ومع ذلك عجزوا عن الإتيان بمثله.",
  "10:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "11:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "12:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "13:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "14:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "15:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "19:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها، وفيها إشارة إلى إعجاز القرآن.",
  "20:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها، وفيها إشارة إلى إعجاز القرآن.",
  "26:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "27:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "28:1": "هذه من الحروف المقطعة، افتتح الله بها السورة تنبيهًا على إعجاز القرآن وأنه من جنس الحروف التي يتكلم بها العرب.",
  "29:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، وفيها إشارة إلى إعجاز القرآن.",
  "30:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، وفيها إشارة إلى إعجاز القرآن.",
  "31:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، وفيها إشارة إلى إعجاز القرآن.",
  "32:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، وفيها إشارة إلى إعجاز القرآن.",
  "36:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها، وفيها إشارة إلى إعجاز القرآن.",
  "38:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها، وفيها إشارة إلى إعجاز القرآن.",
  "40:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها.",
  "41:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها.",
  "42:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها.",
  "43:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها.",
  "44:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها.",
  "45:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها.",
  "46:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها.",
  "50:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها، وفيها إشارة إلى إعجاز القرآن.",
  "68:1": "هذه من الحروف المقطعة التي افتتحت بها بعض السور، والله أعلم بمراده بها، وفيها إشارة إلى إعجاز القرآن.",
};

function cleanTafsirText(value: string) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isBadTafsir(text: string) {
  const value = cleanTafsirText(text).toLowerCase();
  return (
    !value ||
    value.includes("سبق الكلام") ||
    value.includes("تقدم الكلام") ||
    value.includes("قد تقدم الكلام") ||
    value.includes("انظر تفسير") ||
    value.includes("سبق بيان")
  );
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "quran-reels-generator/1.0",
      },
    });

    const data = await response.json().catch(() => ({}));

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function tryQuranCom({
  chapter,
  ayah,
  resourceId,
}: {
  chapter: number;
  ayah: number;
  resourceId: number;
}): Promise<TafsirSourceResult | null> {
  try {
    const verseKey = `${chapter}:${ayah}`;
    const { response, data } = await fetchJsonWithTimeout(
      `https://api.quran.com/api/v4/quran/tafsirs/${resourceId}?verse_key=${encodeURIComponent(verseKey)}`,
    );

    const text =
      data?.tafsirs?.[0]?.text ||
      data?.tafsir?.text ||
      data?.text ||
      "";

    const tafsir = cleanTafsirText(text);

    if (!response.ok || isBadTafsir(tafsir)) return null;

    return { tafsir, source: "quran.com" };
  } catch (error) {
    console.warn("TAFSIR_QURAN_COM_FAILED:", error);
    return null;
  }
}

async function tryQuranTafseer({
  chapter,
  ayah,
  tafsirId,
}: {
  chapter: number;
  ayah: number;
  tafsirId: number;
}): Promise<TafsirSourceResult | null> {
  try {
    const { response, data } = await fetchJsonWithTimeout(
      `https://api.quran-tafseer.com/tafseer/${tafsirId}/${chapter}/${ayah}`,
    );

    const tafsir = cleanTafsirText(data?.text || "");
    if (!response.ok || isBadTafsir(tafsir)) return null;

    return { tafsir, source: "quran-tafseer.com" };
  } catch (error) {
    console.warn("TAFSIR_QURAN_TAFSEER_FAILED:", error);
    return null;
  }
}

async function tryAlQuranCloud({
  chapter,
  ayah,
  edition,
}: {
  chapter: number;
  ayah: number;
  edition: string;
}): Promise<TafsirSourceResult | null> {
  try {
    const { response, data } = await fetchJsonWithTimeout(
      `https://api.alquran.cloud/v1/ayah/${chapter}:${ayah}/${edition}`,
    );

    const tafsir = cleanTafsirText(data?.data?.text || "");
    if (!response.ok || isBadTafsir(tafsir)) return null;

    return { tafsir, source: "alquran.cloud" };
  } catch (error) {
    console.warn("TAFSIR_ALQURAN_CLOUD_FAILED:", error);
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("sources") === "1") {
    return NextResponse.json({
      success: true,
      sources: Object.entries(TAFSIR_SOURCES).map(([id, item]) => ({
        id,
        label: item.label,
      })),
    });
  }

  const chapter = Number(url.searchParams.get("chapter") || 0);
  const ayah = Number(url.searchParams.get("ayah") || 0);
  const requestedSource = String(url.searchParams.get("source") || "muyassar");

  if (!chapter || !ayah) {
    return NextResponse.json(
      { success: false, message: "chapter و ayah مطلوبين", tafsir: "" },
      { status: 400 },
    );
  }

  const sourceConfig = TAFSIR_SOURCES[requestedSource] || TAFSIR_SOURCES.muyassar;
  const cacheKey = `${requestedSource}:${chapter}:${ayah}`;
  const cached = tafsirCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.loadedAt < CACHE_DURATION_MS) {
    return NextResponse.json({
      success: true,
      chapter,
      ayah,
      source: "memory-cache",
      tafsirName: sourceConfig.label,
      tafsir: cached.tafsir,
      cached: true,
    });
  }

  const disjointKey = `${chapter}:${ayah}`;
  if (DISJOINT_LETTERS[disjointKey]) {
    const tafsir = DISJOINT_LETTERS[disjointKey];
    tafsirCache.set(cacheKey, { tafsir, loadedAt: now });
    return NextResponse.json({
      success: true,
      chapter,
      ayah,
      source: "local-disjoint-letters",
      tafsirName: sourceConfig.label,
      tafsir,
      cached: false,
    });
  }

  const attempts: Array<() => Promise<TafsirSourceResult | null>> = [];

  if (sourceConfig.quranComId) {
    attempts.push(() =>
      tryQuranCom({
        chapter,
        ayah,
        resourceId: sourceConfig.quranComId!,
      }),
    );
  }

  if (sourceConfig.quranTafseerId) {
    attempts.push(() =>
      tryQuranTafseer({
        chapter,
        ayah,
        tafsirId: sourceConfig.quranTafseerId!,
      }),
    );
  }

  if (sourceConfig.alQuranCloudEdition) {
    attempts.push(() =>
      tryAlQuranCloud({
        chapter,
        ayah,
        edition: sourceConfig.alQuranCloudEdition!,
      }),
    );
  }

  // Fallback order if the chosen source fails.
  for (const key of ["muyassar", "jalalayn", "muyassarCloud"]) {
    const fallback = TAFSIR_SOURCES[key];
    if (fallback === sourceConfig) continue;

    if (fallback.quranComId) {
      attempts.push(() =>
        tryQuranCom({
          chapter,
          ayah,
          resourceId: fallback.quranComId!,
        }),
      );
    }

    if (fallback.quranTafseerId) {
      attempts.push(() =>
        tryQuranTafseer({
          chapter,
          ayah,
          tafsirId: fallback.quranTafseerId!,
        }),
      );
    }
  }

  let result: TafsirSourceResult | null = null;

  for (const attempt of attempts) {
    result = await attempt();
    if (result?.tafsir) break;
  }

  if (!result?.tafsir) {
    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحميل التفسير من كل المصادر.",
        chapter,
        ayah,
        tafsirName: sourceConfig.label,
        tafsir: "",
      },
      { status: 200 },
    );
  }

  tafsirCache.set(cacheKey, { tafsir: result.tafsir, loadedAt: now });

  return NextResponse.json({
    success: true,
    chapter,
    ayah,
    source: result.source,
    tafsirName: sourceConfig.label,
    tafsir: result.tafsir,
    cached: false,
  });
}
