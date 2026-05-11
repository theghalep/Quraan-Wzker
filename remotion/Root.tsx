import { Composition, registerRoot } from "remotion";
import Video from "./Video";

const FPS = 30;

type AyahItem = {
  text: string;
  audio: string;
  duration?: number;
  numberInSurah?: number;
};

type QuranReelProps = {
  ayahs: AyahItem[];

  textColor: string;
  textSize: number;
  backgroundStyle: string;
  backgroundVideoUrl: string;
  backgroundType: string;
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
  fontFamily: string;

  showSurahName: boolean;
  surahName: string;

  showReciterName: boolean;
  reciter: string;

  showBrandName: boolean;
  brandName: string;

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
  fontFamily: "Amiri",

  showSurahName: true,
  surahName: "الفاتحة",

  showReciterName: true,
  reciter: "مشاري العفاسي",

  showBrandName: true,
  brandName: "وذكر | wzkerq",

  showProgressBar: true,
  showCountdownTimer: true,
  progressColor: "#34d399",
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

        const exportFps = Math.min(
          Math.max(Number((props as any).exportFps || FPS), 24),
          60,
        );
        const exportWidth = makeEven(
          Math.min(
            Math.max(Number((props as any).exportWidth || 1080), 360),
            3840,
          ),
        );
        const exportHeight = makeEven(
          Math.min(
            Math.max(Number((props as any).exportHeight || 1920), 360),
            3840,
          ),
        );

        const durationInFrames =
          ayahs.length > 0
            ? Math.max(
                Math.ceil(
                  ayahs.reduce((total: number, ayah: AyahItem) => {
                    return total + (ayah.duration || 5);
                  }, 0) * exportFps,
                ),
                Math.ceil(5 * exportFps),
              )
            : Math.ceil(10 * exportFps);

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

function makeEven(value: number) {
  return value % 2 === 0 ? value : value + 1;
}

registerRoot(RemotionRoot);
