import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuranAyah = {
  chapter: number;
  surahName: string;
  surahEnglishName: string;
  numberInSurah: number;
  text: string;
};

type ScoredAyah = QuranAyah & {
  score: number;
  matchedWords: string[];
};

let quranCache: QuranAyah[] | null = null;
let quranCacheLoadedAt = 0;

const CACHE_DURATION_MS = 1000 * 60 * 60 * 12;

const STOP_WORDS = new Set([
  "عن",
  "في",
  "من",
  "الى",
  "إلى",
  "على",
  "علي",
  "ايه",
  "آيه",
  "اية",
  "آية",
  "ايات",
  "آيات",
  "قران",
  "القران",
  "القرآن",
  "ريل",
  "فيديو",
  "اعمل",
  "اعمللي",
  "هات",
  "جيب",
  "عايز",
  "عاوزه",
  "اريد",
  "أريد",
  "ممكن",
  "قصير",
]);

const TOPIC_HINTS: Record<
  string,
  {
    words: string[];
    title: string;
    backgroundStyle: string;
    progressColor: string;
  }
> = {
  الصيام: {
    words: ["الصيام", "صيام", "الصوم", "صوم", "رمضان", "الشهر", "تصوموا"],
    title: "آيات عن الصيام",
    backgroundStyle: "mosque",
    progressColor: "#34d399",
  },
  صيام: {
    words: ["الصيام", "صيام", "الصوم", "صوم", "رمضان", "الشهر", "تصوموا"],
    title: "آيات عن الصيام",
    backgroundStyle: "mosque",
    progressColor: "#34d399",
  },
  رمضان: {
    words: ["رمضان", "الصيام", "تصوموا", "الشهر"],
    title: "آيات عن رمضان والصيام",
    backgroundStyle: "mosque",
    progressColor: "#34d399",
  },
  الدعاء: {
    words: ["ادعوني", "دعان", "الداع", "دعاء", "قريب", "اجيب"],
    title: "آيات عن الدعاء",
    backgroundStyle: "mosque",
    progressColor: "#34d399",
  },
  الصبر: {
    words: ["الصبر", "صبر", "الصابرين", "واصبر", "صابروا"],
    title: "آيات عن الصبر",
    backgroundStyle: "rain",
    progressColor: "#34d399",
  },
  الرزق: {
    words: ["رزق", "يرزقه", "الرزاق", "رزقناهم", "رزقا"],
    title: "آيات عن الرزق",
    backgroundStyle: "nature",
    progressColor: "#fbbf24",
  },
  التوبة: {
    words: ["توبوا", "التواب", "التوبة", "تاب", "يتوب"],
    title: "آيات عن التوبة",
    backgroundStyle: "night",
    progressColor: "#34d399",
  },
  الاستغفار: {
    words: ["استغفروا", "استغفر", "غفارا", "يغفر", "غفور"],
    title: "آيات عن الاستغفار",
    backgroundStyle: "clouds",
    progressColor: "#6ee7b7",
  },
  الطمأنينة: {
    words: ["تطمئن", "القلوب", "السكينة", "طمأنينة", "ذكر"],
    title: "آيات عن الطمأنينة",
    backgroundStyle: "nature",
    progressColor: "#34d399",
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt || "").trim();

    if (!prompt) {
      return NextResponse.json(
        { message: "اكتب وصف الريل المطلوب أولًا" },
        { status: 400 },
      );
    }

    const ayahs = await getQuranAyahs();
    const searchWords = getSearchWords(prompt);

    if (searchWords.length === 0) {
      return NextResponse.json(
        { message: "اكتب موضوع أو كلمة أو جزء من آية للبحث عنها" },
        { status: 400 },
      );
    }

    const matches = searchQuran(ayahs, searchWords);

    if (matches.length === 0) {
      return NextResponse.json(
        {
          message:
            "لم أجد آيات مطابقة لكلماتك. جرب تكتب كلمة أوضح أو جزء من الآية نفسها.",
          prompt,
          searchWords,
          suggestions: [],
        },
        { status: 404 },
      );
    }

    const hint = getBestTopicHint(prompt, searchWords);
    const suggestions = buildSuggestions(ayahs, matches, hint).slice(0, 7);

    return NextResponse.json({
      title:
        hint?.title || `نتائج البحث عن ${searchWords.slice(0, 3).join(" و ")}`,
      reason: "تم عرض أكثر من موضع مطابق من نص القرآن لتختار الأنسب للريل.",
      prompt,
      searchWords,
      suggestions,
      source: "quran-text-search",
      message: `تم العثور على ${suggestions.length} اقتراحات من نص القرآن`,
    });
  } catch (error: any) {
    console.error("AI_REEL_SEARCH_ERROR:", error);

    return NextResponse.json(
      {
        message: "حدث خطأ أثناء البحث في الآيات",
        error: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}

async function getQuranAyahs() {
  const now = Date.now();

  if (quranCache && now - quranCacheLoadedAt < CACHE_DURATION_MS) {
    return quranCache;
  }

  const response = await fetch(
    "https://api.alquran.cloud/v1/quran/quran-uthmani",
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("فشل تحميل نص القرآن");
  }

  const data = await response.json();
  const surahs = data.data?.surahs || [];
  const ayahs: QuranAyah[] = [];

  for (const surah of surahs) {
    for (const ayah of surah.ayahs || []) {
      ayahs.push({
        chapter: Number(surah.number),
        surahName: cleanSurahName(String(surah.name || "")),
        surahEnglishName: String(surah.englishName || ""),
        numberInSurah: Number(ayah.numberInSurah),
        text: String(ayah.text || ""),
      });
    }
  }

  quranCache = ayahs;
  quranCacheLoadedAt = now;

  return ayahs;
}

function searchQuran(ayahs: QuranAyah[], searchWords: string[]) {
  const normalizedSearchWords = searchWords
    .map(normalizeArabic)
    .filter((word) => word.length >= 3);

  const results: ScoredAyah[] = [];

  for (const ayah of ayahs) {
    const normalizedText = normalizeArabic(ayah.text);
    const textWords = normalizedText.split(" ").filter(Boolean);

    let score = 0;
    const matchedWords: string[] = [];

    for (const word of normalizedSearchWords) {
      if (normalizedText.includes(word)) {
        score += 12;
        matchedWords.push(word);
        continue;
      }

      const looseMatch = textWords.some((textWord) => {
        if (textWord.length < 3 || word.length < 3) return false;

        const strippedTextWord = stripArabicAffixes(textWord);
        const strippedSearchWord = stripArabicAffixes(word);

        return (
          strippedTextWord === strippedSearchWord ||
          strippedTextWord.includes(strippedSearchWord) ||
          strippedSearchWord.includes(strippedTextWord)
        );
      });

      if (looseMatch) {
        score += 5;
        matchedWords.push(word);
      }
    }

    if (score > 0) {
      results.push({
        ...ayah,
        score,
        matchedWords: Array.from(new Set(matchedWords)),
      });
    }
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchedWords.length !== a.matchedWords.length) {
      return b.matchedWords.length - a.matchedWords.length;
    }
    return a.chapter - b.chapter || a.numberInSurah - b.numberInSurah;
  });
}

