import { Composition, registerRoot } from "remotion";
import Video from "./Video";

const FPS = 30;

type AyahItem = {
  text: string;
  audio?: string;
  duration?: number;
  numberInSurah?: number;
};

type QuranReelProps = {
  ayahs: AyahItem[];

  textColor: string;
  textSize: number;
  fontFamily: string;

  backgroundStyle: string;
  backgroundVideoUrl: string;
  backgroundType: "video" | "image";
  isRemotionRender: boolean;

  exportPreset?: string;
  exportQuality?: string;
  exportWidth?: number;
  exportHeight?: number;
  exportFps?: number;
  renderScale?: number;

  textPosition: string;
  animationStyle: string;
  wordSpeed: string;

  showWordHighlight?: boolean;
  wordHighlightColor?: string;
  wordHighlightGlowColor?: string;
  wordDimColor?: string;
  wordHighlightStyle?: string;
  wordHighlightTransition?: string;
  wordHighlightSpeed?: number;
  wordHighlightOffset?: number;
  wordHighlightHold?: number;
  wordHighlightMode?: string;
  manualWordTimings?: Record<string, Array<number | null>>;

  showBismillahIntro?: boolean;
  bismillahAudioUrl?: string;
  bismillahDuration?: number;

  showSurahName: boolean;
  surahName: string;
  surahNameColor?: string;
  surahNameSize?: number;
  surahNamePosition?: string;

  showReciterName: boolean;
  reciter: string;
  reciterNameColor?: string;
  reciterNameSize?: number;
  reciterNamePosition?: string;

  showBrandName: boolean;
  brandName: string;
  brandNameColor?: string;
  brandNameSize?: number;
  brandNamePosition?: string;
  brandNameStyle?: string;

  showProgressBar: boolean;
  showCountdownTimer: boolean;
  progressColor: string;
  timerColor: string;
  progressPosition: string;
  timerPosition: string;
  progressHeight: number;
  timerSize: number;
};

const defaultProps: QuranReelProps = {
  ayahs: [
    {
      text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      audio: "",
      duration: 5,
      numberInSurah: 1,
    },
  ],

  textColor: "#ffffff",
  textSize: 72,
  fontFamily: "KFGQPC Uthmanic Script HAFS",

  backgroundStyle: "emerald",
  backgroundVideoUrl: "",
  backgroundType: "video",
  isRemotionRender: true,

  exportPreset: "reels",
  exportQuality: "high",
  exportWidth: 1080,
  exportHeight: 1920,
  exportFps: 30,
  renderScale: 1,

  textPosition: "center",
  animationStyle: "slide",
  wordSpeed: "normal",

  showWordHighlight: true,
  wordHighlightColor: "#facc15",
  wordHighlightGlowColor: "#facc15",
  wordDimColor: "rgba(255,255,255,0.66)",
  wordHighlightStyle: "gold",
  wordHighlightTransition: "scale",
  wordHighlightSpeed: 1,
  wordHighlightOffset: 0,
  wordHighlightHold: 0.12,
  wordHighlightMode: "smart",
  manualWordTimings: {},

  showBismillahIntro: true,
bismillahAudioUrl: "",
  bismillahDuration: 3.2,

  showSurahName: true,
  surahName: "الفاتحة",
  surahNameColor: "#ffffff",
  surahNameSize: 30,
  surahNamePosition: "top",

  showReciterName: true,
  reciter: "مشاري العفاسي",
  reciterNameColor: "#facc15",
  reciterNameSize: 28,
  reciterNamePosition: "bottom",

  showBrandName: true,
  brandName: "وذكر | wzkerq",
  brandNameColor: "#ffffff",
  brandNameSize: 24,
  brandNamePosition: "bottom",
  brandNameStyle: "glass",

  showProgressBar: true,
  showCountdownTimer: true,
  progressColor: "#facc15",
  timerColor: "#ffffff",
  progressPosition: "bottom",
  timerPosition: "bottom",
  progressHeight: 5,
  timerSize: 18,
};

function RemotionRoot() {
  return (
    <Composition
      id="QuranReel"
      component={Video}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={300}
      calculateMetadata={({ props }) => {
        const ayahs = Array.isArray(props.ayahs) ? props.ayahs : [];

        const exportFps = clampNumber(Number(props.exportFps || FPS), 24, 60);
        const exportWidth = makeEven(
          clampNumber(Number(props.exportWidth || 1080), 360, 3840),
        );
        const exportHeight = makeEven(
          clampNumber(Number(props.exportHeight || 1920), 360, 3840),
        );

        const durationSeconds = getDurationSecondsWithBismillahIntro({
          ayahs,
          showBismillahIntro: props.showBismillahIntro !== false,
          bismillahDuration: Number(props.bismillahDuration || 3.2),
        });

        const durationInFrames = Math.max(
          Math.ceil(durationSeconds * exportFps),
          Math.ceil(5 * exportFps),
        );

        return {
          durationInFrames,
          fps: exportFps,
          width: exportWidth,
          height: exportHeight,
          props: {
            ...props,
            exportFps,
            exportWidth,
            exportHeight,
            isRemotionRender: true,
          },
        };
      }}
      defaultProps={defaultProps}
    />
  );
}

function getDurationSecondsWithBismillahIntro({
  ayahs,
  showBismillahIntro,
  bismillahDuration,
}: {
  ayahs: AyahItem[];
  showBismillahIntro: boolean;
  bismillahDuration: number;
}) {
  const introDuration = Math.max(Number(bismillahDuration || 3.2), 1.8);
  const rawDurationSeconds =
    ayahs.length > 0
      ? ayahs.reduce((total: number, ayah: AyahItem) => {
          return total + Math.max(Number(ayah.duration || 5), 0.1);
        }, 0)
      : 10;

  if (!showBismillahIntro) {
    return rawDurationSeconds;
  }

  const firstText = ayahs[0]?.text || "";
  const normalizedFirst = normalizeArabicForBismillah(firstText);
  const normalizedBismillah = normalizeArabicForBismillah("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");

  if (!firstText) {
    return introDuration;
  }

  if (normalizedFirst === normalizedBismillah) {
    const restDuration = ayahs.slice(1).reduce((total: number, ayah: AyahItem) => {
      return total + Math.max(Number(ayah.duration || 5), 0.1);
    }, 0);

    return introDuration + restDuration;
  }

  if (normalizedFirst.startsWith(normalizedBismillah)) {
    return rawDurationSeconds;
  }

  return rawDurationSeconds + introDuration;
}

function normalizeArabicForBismillah(value: string) {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF]/g, "")
    .trim();
}

function makeEven(value: number) {
  const safeValue = Math.round(value);
  return safeValue % 2 === 0 ? safeValue : safeValue + 1;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

registerRoot(RemotionRoot);
