export type QuranAyah = {
  chapter: number;
  surahName: string;
  surahEnglishName: string;
  numberInSurah: number;
  text: string;
};

export type QuranScoreBreakdown = {
  exactTextMatch: number;
  looseMatch: number;
  matchedWordsBonus: number;
  famousVerseBoost: number;
  contextualQueryBoost: number;
  total: number;
};

export type QuranSearchResult = QuranAyah & {
  score: number;
  matchedWords: string[];
  reason: string;
  scoreBreakdown: QuranScoreBreakdown;
  detectedTopics: string[];
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

const SEMANTIC_ALIASES: Record<string, string[]> = {
  الصيام: ["الصيام", "صيام", "الصوم", "صوم", "رمضان", "تصوموا", "فليصمه"],
  صيام: ["الصيام", "صيام", "الصوم", "صوم", "رمضان", "تصوموا", "فليصمه"],
  رمضان: ["رمضان", "الصيام", "الصوم", "تصوموا", "فليصمه"],

  الصبر: [
    "الصبر",
    "صبر",
    "الصابرين",
    "اصبر",
    "واصبر",
    "صابرو",
    "ابتلاء",
    "بلاء",
  ],
  صبر: ["الصبر", "صبر", "الصابرين", "اصبر", "واصبر", "صابرو", "ابتلاء", "بلاء"],
  ابتلاء: ["صبر", "الصابرين", "نبلو", "بلاء", "مصيبه", "العسر", "اليسر"],

  الرزق: ["رزق", "يرزق", "يرزقه", "الرزاق", "رزقناهم", "رزقا", "توكل", "يتوكل"],
  رزق: ["رزق", "يرزق", "يرزقه", "الرزاق", "رزقناهم", "رزقا", "توكل", "يتوكل"],
  الفقر: ["رزق", "يرزقه", "الرزاق", "غني", "يفتح", "فضل"],

  الدعاء: ["دعاء", "ادعوني", "دعان", "الداع", "اجيب", "قريب", "اسال", "ربنا"],
  دعاء: ["دعاء", "ادعوني", "دعان", "الداع", "اجيب", "قريب", "اسال", "ربنا"],

  التوبة: ["توبه", "توبوا", "التواب", "تاب", "يتوب", "متاب", "غفر", "يغفر"],
  توبة: ["توبه", "توبوا", "التواب", "تاب", "يتوب", "متاب", "غفر", "يغفر"],
  الذنوب: ["ذنوب", "اسرفوا", "يغفر", "الغفور", "رحمه", "توبوا", "التواب"],
  ذنوب: ["ذنوب", "اسرفوا", "يغفر", "الغفور", "رحمه", "توبوا", "التواب"],

  الاستغفار: ["استغفر", "استغفروا", "غفار", "غفور", "يغفر"],
  استغفار: ["استغفر", "استغفروا", "غفار", "غفور", "يغفر"],

  الرحمة: ["رحمه", "رحيم", "ارحم", "يرحم", "الراحمين", "الغفور"],
  رحمة: ["رحمه", "رحيم", "ارحم", "يرحم", "الراحمين", "الغفور"],
  المغفرة: ["مغفره", "غفر", "يغفر", "غفور", "الغفار", "رحمه"],

  الخوف: ["خوف", "خاف", "تخافوا", "خائفين", "فزع", "امن", "سكينه"],
  خوف: ["خوف", "خاف", "تخافوا", "خائفين", "فزع", "امن", "سكينه"],
  القلق: ["تطمئن", "القلوب", "سكينه", "تحزن", "خوف", "امن", "ذكر"],
  قلق: ["تطمئن", "القلوب", "سكينه", "تحزن", "خوف", "امن", "ذكر"],

  الحزن: ["حزن", "تحزن", "يحزنون", "الحزن", "ضيق", "العسر", "اليسر", "شرح"],
  حزن: ["حزن", "تحزن", "يحزنون", "الحزن", "ضيق", "العسر", "اليسر", "شرح"],
  الضيق: ["ضيق", "شرح", "صدرك", "العسر", "اليسر", "تحزن"],
  ضيق: ["ضيق", "شرح", "صدرك", "العسر", "اليسر", "تحزن"],

  الطمأنينة: ["تطمئن", "القلوب", "سكينه", "ذكر", "طمأنينه", "امن"],
  طمأنينة: ["تطمئن", "القلوب", "سكينه", "ذكر", "طمأنينه", "امن"],
  الراحة: ["تطمئن", "القلوب", "سكينه", "ذكر", "شرح", "اليسر"],
  راحة: ["تطمئن", "القلوب", "سكينه", "ذكر", "شرح", "اليسر"],
  النفسية: ["تطمئن", "القلوب", "سكينه", "ذكر", "شرح", "تحزن"],
  "الراحة النفسية": [
    "تطمئن",
    "القلوب",
    "سكينه",
    "ذكر",
    "شرح",
    "العسر",
    "اليسر",
  ],

  الجنة: ["الجنه", "جنه", "النعيم", "الفردوس", "جنات", "انهار"],
  جنة: ["الجنه", "جنه", "النعيم", "الفردوس", "جنات", "انهار"],

  النار: ["النار", "جهنم", "العذاب", "سعير", "الجحيم"],
  جهنم: ["النار", "جهنم", "العذاب", "سعير", "الجحيم"],

  الموت: ["الموت", "موت", "تموتن", "الاجل", "الاخرة", "القيامه"],
  موت: ["الموت", "موت", "تموتن", "الاجل", "الاخرة", "القيامه"],
  الآخرة: ["الاخره", "الاخرة", "القيامه", "الحساب", "الجنه", "النار"],

  الصلاة: ["الصلاه", "صلوه", "اقم", "اقيموا", "الفجر", "قيام", "اسجد"],
  صلاة: ["الصلاه", "صلوه", "اقم", "اقيموا", "الفجر", "قيام", "اسجد"],

  الوالدين: ["الوالدين", "والديه", "الام", "الأم", "الاب", "الأب", "احسانا"],
  الأم: ["الوالدين", "والديه", "الام", "الأم", "احسانا", "ارحمهما"],
  الاب: ["الوالدين", "والديه", "الاب", "الأب", "احسانا", "ارحمهما"],

  الظلم: ["ظلم", "الظالمين", "يظلم", "ظلموا", "حسبنا", "وكيل"],
  ظلم: ["ظلم", "الظالمين", "يظلم", "ظلموا", "حسبنا", "وكيل"],

  النجاح: ["سعي", "سعى", "عمل", "اعملوا", "يوفق", "فضل", "توكل"],
  نجاح: ["سعي", "سعى", "عمل", "اعملوا", "يوفق", "فضل", "توكل"],
  السعي: ["سعي", "سعى", "عمل", "اعملوا", "توكل"],

  الوحدة: ["معكم", "معنا", "قريب", "وحده", "تحزن", "ان الله معنا"],
  وحيد: ["معكم", "معنا", "قريب", "تحزن", "ان الله معنا"],
  وحشة: ["معكم", "معنا", "قريب", "تحزن", "ان الله معنا"],

  الزواج: ["ازواج", "زوج", "مودّه", "رحمه", "نساء", "سكن"],
  زواج: ["ازواج", "زوج", "مودّه", "رحمه", "نساء", "سكن"],

  القرآن: ["القران", "القرآن", "كتاب", "ذكر", "هدى", "شفاء", "نور"],
  قران: ["القران", "القرآن", "كتاب", "ذكر", "هدى", "شفاء", "نور"],
  الهداية: ["هدى", "يهدي", "اهتدى", "نور", "صراط", "مستقيم"],
  هداية: ["هدى", "يهدي", "اهتدى", "نور", "صراط", "مستقيم"],

  الشفاء: ["شفاء", "يشفي", "مرض", "رحمه", "القران"],
  مرض: ["مرض", "مريض", "يشفي", "شفاء", "رحمه"],
};

const HIGH_VALUE_WORDS = new Set([
  "تطمئن",
  "القلوب",
  "تحزن",
  "العسر",
  "اليسر",
  "شرح",
  "رحمه",
  "يغفر",
  "الغفور",
  "رزق",
  "يرزقه",
  "ادعوني",
  "قريب",
  "الصيام",
  "رمضان",
  "الجنه",
  "النار",
  "جهنم",
  "الصابرين",
  "التواب",
  "توبوا",
  "اسرفوا",
  "هدى",
  "يهدي",
  "نور",
  "شفاء",
  "معنا",
  "معكم",
]);

const MEDIUM_VALUE_WORDS = new Set([
  "صبر",
  "صيام",
  "صوم",
  "دعاء",
  "غفر",
  "خوف",
  "امن",
  "سكينه",
  "ذكر",
  "ضيق",
  "حزن",
  "رزقا",
  "توكل",
  "الفردوس",
  "جنات",
  "العذاب",
  "القيامه",
  "الصلاه",
  "الفجر",
  "احسانا",
  "ظلم",
  "سعي",
  "عمل",
  "ازواج",
  "مودّه",
]);

const FAMOUS_VERSE_BOOSTS: Record<string, number> = {
  "2:183": 18,
  "2:184": 8,
  "2:185": 16,
  "2:186": 20,
  "2:286": 18,
  "3:159": 10,
  "3:160": 10,
  "3:185": 12,
  "9:40": 24,
  "13:28": 28,
  "17:23": 16,
  "17:24": 16,
  "17:78": 12,
  "17:79": 12,
  "39:53": 30,
  "65:2": 22,
  "65:3": 24,
  "66:8": 18,
  "71:10": 14,
  "71:11": 14,
  "71:12": 14,
  "89:27": 14,
  "89:28": 14,
  "89:29": 14,
  "89:30": 14,
  "94:1": 16,
  "94:2": 12,
  "94:3": 12,
  "94:4": 12,
  "94:5": 24,
  "94:6": 24,
};

export async function loadQuranAyahs() {
  const now = Date.now();

  if (quranCache && now - quranCacheLoadedAt < CACHE_DURATION_MS) {
    return quranCache;
  }

  const response = await fetch(
    "https://api.alquran.cloud/v1/quran/quran-uthmani",
    { cache: "no-store" },
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

export function searchQuranText(
  ayahs: QuranAyah[],
  rawQuery: string,
  limit = 10,
): {
  query: string;
  searchWords: string[];
  results: QuranSearchResult[];
} {
  const query = rawQuery.trim();
  const searchWords = extractSearchWords(query);

  if (searchWords.length === 0) {
    return { query, searchWords: [], results: [] };
  }

  const normalizedSearchWords = searchWords
    .map(normalizeArabic)
    .filter((word) => word.length >= 3);

  const originalQueryWords = normalizeArabic(query)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  const detectedTopics = detectTopics(query);
  const results: QuranSearchResult[] = [];

  for (const ayah of ayahs) {
    const normalizedText = normalizeArabic(ayah.text);
    const textWords = normalizedText.split(" ").filter(Boolean);

    const breakdown: QuranScoreBreakdown = {
      exactTextMatch: 0,
      looseMatch: 0,
      matchedWordsBonus: 0,
      famousVerseBoost: 0,
      contextualQueryBoost: 0,
      total: 0,
    };

    const matchedWords: string[] = [];

    for (const word of normalizedSearchWords) {
      const wordWeight = getSearchWordWeight(
        word,
        normalizedSearchWords,
        originalQueryWords,
      );

      if (normalizedText.includes(word)) {
        breakdown.exactTextMatch += 15 * wordWeight;
        matchedWords.push(word);
        continue;
      }

      const strippedSearchWord = stripArabicAffixes(word);

      const looseMatch = textWords.some((textWord) => {
        if (textWord.length < 3 || strippedSearchWord.length < 3) {
          return false;
        }

        const strippedTextWord = stripArabicAffixes(textWord);
        return strippedTextWord === strippedSearchWord;
      });

      if (looseMatch) {
        breakdown.looseMatch += 6 * wordWeight;
        matchedWords.push(word);
      }
    }

    const uniqueMatchedWords = Array.from(new Set(matchedWords));

    if (uniqueMatchedWords.length === 0) continue;

    breakdown.matchedWordsBonus = uniqueMatchedWords.length * 3;
    breakdown.famousVerseBoost = getFamousVerseBoost(ayah);
    breakdown.contextualQueryBoost = getContextualQueryBoost(
      query,
      ayah,
      uniqueMatchedWords,
    );

    breakdown.total =
      breakdown.exactTextMatch +
      breakdown.looseMatch +
      breakdown.matchedWordsBonus +
      breakdown.famousVerseBoost +
      breakdown.contextualQueryBoost;

    if (breakdown.total < 8) continue;

    const roundedBreakdown: QuranScoreBreakdown = {
      exactTextMatch: Math.round(breakdown.exactTextMatch),
      looseMatch: Math.round(breakdown.looseMatch),
      matchedWordsBonus: Math.round(breakdown.matchedWordsBonus),
      famousVerseBoost: Math.round(breakdown.famousVerseBoost),
      contextualQueryBoost: Math.round(breakdown.contextualQueryBoost),
      total: Math.round(breakdown.total),
    };

    results.push({
      ...ayah,
      score: roundedBreakdown.total,
      matchedWords: uniqueMatchedWords,
      reason: buildReason(uniqueMatchedWords, ayah, query, roundedBreakdown),
      scoreBreakdown: roundedBreakdown,
      detectedTopics,
    });
  }

  const deduped = dedupeNearbyResults(results);

  return {
    query,
    searchWords,
    results: deduped
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.matchedWords.length !== a.matchedWords.length) {
          return b.matchedWords.length - a.matchedWords.length;
        }
        return a.chapter - b.chapter || a.numberInSurah - b.numberInSurah;
      })
      .slice(0, limit),
  };
}