function buildSuggestions(
  ayahs: QuranAyah[],
  matches: ScoredAyah[],
  hint: {
    words: string[];
    title: string;
    backgroundStyle: string;
    progressColor: string;
  } | null,
) {
  const used = new Set<string>();
  const suggestions = [];

  for (const match of matches) {
    const range = buildSmallRange(matches, match);
    const id = `${match.chapter}-${range.fromAyah}-${range.toAyah}`;

    if (used.has(id)) continue;
    used.add(id);

    suggestions.push({
      id,
      title: hint?.title || `اقتراح من سورة ${match.surahName}`,
      reason: `مطابقة مباشرة في سورة ${match.surahName} آية ${match.numberInSurah}.`,
      chapter: String(match.chapter),
      surahName: match.surahName,
      fromAyah: String(range.fromAyah),
      toAyah: String(range.toAyah),
      matchedAyahNumber: String(match.numberInSurah),
      matchedAyahText: match.text,
      matchedWords: match.matchedWords,
      score: match.score,
      backgroundStyle: hint?.backgroundStyle || chooseBackground(match.text),
      textColor: "#ffffff",
      progressColor: hint?.progressColor || "#34d399",
      textPosition: "center",
      animationStyle: "slide",
      wordSpeed: "normal",
      showSurahName: true,
      showReciterName: true,
      showBrandName: true,
      showProgressBar: true,
      showCountdownTimer: true,
    });
  }

  return suggestions;
}

