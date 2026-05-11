const DEFAULT_BACKGROUND_STYLE = "mosque";

export const BACKGROUND_THEMES: Record<string, string[]> = {
  الصيام: ["mosque", "night"],
  صيام: ["mosque", "night"],
  رمضان: ["mosque", "night"],

  الدعاء: ["night", "mosque"],
  دعاء: ["night", "mosque"],
  القرب: ["night", "mosque"],

  الحزن: ["rain", "clouds", "night"],
  حزن: ["rain", "clouds", "night"],
  الضيق: ["rain", "clouds", "night"],
  ضيق: ["rain", "clouds", "night"],
  القلق: ["rain", "night"],
  الخوف: ["night", "rain"],

  الطمأنينة: ["nature", "night", "mosque"],
  طمأنينة: ["nature", "night", "mosque"],
  الراحة: ["nature", "rain"],
  "الراحة النفسية": ["nature", "rain"],
  السكينة: ["nature", "night"],

  الرزق: ["nature", "clouds"],
  رزق: ["nature", "clouds"],
  التوكل: ["nature", "clouds"],

  التوبة: ["sunset", "rain", "mosque"],
  توبة: ["sunset", "rain", "mosque"],
  الذنوب: ["sunset", "rain", "mosque"],
  ذنوب: ["sunset", "rain", "mosque"],
  الاستغفار: ["rain", "sunset", "mosque"],
  المغفرة: ["rain", "sunset", "mosque"],

  الجنة: ["nature", "clouds"],
  جنة: ["nature", "clouds"],
  النعيم: ["nature", "clouds"],

  النار: ["dark"],
  جهنم: ["dark"],
  العذاب: ["dark"],

  الوحدة: ["night", "rain"],
  وحيد: ["night", "rain"],
  وحشة: ["night", "rain"],

  الوالدين: ["mosque", "nature"],
  الزواج: ["nature", "mosque"],
  الصلاة: ["mosque", "night"],
  القرآن: ["mosque", "night"],
  الهداية: ["mosque", "clouds"],
  الشفاء: ["nature", "rain"],
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  الصيام: ["الصيام", "صيام", "الصوم", "صوم", "رمضان", "تصوموا", "فليصمه"],
  الدعاء: ["دعاء", "ادعوني", "دعان", "الداع", "اجيب", "قريب", "اسال", "ربنا"],
  الحزن: ["حزن", "تحزن", "يحزنون", "الحزن", "ضيق", "العسر", "اليسر", "شرح"],
  الخوف: ["خوف", "خاف", "تخافوا", "خائفين", "فزع", "امن", "سكينه"],
  الطمأنينة: ["تطمئن", "القلوب", "سكينه", "ذكر", "امن", "سلام"],
  الرزق: ["رزق", "يرزق", "يرزقه", "الرزاق", "رزقناهم", "رزقا", "توكل", "يتوكل"],
  التوبة: [
    "توبه",
    "توبوا",
    "التواب",
    "تاب",
    "يتوب",
    "متاب",
    "غفر",
    "يغفر",
    "الغفور",
    "استغفر",
  ],
  الجنة: ["الجنه", "جنه", "النعيم", "الفردوس", "جنات", "انهار"],
  النار: ["النار", "جهنم", "العذاب", "سعير", "الجحيم"],
  الوحدة: ["معكم", "معنا", "قريب", "وحده", "تحزن", "ان الله معنا"],
  الوالدين: ["الوالدين", "والديه", "الام", "الاب", "احسانا", "ارحمهما"],
  الزواج: ["ازواج", "زوج", "موده", "رحمه", "نساء", "سكن"],
  الصلاة: ["الصلاه", "صلوه", "اقم", "اقيموا", "الفجر", "قيام", "اسجد"],
  القرآن: ["القران", "كتاب", "ذكر", "هدى", "شفاء", "نور"],
  الهداية: ["هدى", "يهدي", "اهتدى", "نور", "صراط", "مستقيم"],
  الشفاء: ["شفاء", "يشفي", "مرض", "رحمه"],
};

export function pickBackgroundFromTopics(
  topics: string[] = [],
  fallback: string | null = null,
) {
  const cleanTopics = Array.from(
    new Set(topics.map((topic) => normalizeArabicText(topic)).filter(Boolean)),
  );

  for (const topic of cleanTopics) {
    const backgrounds = BACKGROUND_THEMES[topic];

    if (backgrounds?.length) {
      return pickStable(backgrounds, cleanTopics.join("|"));
    }
  }

  return fallback;
}

export function detectTopicsFromAyahText(text: string) {
  const normalizedText = normalizeArabicText(text);
  const detected: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hasMatch = keywords.some((keyword) => {
      const normalizedKeyword = normalizeArabicText(keyword);
      return (
        normalizedKeyword.length > 0 &&
        normalizedText.includes(normalizedKeyword)
      );
    });

    if (hasMatch) {
      detected.push(topic);
    }
  }

  return detected;
}

export function pickBackgroundFromAyahText(
  text: string,
  fallback: string | null = DEFAULT_BACKGROUND_STYLE,
) {
  return pickBackgroundFromTopics(detectTopicsFromAyahText(text), fallback);
}

function pickStable(items: string[], seed: string) {
  if (items.length === 1) return items[0];

  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return items[hash % items.length];
}

function normalizeArabicText(value: string) {
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
