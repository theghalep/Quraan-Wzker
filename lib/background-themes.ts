export const BACKGROUND_THEMES: Record<string, string[]> = {
  الصيام: ["mosque"],
  صيام: ["mosque"],
  رمضان: ["mosque"],

  الدعاء: ["night"],
  دعاء: ["night"],

  الحزن: ["rain"],
  حزن: ["rain"],
  الضيق: ["rain"],

  الطمأنينة: ["nature"],
  الراحة: ["nature"],
  "الراحة النفسية": ["nature"],

  الرزق: ["nature"],

  التوبة: ["sunset"],
  الذنوب: ["sunset"],

  الجنة: ["nature"],
  النار: ["dark"],

  الوحدة: ["night"],
};

export function pickBackgroundFromTopics(topics: string[] = []) {
  for (const topic of topics) {
    const backgrounds = BACKGROUND_THEMES[topic];

    if (backgrounds?.length) {
      return backgrounds[Math.floor(Math.random() * backgrounds.length)];
    }
  }

  return null;
}