export function extractSearchWords(query: string) {
  const normalizedQuery = normalizeArabic(query);

  const directWords = normalizedQuery
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  const expandedWords = new Set<string>(directWords);

  for (const word of directWords) {
    const aliases =
      SEMANTIC_ALIASES[word] || SEMANTIC_ALIASES[stripArabicAffixes(word)];

    if (aliases) {
      for (const alias of aliases) {
        expandedWords.add(normalizeArabic(alias));
      }
    }
  }

  for (const [phrase, aliases] of Object.entries(SEMANTIC_ALIASES)) {
    const normalizedPhrase = normalizeArabic(phrase);

    if (
      normalizedPhrase.includes(" ") &&
      normalizedQuery.includes(normalizedPhrase)
    ) {
      for (const alias of aliases) {
        expandedWords.add(normalizeArabic(alias));
      }
    }
  }

  return Array.from(expandedWords).filter(Boolean);
}

function detectTopics(query: string) {
  const normalizedQuery = normalizeArabic(query);
  const topics: string[] = [];

  for (const topic of Object.keys(SEMANTIC_ALIASES)) {
    const normalizedTopic = normalizeArabic(topic);

    if (normalizedQuery.includes(normalizedTopic)) {
      topics.push(topic);
    }
  }

  return Array.from(new Set(topics));
}