function buildSmallRange(matches: ScoredAyah[], best: ScoredAyah) {
  if (
    best.chapter === 2 &&
    best.numberInSurah >= 183 &&
    best.numberInSurah <= 185
  ) {
    return { fromAyah: 183, toAyah: 185 };
  }

  const sameSurahNearMatches = matches
    .filter(
      (item) =>
        item.chapter === best.chapter &&
        Math.abs(item.numberInSurah - best.numberInSurah) <= 2,
    )
    .slice(0, 3);

  if (sameSurahNearMatches.length > 1) {
    return {
      fromAyah: Math.min(
        ...sameSurahNearMatches.map((item) => item.numberInSurah),
      ),
      toAyah: Math.max(
        ...sameSurahNearMatches.map((item) => item.numberInSurah),
      ),
    };
  }

  return {
    fromAyah: best.numberInSurah,
    toAyah: best.numberInSurah,
  };
}

function getSearchWords(prompt: string) {
  const normalizedPrompt = normalizeArabic(prompt);
  const directWords = normalizedPrompt
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  const hint = getBestTopicHint(prompt, directWords);

  if (hint) {
    return Array.from(new Set([...hint.words, ...directWords]));
  }

  return Array.from(new Set(directWords));
}

function getBestTopicHint(prompt: string, directWords: string[]) {
  const normalizedPrompt = normalizeArabic(prompt);
  const allWords = directWords.map(normalizeArabic);

  let bestHint: {
    words: string[];
    title: string;
    backgroundStyle: string;
    progressColor: string;
  } | null = null;
  let bestScore = 0;

  for (const [topic, hint] of Object.entries(TOPIC_HINTS)) {
    const normalizedTopic = normalizeArabic(topic);
    let score = 0;

    if (normalizedPrompt.includes(normalizedTopic)) score += 20;

    for (const word of hint.words) {
      const normalizedWord = normalizeArabic(word);
      if (normalizedPrompt.includes(normalizedWord)) score += 10;
      if (allWords.includes(normalizedWord)) score += 8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestHint = hint;
    }
  }

  return bestScore > 0 ? bestHint : null;
}

function chooseBackground(value: string) {
  const text = normalizeArabic(value);

  if (text.includes("صبر") || text.includes("حزن")) return "rain";
  if (text.includes("ليل") || text.includes("خوف") || text.includes("توب"))
    return "night";
  if (text.includes("رزق") || text.includes("قلب")) return "nature";
  if (text.includes("رحمه") || text.includes("مغفر")) return "clouds";

  return "mosque";
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْٰـۖۗۘۙۚۛۜ۝۞]/g, "")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripArabicAffixes(value: string) {
  return value
    .replace(/^(وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/u, "")
    .replace(/(ون|ين|ان|ات|ه|ها|هم|كم|نا|وا|ا)$/u, "");
}

function cleanSurahName(name: string) {
  return name
    .replace(/^\s*سورة\s+/u, "")
    .replace(/^\s*سُورَةُ\s+/u, "")
    .replace(/^\s*سُورَة\s+/u, "")
    .trim();
}