function getSearchWordWeight(
  word: string,
  allWords: string[],
  originalQueryWords: string[],
) {
  if (originalQueryWords.includes(word)) return 3.2;
  if (HIGH_VALUE_WORDS.has(word)) return 3;
  if (MEDIUM_VALUE_WORDS.has(word)) return 1.8;
  if (allWords.length > 7 && word.length <= 3) return 0.4;
  if (word.length <= 3) return 0.8;
  return 1;
}

function getFamousVerseBoost(ayah: QuranAyah) {
  return FAMOUS_VERSE_BOOSTS[`${ayah.chapter}:${ayah.numberInSurah}`] || 0;
}

function getContextualQueryBoost(
  query: string,
  ayah: QuranAyah,
  matchedWords: string[],
) {
  const normalizedQuery = normalizeArabic(query);
  let boost = 0;

  if (
    includesAny(normalizedQuery, [
      "حزن",
      "الحزن",
      "ضيق",
      "مخنوق",
      "الراحه",
      "الراحة",
      "قلق",
    ]) &&
    isAyah(ayah, 13, 28)
  )
    boost += 35;

  if (
    includesAny(normalizedQuery, ["حزن", "الحزن", "ضيق", "مخنوق"]) &&
    ayah.chapter === 94
  )
    boost += 28;

  if (
    includesAny(normalizedQuery, [
      "حزن",
      "وحيد",
      "وحده",
      "الوحده",
      "الوحدة",
      "خوف",
    ]) &&
    isAyah(ayah, 9, 40)
  )
    boost += 34;

  if (
    includesAny(normalizedQuery, [
      "ذنوب",
      "ذنب",
      "التوبه",
      "التوبة",
      "مغفره",
      "المغفرة",
    ]) &&
    isAyah(ayah, 39, 53)
  )
    boost += 38;

  if (
    includesAny(normalizedQuery, ["رزق", "الرزق", "فقر", "المال", "الشغل"]) &&
    ayah.chapter === 65 &&
    [2, 3].includes(ayah.numberInSurah)
  )
    boost += 30;

  if (
    includesAny(normalizedQuery, ["دعاء", "الدعاء", "ادعي", "يارب"]) &&
    isAyah(ayah, 2, 186)
  )
    boost += 32;

  if (
    includesAny(normalizedQuery, ["صيام", "الصيام", "رمضان"]) &&
    ayah.chapter === 2 &&
    [183, 184, 185, 187].includes(ayah.numberInSurah)
  )
    boost += 28;

  if (
    includesAny(normalizedQuery, [
      "والدين",
      "الوالدين",
      "امي",
      "أمي",
      "ابويا",
      "ابي",
    ]) &&
    ayah.chapter === 17 &&
    [23, 24].includes(ayah.numberInSurah)
  )
    boost += 28;

  if (
    includesAny(normalizedQuery, ["جنه", "الجنه", "جنة", "الجنة"]) &&
    ayah.chapter === 89 &&
    ayah.numberInSurah >= 27 &&
    ayah.numberInSurah <= 30
  )
    boost += 26;

  if (matchedWords.length >= 3) boost += 10;

  return boost;
}

function buildReason(
  matchedWords: string[],
  ayah: QuranAyah,
  query: string,
  breakdown: QuranScoreBreakdown,
) {
  const parts = [`تطابق مع: ${matchedWords.join("، ")}`];

  if (breakdown.famousVerseBoost > 0) {
    parts.push("آية مؤثرة ومناسبة للريل");
  }

  if (breakdown.contextualQueryBoost > 0) {
    parts.push("مرتبطة بمعنى البحث");
  }

  parts.push(
    `Score: exact ${breakdown.exactTextMatch}, loose ${breakdown.looseMatch}, famous ${breakdown.famousVerseBoost}, context ${breakdown.contextualQueryBoost}`,
  );

  return parts.join(" • ");
}

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(normalizeArabic(word)));
}

function isAyah(ayah: QuranAyah, chapter: number, numberInSurah: number) {
  return ayah.chapter === chapter && ayah.numberInSurah === numberInSurah;
}

function dedupeNearbyResults(results: QuranSearchResult[]) {
  const sorted = [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chapter - b.chapter || a.numberInSurah - b.numberInSurah;
  });

  const used = new Set<string>();
  const deduped: QuranSearchResult[] = [];

  for (const result of sorted) {
    const key = `${result.chapter}-${result.numberInSurah}`;
    if (used.has(key)) continue;

    deduped.push(result);
    used.add(key);
  }

  return deduped;
}

export function normalizeArabic(value: string) {
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

export function stripArabicAffixes(value: string) {
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
