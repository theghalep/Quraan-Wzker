"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type CaptionPage = {
  lines: Array<Array<{ word: string; originalIndex: number }>>;
};

type PreparedAyahRenderData = {
  sourceText: string;
  duration: number;
  fontSize: number;
  isLandscape: boolean;
  isSquare: boolean;
  highlightMode: string;
  highlightSpeed: number;
  words: string[];
  captionPages: CaptionPage[];
  wordStartTimes: number[];
};

type Ayah = {
  text: string;
  audio?: string;
  duration?: number;
  numberInSurah?: number;
  audioStartFromSeconds?: number;
  tafsir?: string;
  __isHookIntro?: boolean;
  hookStyle?: HookStyle;
  __isBismillahIntro?: boolean;
  __prepared?: PreparedAyahRenderData;
};

type Props = {
  ayahs?: Ayah[];
  textColor?: string;
  textSize?: number;
  fontFamily?: string;
  backgroundStyle?: string;
  backgroundVideoUrl?: string;
  backgroundVideoDuration?: number;
  totalVideoDuration?: number;
  backgroundType?: "video" | "image";
  isRemotionRender?: boolean;

  showHook?: boolean;
  hookText?: string;
  hookDuration?: number;
  hookStyle?: HookStyle;

  exportPreset?: string;
  exportQuality?: string;
  exportWidth?: number;
  exportHeight?: number;
  exportFps?: number;
  renderScale?: number;

  previewPlaying?: boolean;
  previewSeekSeconds?: number;

  textPosition?: string;
  animationStyle?: string;
  wordSpeed?: string;

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

  showTafsir?: boolean;
  tafsirText?: string;
  tafsirColor?: string;
  tafsirSize?: number;

  showSurahName?: boolean;
  surahName?: string;
  surahNameColor?: string;
  surahNameSize?: number;
  surahNamePosition?: string;
  surahNameX?: number;
  surahNameY?: number;

  showReciterName?: boolean;
  reciter?: string;
  reciterNameColor?: string;
  reciterNameSize?: number;
  reciterNamePosition?: string;
  reciterNameX?: number;
  reciterNameY?: number;

  showBrandName?: boolean;
  brandName?: string;
  brandNameColor?: string;
  brandNameSize?: number;
  brandNamePosition?: string;
  brandNameX?: number;
  brandNameY?: number;
  brandNameStyle?: string;

  showProgressBar?: boolean;
  showCountdownTimer?: boolean;
  progressColor?: string;
  timerColor?: string;
  progressPosition?: string;
  timerPosition?: string;
  progressHeight?: number;
  timerSize?: number;
};

type HookStyle = "reflection" | "question" | "warning" | "emotional";

type TimelineItem = {
  ayah: Ayah;
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
  startSeconds: number;
  durationSeconds: number;
  endSeconds: number;
};

const DEFAULT_FPS = 30;
const BISMILLAH_TEXT = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const DEFAULT_BISMILLAH_AUDIO = "";
const FALLBACK_AYAH: Ayah = {
  text: BISMILLAH_TEXT,
  audio: "",
  duration: 5,
  numberInSurah: 1,
};

const BACKGROUND_LOOP_SECONDS = 7;
const BACKGROUND_LOOP_CROSSFADE_SECONDS = 1.65;

// The Quran audio usually starts the spoken word a little before the visual
// word highlight reaches it, especially after browser/audio buffering.
// Advancing the caption clock slightly makes preview and export feel synced
// without changing the real audio timeline.
const DEFAULT_SUBTITLE_SYNC_ADVANCE_SECONDS = 0.18;

const QURAN_FONT_FACE_CSS = `
@font-face {
  font-family: "Amiri Quran";
  src: url("/fonts/AmiriQuran-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Amiri";
  src: url("/fonts/Amiri-Regular.ttf") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Noto Naskh Arabic";
  src: url("/fonts/NotoNaskhArabic-Regular.ttf") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Cairo";
  src: url("/fonts/Cairo-Regular.ttf") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "IBM Plex Sans Arabic";
  src: url("/fonts/IBMPlexSansArabic-Regular.ttf") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}
`;

const LABEL_FONT_STACK = `"Cairo", "IBM Plex Sans Arabic", "Noto Naskh Arabic", Arial, sans-serif`;
const QURAN_FONT_STACK = `"Amiri Quran", "Amiri", "Noto Naskh Arabic", serif`;

export default function Video(props: Props) {
  if (props.isRemotionRender) {
    return <RemotionVideo {...props} />;
  }

  return <BrowserPreviewVideo {...props} />;
}

function RemotionVideo(props: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const normalized = useNormalizedProps(props);
  const timeline = useMemo(
    () => buildTimeline(normalized.safeAyahs, fps || DEFAULT_FPS),
    [normalized.safeAyahs, fps],
  );

  const totalFrames = timeline[timeline.length - 1]?.endFrame || fps * 5;
  const totalSeconds = totalFrames / (fps || DEFAULT_FPS);
  const currentItem = getTimelineItemByFrame(timeline, frame) || timeline[0];
  const currentAyah = currentItem?.ayah || normalized.safeAyahs[0];
  const currentAyahLocalSeconds = Math.max(
    (frame - (currentItem?.startFrame || 0)) / (fps || DEFAULT_FPS),
    0,
  );

  const videoProgress = Math.min((frame / Math.max(totalFrames, 1)) * 100, 100);
  const remainingVideoSeconds = Math.max(
    Math.ceil(totalSeconds - frame / (fps || DEFAULT_FPS)),
    0,
  );

  return (
    <VideoCanvas
      {...normalized}
      currentAyah={currentAyah}
      currentAyahLocalSeconds={currentAyahLocalSeconds}
      videoProgress={videoProgress}
      remainingVideoSeconds={remainingVideoSeconds}
      isRemotionRender
      audioLayer={
        <>
          {timeline.map(({ ayah, startFrame, durationInFrames }, index) =>
            ayah.audio ? (
              <Sequence
                key={`${ayah.numberInSurah || index}-${ayah.audio}`}
                from={startFrame}
                durationInFrames={durationInFrames}
              >
                <Audio src={ayah.audio} />
              </Sequence>
            ) : null,
          )}
        </>
      }
    />
  );
}

function BrowserPreviewVideo(props: Props) {
  const normalized = useNormalizedProps(props);
  const { safeAyahs, ayahsKey } = normalized;
  const { previewPlaying = true, previewSeekSeconds = 0 } = props;

  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const [previewTime, setPreviewTime] = useState(previewSeekSeconds);

  const timeline = useMemo(
    () => buildTimeline(safeAyahs, DEFAULT_FPS),
    [safeAyahs],
  );

  const totalVideoDuration = Math.max(
    timeline[timeline.length - 1]?.endSeconds || 5,
    1,
  );

  const currentItem =
    getTimelineItemBySeconds(timeline, previewTime) || timeline[0];
  const currentAyah = currentItem?.ayah || safeAyahs[0];
  const ayahLocalTime = Math.max(
    previewTime - (currentItem?.startSeconds || 0),
    0,
  );

  const videoProgress = Math.min(
    (previewTime / Math.max(totalVideoDuration, 1)) * 100,
    100,
  );
  const remainingVideoSeconds = Math.max(
    Math.ceil(totalVideoDuration - previewTime),
    0,
  );

  useEffect(() => {
    const safeSeek = Math.min(
      Math.max(previewSeekSeconds, 0),
      totalVideoDuration,
    );

    setPreviewTime(safeSeek);
    lastTickRef.current = null;
  }, [previewSeekSeconds, totalVideoDuration, ayahsKey]);

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (!previewPlaying) {
      lastTickRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastTickRef.current === null) {
        lastTickRef.current = now;
      }

      const deltaSeconds = Math.min((now - lastTickRef.current) / 1000, 0.25);
      lastTickRef.current = now;

      setPreviewTime((current) => {
        const next = current + deltaSeconds;

        if (next >= totalVideoDuration) {
          return totalVideoDuration;
        }

        return next;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = null;
      lastTickRef.current = null;
    };
  }, [previewPlaying, totalVideoDuration]);

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video || normalized.backgroundType !== "video") return;

    const measuredDuration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 0;
    const sourceDuration = Number(normalized.backgroundVideoDuration || measuredDuration || 0);
    const playbackRate = getSmartBackgroundPlaybackRate({
      sourceDurationInSeconds: sourceDuration,
      targetDurationInSeconds: totalVideoDuration,
    });
    const shouldUseSlowPlayback =
      sourceDuration > 0 && totalVideoDuration > sourceDuration && playbackRate < 1;
    const targetTime = shouldUseSlowPlayback
      ? Math.min(previewTime * playbackRate, Math.max(sourceDuration - 0.05, 0))
      : sourceDuration > 0
        ? previewTime % sourceDuration
        : previewTime;
    const shouldHardSeek = Math.abs(video.currentTime - targetTime) > 0.22;

    if (shouldHardSeek) {
      try {
        video.currentTime = targetTime;
      } catch {
        // ignore browser seek race conditions while metadata is loading
      }
    }

    video.playbackRate = playbackRate;

    if (previewPlaying && previewTime < totalVideoDuration) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [
    previewTime,
    previewPlaying,
    totalVideoDuration,
    normalized.backgroundType,
    normalized.backgroundVideoUrl,
    normalized.backgroundVideoDuration,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const targetAudioTime = ayahLocalTime;
    const shouldHardSeek = Math.abs(audio.currentTime - targetAudioTime) > 0.18;

    if (shouldHardSeek) {
      try {
        audio.currentTime = targetAudioTime;
      } catch {
        // ignore browser seek race conditions while metadata is loading
      }
    }

    audio.playbackRate = 1;

    if (
      previewPlaying &&
      previewTime < totalVideoDuration &&
      currentAyah?.audio
    ) {
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [
    ayahLocalTime,
    previewPlaying,
    previewTime,
    totalVideoDuration,
    currentAyah?.audio,
  ]);

  useEffect(() => {
    if (previewTime >= totalVideoDuration) {
      backgroundVideoRef.current?.pause();
      audioRef.current?.pause();
    }
  }, [previewTime, totalVideoDuration]);

  return (
    <VideoCanvas
      {...normalized}
      currentAyah={currentAyah}
      currentAyahLocalSeconds={ayahLocalTime}
      videoProgress={videoProgress}
      remainingVideoSeconds={remainingVideoSeconds}
      isRemotionRender={false}
      backgroundVideoRef={backgroundVideoRef}
      previewPlaying={previewPlaying}
      audioLayer={
        currentAyah?.audio ? (
          <audio
            ref={audioRef}
            key={`${currentAyah.numberInSurah || currentAyah.text}-${currentAyah.audio}`}
            src={currentAyah.audio}
            preload="auto"
          />
        ) : null
      }
    />
  );
}

function useNormalizedProps({
  ayahs = [],
  textColor = "#ffffff",
  textSize = 82,
  fontFamily = "Amiri Quran",
  backgroundVideoUrl = "",
  backgroundVideoDuration = 0,
  totalVideoDuration = 0,
  backgroundType = "video",

  showHook = true,
  hookText = "توقّف لحظة… هذه الآية لك",
  hookDuration = 2.5,
  hookStyle = "reflection",
  exportPreset = "reels",
  exportQuality = "high",
  exportWidth = 1080,
  exportHeight = 1920,
  exportFps = 30,
  renderScale = 1,

  textPosition = "center",
  animationStyle = "slide",
  wordSpeed = "normal",

  showWordHighlight = true,
  wordHighlightColor = "#facc15",
  wordHighlightGlowColor = "#facc15",
  wordDimColor = "rgba(255,255,255,0.66)",
  wordHighlightStyle = "gold",
  wordHighlightTransition = "scale",
  wordHighlightSpeed = 1,
  wordHighlightOffset = 0,
  wordHighlightHold = 0.12,
  wordHighlightMode = "smart",
  manualWordTimings = {},

  showBismillahIntro = true,
  bismillahAudioUrl = "",
  bismillahDuration = 3.2,

  showTafsir = false,
  tafsirText = "",
  tafsirColor = "rgba(255,255,255,0.88)",
  tafsirSize = 30,

  showProgressBar = true,
  showCountdownTimer = true,
  progressColor = "#facc15",
  timerColor = "#ffffff",
  progressPosition = "bottom",
  timerPosition = "bottom",
  progressHeight = 5,
  timerSize = 18,

  showSurahName = true,
  surahName = "الفاتحة",
  surahNameColor = "#ffffff",
  surahNameSize = 52,
  surahNamePosition = "top",
  surahNameX,
  surahNameY,

  showReciterName = true,
  reciter = "مشاري العفاسي",
  reciterNameColor = "#facc15",
  reciterNameSize = 46,
  reciterNamePosition = "bottom",
  reciterNameX,
  reciterNameY,

  showBrandName = true,
  brandName = "وذكر | wzkerq",
  brandNameColor = "#ffffff",
  brandNameSize = 36,
  brandNamePosition = "bottom",
  brandNameX,
  brandNameY,
  brandNameStyle = "glass",
}: Props) {
  const safeAyahs = useMemo(() => {
    const inputAyahs = ayahs.length > 0 ? ayahs : [FALLBACK_AYAH];

    const ayahsWithIntro = normalizeAyahsWithBismillahIntro({
      ayahs: inputAyahs,
      showBismillahIntro,
      bismillahAudioUrl,
      bismillahDuration,
    });

    const cleanHookText = String(hookText || "").trim();
    const safeHookDuration = clampNumber(Number(hookDuration || 2.5), 1, 4);

    if (!showHook || !cleanHookText || safeHookDuration <= 0) {
      return ayahsWithIntro;
    }

    return [
      {
        text: cleanHookText,
        audio: "",
        duration: safeHookDuration,
        __isHookIntro: true,
        hookStyle,
      },
      ...ayahsWithIntro,
    ];
  }, [
    ayahs,
    showBismillahIntro,
    bismillahAudioUrl,
    bismillahDuration,
    showHook,
    hookText,
    hookDuration,
    hookStyle,
  ]);

  const ayahsKey = useMemo(() => {
    return safeAyahs
      .map(
        (ayah, index) =>
          `${ayah.numberInSurah || index}-${ayah.text}-${ayah.audio || ""}-${ayah.duration || 5}`,
      )
      .join("|");
  }, [safeAyahs]);

  return {
    safeAyahs,
    ayahsKey,
    textColor,
    textSize,
    fontFamily,
    backgroundVideoUrl,
    backgroundVideoDuration,
    totalVideoDuration,
    backgroundType,
    showHook,
    hookText,
    hookDuration,
    hookStyle,
    exportPreset,
    exportQuality,
    exportWidth,
    exportHeight,
    exportFps,
    renderScale,

    textPosition,
    animationStyle,
    wordSpeed,

    showWordHighlight,
    wordHighlightColor,
    wordHighlightGlowColor,
    wordDimColor,
    wordHighlightStyle,
    wordHighlightTransition,
    wordHighlightSpeed,
    wordHighlightOffset,
    wordHighlightHold,
    wordHighlightMode,
    manualWordTimings,

    showBismillahIntro,
    bismillahAudioUrl,
    bismillahDuration,

    showTafsir,
    tafsirText,
    tafsirColor,
    tafsirSize,

    showProgressBar,
    showCountdownTimer,
    progressColor,
    timerColor,
    progressPosition,
    timerPosition,
    progressHeight,
    timerSize,

    showSurahName,
    surahName,
    surahNameColor,
    surahNameSize,
    surahNamePosition,
    surahNameX,
    surahNameY,

    showReciterName,
    reciter,
    reciterNameColor,
    reciterNameSize,
    reciterNamePosition,
    reciterNameX,
    reciterNameY,

    showBrandName,
    brandName,
    brandNameColor,
    brandNameSize,
    brandNamePosition,
    brandNameX,
    brandNameY,
    brandNameStyle,
  };
}

function buildTimeline(ayahs: Ayah[], fps: number): TimelineItem[] {
  let frameCursor = 0;
  let secondCursor = 0;

  return ayahs.map((ayah) => {
    const durationSeconds = Math.max(ayah.duration || 5, 0.1);
    const durationInFrames = Math.max(1, Math.round(durationSeconds * fps));

    const item = {
      ayah,
      startFrame: frameCursor,
      durationInFrames,
      endFrame: frameCursor + durationInFrames,
      startSeconds: secondCursor,
      durationSeconds,
      endSeconds: secondCursor + durationSeconds,
    };

    frameCursor += durationInFrames;
    secondCursor += durationSeconds;

    return item;
  });
}

function getTimelineItemByFrame(timeline: TimelineItem[], frame: number) {
  return (
    timeline.find(
      (item) => frame >= item.startFrame && frame < item.endFrame,
    ) || timeline[timeline.length - 1]
  );
}

function getTimelineItemBySeconds(timeline: TimelineItem[], seconds: number) {
  return (
    timeline.find(
      (item) => seconds >= item.startSeconds && seconds < item.endSeconds,
    ) || timeline[timeline.length - 1]
  );
}

function VideoCanvas({
  safeAyahs,
  currentAyah,
  currentAyahLocalSeconds,
  videoProgress,
  remainingVideoSeconds,
  isRemotionRender,
  audioLayer,
  backgroundVideoRef,
  previewPlaying = true,

  textColor,
  textSize,
  fontFamily,
  backgroundVideoUrl,
  backgroundVideoDuration = 0,
  totalVideoDuration = 0,
  backgroundType,
  exportPreset,
  exportQuality,
  exportWidth,
  exportHeight,
  exportFps,
  renderScale,
  textPosition,
  animationStyle,

  showWordHighlight,
  wordHighlightColor,
  wordHighlightGlowColor,
  wordDimColor,
  wordHighlightStyle,
  wordHighlightTransition,
  wordHighlightSpeed,
  wordHighlightOffset,
  wordHighlightHold,
  wordHighlightMode,
  manualWordTimings,

  showTafsir,
  tafsirText,
  tafsirColor,
  tafsirSize,

  showProgressBar,
  showCountdownTimer,
  progressColor,
  timerColor,
  progressPosition,
  timerPosition,
  progressHeight,
  timerSize,

  showSurahName,
  surahName,
  surahNameColor,
  surahNameSize,
  surahNamePosition,
  surahNameX,
  surahNameY,

  showReciterName,
  reciter,
  reciterNameColor,
  reciterNameSize,
  reciterNamePosition,
  reciterNameX,
  reciterNameY,

  showBrandName,
  brandName,
  brandNameColor,
  brandNameSize,
  brandNamePosition,
  brandNameX,
  brandNameY,
  brandNameStyle,
}: ReturnType<typeof useNormalizedProps> & {

  currentAyah: Ayah;
  currentAyahLocalSeconds: number;
  videoProgress: number;
  remainingVideoSeconds: number;
  isRemotionRender: boolean;
  audioLayer: React.ReactNode;
  backgroundVideoRef?: React.RefObject<HTMLVideoElement | null>;
  backgroundVideoDuration?: number;
  totalVideoDuration?: number;
  previewPlaying?: boolean;
}) {


  const IS_LITE_RENDER = isRemotionRender;

  const animationStyleTag = `

@keyframes fadeZoom {
  0% {
    opacity: 0;
    transform: scale(0.94) translateY(12px);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes slideSoft {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glowText {
  0%, 100% {
    text-shadow: 0 0 28px rgba(0,0,0,0.95), 0 0 16px rgba(52,211,153,0.22);
  }

  50% {
    text-shadow: 0 0 28px rgba(0,0,0,0.95), 0 0 34px rgba(52,211,153,0.5);
  }
}
`;

  const exportAspectRatio = exportWidth / Math.max(exportHeight, 1);
  const isLandscapeExport = exportAspectRatio > 1.2;
  const isSquareExport = exportAspectRatio >= 0.9 && exportAspectRatio <= 1.1;
  const captionLayout = getOpticalCaptionLayout({
    width: exportWidth,
    height: exportHeight,
    requestedTextSize: textSize,
  });

  const layoutOverlayStrength = isLandscapeExport
    ? "linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.34) 42%, rgba(0,0,0,0.52))"
    : "linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.36) 44%, rgba(0,0,0,0.48))";

  const adaptiveTextSize = captionLayout.fontSize;

  const textVerticalPosition = getTextVerticalPosition(textPosition);
  const ayahAnimation = getAyahAnimation(
    animationStyle,
    previewPlaying,
    isRemotionRender,
  );
  const safeSurahTitle = formatSurahTitle(surahName);
  const resolvedTafsirText = getStableSharedTafsirForCurrentAyah(
    safeAyahs,
    currentAyah,
  );

  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    if (isRemotionRender) return;

    const element = previewCanvasRef.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;

    const updatePreviewScale = () => {
      const parentRect = parent.getBoundingClientRect();
      const targetWidth = Math.max(Number(exportWidth || 1080), 1);
      const targetHeight = Math.max(Number(exportHeight || 1920), 1);
      const nextScale = Math.min(
        parentRect.width / targetWidth,
        parentRect.height / targetHeight,
      );

      setPreviewScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    updatePreviewScale();

    const resizeObserver = new ResizeObserver(updatePreviewScale);
    resizeObserver.observe(parent);

    return () => resizeObserver.disconnect();
  }, [isRemotionRender, exportWidth, exportHeight]);

  return (
    <>
      <style suppressHydrationWarning>{`${QURAN_FONT_FACE_CSS}${animationStyleTag}`}</style>

      <div
        ref={previewCanvasRef}
        style={{
          width: isRemotionRender ? "100%" : exportWidth,
          height: isRemotionRender ? "100%" : exportHeight,
          position: isRemotionRender ? "relative" : "absolute",
          left: isRemotionRender ? undefined : "50%",
          top: isRemotionRender ? undefined : "50%",
          transform: isRemotionRender
            ? undefined
            : `translate(-50%, -50%) scale(${previewScale})`,
          transformOrigin: "center center",
          overflow: "hidden",
          background: "#000",
          direction: "rtl",
          unicodeBidi: "plaintext",
        }}
      >
        {backgroundVideoUrl ? (
          backgroundType === "image" ? (
            isRemotionRender ? (
              <Img
                src={backgroundVideoUrl}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <img
                src={backgroundVideoUrl}
                alt=""
                decoding="async"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )
          ) : isRemotionRender ? (
            <SmartBackgroundVideo
              src={backgroundVideoUrl}
              fps={exportFps || DEFAULT_FPS}
              sourceDurationInSeconds={backgroundVideoDuration}
              targetDurationInSeconds={totalVideoDuration}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                backgroundColor: "#000",
              }}
            />
          ) : (
            <video
              ref={backgroundVideoRef as any}
              key={backgroundVideoUrl}
              src={backgroundVideoUrl}
              muted
              playsInline
              preload="auto"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                backgroundColor: "#000",
              }}
            />
          )
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at top, rgba(250,204,21,0.18), transparent 34%), radial-gradient(circle at bottom, rgba(6,95,70,0.20), transparent 38%), linear-gradient(to bottom, #03140f, #000000, #041f18)",
            }}
          />
        )}

        {audioLayer}

        {!isRemotionRender && !previewPlaying && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              background: "rgba(0,0,0,0.12)",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: IS_LITE_RENDER ? "linear-gradient(to bottom, rgba(0,0,0,0.10), rgba(0,0,0,0.18))" : layoutOverlayStrength,
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              IS_LITE_RENDER ? "rgba(0,0,0,0.10)" : "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.24) 100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {showSurahName && safeSurahTitle && (
          <FloatingText
            text={safeSurahTitle}
            color={surahNameColor}
            size={
              surahNameSize *
              (isLandscapeExport ? 0.78 : isSquareExport ? 0.9 : 1)
            }
            position={surahNamePosition}
            x={getSeparatedBottomLabelX(surahNameX, "surah")}
            y={surahNameY}
            top={45}
            bottom={105}
            variant="pill"
            isRemotionRender={isRemotionRender}
          />
        )}

        {showReciterName && (
          <FloatingText
            text={reciter}
            color={reciterNameColor}
            size={
              reciterNameSize *
              (isLandscapeExport ? 0.78 : isSquareExport ? 0.9 : 1)
            }
            position={reciterNamePosition}
            x={getSeparatedBottomLabelX(reciterNameX, "reciter")}
            y={reciterNameY}
            top={95}
            bottom={65}
            variant="pill"
            isRemotionRender={isRemotionRender}
          />
        )}

        {showBrandName && (
          <FloatingText
            text={brandName}
            color={brandNameColor}
            size={
              brandNameSize *
              (isLandscapeExport ? 0.78 : isSquareExport ? 0.9 : 1)
            }
            position={brandNamePosition}
            x={brandNameX}
            y={brandNameY}
            top={18}
            bottom={25}
            variant={
              brandNameStyle === "glass"
                ? "pill"
                : brandNameStyle === "glow"
                  ? "glow"
                  : "plain"
            }
            isRemotionRender={isRemotionRender}
          />
        )}

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: captionLayout.zoneTop,
            bottom:
              showTafsir && !currentAyah?.__isBismillahIntro
                ? captionLayout.tafsirZoneBottom
                : captionLayout.zoneBottom,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: `0 ${captionLayout.sidePadding}px`,
            textAlign: "center",
            direction: "rtl",
            animation: IS_LITE_RENDER ? "none" : ayahAnimation,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              color: textColor,
              fontSize:
                showTafsir && !currentAyah?.__isBismillahIntro
                  ? captionLayout.fontSize * 1.03
                  : captionLayout.fontSize,
              fontWeight: 900,
              lineHeight: captionLayout.lineHeight,
              textShadow: "none",
              background: "transparent",
              borderRadius: 0,
              padding: 0,
              margin: 0,
              border: "none",
              boxShadow: "none",
              width: "100%",
              maxWidth: captionLayout.maxWidth,
              minWidth: "0",
              maxHeight: "100%",
              overflow: "visible",
              whiteSpace: "normal",
              backdropFilter: "none",
              filter: "none",
            }}
          >
            {currentAyah?.__isHookIntro ? (
              <HookIntroText
                text={currentAyah.text}
                color={textColor}
                styleName={currentAyah.hookStyle || "reflection"}
                progress={clampNumber(
                  currentAyahLocalSeconds / Math.max(currentAyah.duration || 1, 0.1),
                  0,
                  1,
                )}
                isLandscapeCaption={Boolean((captionLayout as any).isLandscape)}
                isSquareCaption={Boolean((captionLayout as any).isSquare)}
                isRemotionRender={isRemotionRender}
              />
            ) : (
              <AnimatedText
                text={currentAyah?.text || BISMILLAH_TEXT}
                color={textColor}
                size={adaptiveTextSize}
                fontFamily={fontFamily}
                animationStyle={animationStyle}
                showWordHighlight={showWordHighlight}
                currentTime={currentAyahLocalSeconds}
                duration={currentAyah?.duration || 5}
                highlightColor={wordHighlightColor}
                highlightGlowColor={wordHighlightGlowColor}
                dimColor={wordDimColor}
                highlightStyle={wordHighlightStyle}
                transitionStyle={wordHighlightTransition}
                highlightSpeed={wordHighlightSpeed}
                highlightOffset={wordHighlightOffset}
                highlightHold={wordHighlightHold}
                highlightMode={wordHighlightMode}
                manualTimings={
                  manualWordTimings[getAyahManualTimingKey(currentAyah)] || []
                }
                preparedData={currentAyah?.__prepared}
                ayahNumber={
                  currentAyah?.__isBismillahIntro
                    ? undefined
                    : currentAyah?.numberInSurah
                }
                isLandscapeCaption={Boolean((captionLayout as any).isLandscape)}
                isSquareCaption={Boolean((captionLayout as any).isSquare)}
                isRemotionRender={isRemotionRender}
              />
            )}

            {showTafsir &&
              !currentAyah?.__isHookIntro &&
              !currentAyah?.__isBismillahIntro &&
              resolvedTafsirText && (
                <TafsirText
                  key={`tafsir-${getTafsirStableKey(resolvedTafsirText)}`}
                  text={resolvedTafsirText}
                  color={tafsirColor}
                  size={tafsirSize}
                  isLandscapeCaption={Boolean((captionLayout as any).isLandscape)}
                  isSquareCaption={Boolean((captionLayout as any).isSquare)}
                  isRemotionRender={isRemotionRender}
                />
              )}
          </div>
        </div>

        {showCountdownTimer && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: timerPosition === "top" ? 25 : undefined,
              bottom: timerPosition === "bottom" ? 25 : undefined,
              zIndex: 30,
              textAlign: "center",
              color: timerColor,
              fontSize: timerSize,
              fontWeight: "bold",
              textShadow: isRemotionRender
                ? "0 0 8px rgba(0,0,0,0.84)"
                : "0 0 20px rgba(0,0,0,0.9)",
            }}
          >
            {Math.floor(remainingVideoSeconds / 60)}:
            {String(remainingVideoSeconds % 60).padStart(2, "0")}
          </div>
        )}

        {showProgressBar && (
          <div
            style={{
              position: "absolute",
              left: isLandscapeExport ? 90 : 45,
              right: isLandscapeExport ? 90 : 45,
              top: progressPosition === "top" ? 12 : undefined,
              bottom: progressPosition === "bottom" ? 12 : undefined,
              height: progressHeight,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              zIndex: 30,
              overflow: "hidden",
              boxShadow: isRemotionRender
                ? "0 0 6px rgba(0,0,0,0.28)"
                : "0 0 22px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                width: `${videoProgress}%`,
                height: "100%",
                borderRadius: 999,
                background: progressColor,
                boxShadow: isRemotionRender
                  ? "none"
                  : "none",
                transition: isRemotionRender ? "none" : "width 0.08s linear",
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}



function getSmartBackgroundPlaybackRate({
  sourceDurationInSeconds,
  targetDurationInSeconds,
}: {
  sourceDurationInSeconds?: number;
  targetDurationInSeconds?: number;
}) {
  const sourceDuration = Number(sourceDurationInSeconds || 0);
  const targetDuration = Number(targetDurationInSeconds || 0);

  if (!(sourceDuration > 0) || !(targetDuration > 0)) return 1;
  if (sourceDuration >= targetDuration) return 1;

  return clampNumber(sourceDuration / targetDuration, 0.12, 1);
}

function SmartBackgroundVideo({
  src,
  fps,
  sourceDurationInSeconds,
  targetDurationInSeconds,
  style,
}: {
  src: string;
  fps: number;
  sourceDurationInSeconds?: number;
  targetDurationInSeconds?: number;
  style: React.CSSProperties;
}) {
  const sourceDuration = Number(sourceDurationInSeconds || 0);
  const targetDuration = Number(targetDurationInSeconds || 0);

  const playbackRate = getSmartBackgroundPlaybackRate({
    sourceDurationInSeconds: sourceDuration,
    targetDurationInSeconds: targetDuration,
  });

  return (
    <OffthreadVideo
      src={src}
      muted
      playbackRate={playbackRate}
      style={style}
    />
  );
}

function FadeInVideoLayer({
  src,
  playbackRate,
  style,
  fadeFrames,
}: {
  src: string;
  playbackRate: number;
  style: React.CSSProperties;
  fadeFrames: number;
}) {
  const frame = useCurrentFrame();
  const progress = clampNumber(frame / Math.max(fadeFrames - 1, 1), 0, 1);
  const opacity = easeInOutSine(progress);

  return (
    <OffthreadVideo
      src={src}
      muted
      playbackRate={playbackRate}
      style={{
        ...style,
        opacity,
      }}
    />
  );
}


function HookIntroText({
  text,
  color,
  styleName,
  progress,
  isLandscapeCaption = false,
  isSquareCaption = false,
  isRemotionRender = false,
}: {
  text: string;
  color: string;
  styleName: HookStyle;
  progress: number;
  isLandscapeCaption?: boolean;
  isSquareCaption?: boolean;
  isRemotionRender?: boolean;
}) {
  const safeText = String(text || "").trim();
  if (!safeText) return null;

  const baseSize = isLandscapeCaption ? 52 : isSquareCaption ? 48 : 58;
  const scale = isRemotionRender
    ? 1
    : 0.96 + easeOutCubic(clampNumber(progress, 0, 1)) * 0.04;

  const accent =
    styleName === "warning"
      ? "#facc15"
      : styleName === "question"
        ? "#38bdf8"
        : styleName === "emotional"
          ? "#fb7185"
          : "#34d399";

  const prefix =
    styleName === "warning"
      ? "انتبه"
      : styleName === "question"
        ? "سؤال"
        : styleName === "emotional"
          ? "رسالة"
          : "تأمل";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isLandscapeCaption ? 14 : 22,
        width: "100%",
        transform: `scale(${scale})`,
        opacity: isRemotionRender ? 1 : clampNumber(progress * 1.8, 0, 1),
      }}
    >
      <div
        style={{
          color: accent,
          fontFamily: LABEL_FONT_STACK,
          fontSize: isLandscapeCaption ? 22 : 26,
          fontWeight: 900,
          letterSpacing: 1,
          padding: "8px 18px",
          borderRadius: 999,
          border: `1px solid ${accent}55`,
          background: "rgba(0,0,0,0.24)",
          textShadow: "0 2px 10px rgba(0,0,0,0.9)",
        }}
      >
        {prefix}
      </div>

      <div
        style={{
          color,
          fontFamily: LABEL_FONT_STACK,
          fontSize: baseSize,
          lineHeight: 1.35,
          fontWeight: 950,
          textAlign: "center",
          textWrap: "balance" as any,
          maxWidth: isLandscapeCaption ? "76%" : "86%",
          textShadow: isRemotionRender
            ? "0 2px 10px rgba(0,0,0,0.95)"
            : `0 0 28px rgba(0,0,0,0.95), 0 0 24px ${accent}66`,
        }}
      >
        {safeText}
      </div>
    </div>
  );
}

function TafsirText({
  text,
  color,
  size,
  isLandscapeCaption = false,
  isSquareCaption = false,
  isRemotionRender = false,
}: {
  text: string;
  color: string;
  size: number;
  isLandscapeCaption?: boolean;
  isSquareCaption?: boolean;
  isRemotionRender?: boolean;
}) {
  const cleanText = getShortTafsirText(String(text || "").trim());
  if (!cleanText) return null;

  const safeSize = getAutoFitTafsirFontSize({
    text: cleanText,
    requestedSize: Number(size || 30),
    isLandscape: isLandscapeCaption,
    isSquare: isSquareCaption,
  });

  return (
    <div
      style={{
        marginTop: isLandscapeCaption ? "1.45em" : "1.62em",
        marginInline: "auto",
        padding: 0,
        width: "100%",
        maxWidth: isLandscapeCaption ? "100%" : "100%",
        color,
        fontSize: safeSize,
        lineHeight: isLandscapeCaption ? 1.58 : 1.64,
        fontWeight: 900,
        fontFamily: LABEL_FONT_STACK,
        textAlign: "center",
        direction: "rtl",
        unicodeBidi: "plaintext",
        textWrap: "balance" as any,
        whiteSpace: "normal",
        textShadow: isRemotionRender
          ? "0 2px 5px rgba(0,0,0,0.96), 0 0 4px rgba(255,255,255,0.18)"
          : "0 3px 10px rgba(0,0,0,0.98), 0 0 8px rgba(255,255,255,0.18)",
        opacity: 0.98,
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        overflow: "visible",
        display: "block",
      }}
    >
      {cleanText}
    </div>
  );
}


function getStableSharedTafsirForCurrentAyah(
  ayahs: Ayah[],
  currentAyah?: Ayah,
) {
  if (!currentAyah || currentAyah.__isHookIntro || currentAyah.__isBismillahIntro) {
    return "";
  }

  const currentText = normalizeTafsirText(currentAyah.tafsir || "");
  if (currentText) {
    return currentText;
  }

  const currentIndex = ayahs.findIndex((ayah) => ayah === currentAyah);
  if (currentIndex < 0) {
    return "";
  }

  // Some tafsir sources return one explanation for a small group of adjacent ayahs.
  // If the current ayah does not carry tafsir text by itself, keep the nearest
  // previous tafsir visible until a new tafsir appears on a later ayah.
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const previous = ayahs[index];

    if (!previous || previous.__isHookIntro || previous.__isBismillahIntro) {
      continue;
    }

    const previousTafsir = normalizeTafsirText(previous.tafsir || "");
    if (previousTafsir) {
      return previousTafsir;
    }
  }

  return "";
}

function normalizeTafsirText(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTafsirStableKey(value: string) {
  return normalizeTafsirText(value)
    .slice(0, 80)
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, "-");
}

function getShortTafsirText(value: string) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  // Avoid unhelpful cross-references commonly returned for الحروف المقطعة.
  const lower = normalized.toLowerCase();
  const badStarts = [
    "سبق الكلام",
    "تقدم الكلام",
    "قد تقدم الكلام",
    "انظر تفسير",
    "سبق بيان",
  ];

  if (badStarts.some((item) => lower.includes(item))) {
    return "";
  }

  // Show the full tafsir of the CURRENT ayah only.
  // No clipping, no ellipsis, and no fallback tafsir from other ayahs.
  return normalized;
}

function normalizeArabicFontFamily(fontFamily: string) {
  const normalized = String(fontFamily || "").trim();

  if (
    normalized === "KFGQPC" ||
    normalized === "KFGQPC Uthmanic" ||
    normalized === "KFGQPC Uthmanic Script" ||
    normalized === "KFGQPC Uthmanic Script HAFS" ||
    normalized === "Uthmanic"
  ) {
    return "Amiri Quran";
  }

  if (
    normalized === "AmiriQuran" ||
    normalized === "Amiri Quran Regular" ||
    normalized === "Amiri Quran"
  ) {
    return "Amiri Quran";
  }

  if (normalized === "Noto Naskh" || normalized === "Noto Naskh Arabic") {
    return "Noto Naskh Arabic";
  }

  if (normalized === "IBM Plex Arabic" || normalized === "IBM Plex Sans Arabic") {
    return "IBM Plex Sans Arabic";
  }

  if (normalized === "Cairo") {
    return "Noto Naskh Arabic";
  }

  if (normalized === "Amiri") {
    return "Amiri";
  }

  return "Amiri Quran";
}


function getSeparatedBottomLabelX(value: number | undefined, type: "surah" | "reciter") {
  if (!Number.isFinite(value)) return value;

  const numericValue = Number(value);

  // The default bottom labels are intentionally pushed apart a bit so the
  // larger cinematic pills do not overlap, while keeping both centered on the
  // lower third and not changing their vertical placement.
  if (type === "surah") {
    return clampNumber(numericValue - 4, 18, 46);
  }

  return clampNumber(numericValue + 4, 54, 82);
}

function FloatingText({
  text,
  color,
  size,
  position,
  x,
  y,
  top,
  bottom,
  variant = "plain",
  isRemotionRender = false,
}: {
  text: string;
  color: string;
  size: number;
  position: string;
  x?: number;
  y?: number;
  top: number;
  bottom: number;
  variant?: "plain" | "pill" | "glow";
  isRemotionRender?: boolean;
}) {
  const isPill = variant === "pill";
  const isGlow = variant === "glow";
  const hasCustomPosition = Number.isFinite(x) && Number.isFinite(y);

  return (
    <div
      style={{
        position: "absolute",
        left: hasCustomPosition ? `${x}%` : 20,
        right: hasCustomPosition ? undefined : 20,
        width: hasCustomPosition ? "max-content" : undefined,
        maxWidth: hasCustomPosition ? "none" : undefined,
        zIndex: 10,
        textAlign: "center",
        color,
        fontSize: size,
        fontWeight: 950,
        fontFamily: LABEL_FONT_STACK,
        top: hasCustomPosition
          ? `${y}%`
          : position === "top"
            ? top
            : position === "center"
              ? "48%"
              : undefined,
        bottom: hasCustomPosition ? undefined : position === "bottom" ? bottom : undefined,
        transform: hasCustomPosition ? "translate(-50%, -50%)" : undefined,
        whiteSpace: "nowrap",
        overflow: "visible",
        textShadow: isRemotionRender
          ? isGlow
            ? `0 0 6px ${color}, 0 0 10px rgba(0,0,0,0.86)`
            : "0 0 8px rgba(0,0,0,0.86)"
          : isGlow
            ? `0 0 22px ${color}, 0 0 12px rgba(0,0,0,0.95)`
            : "0 0 25px rgba(0,0,0,0.95)",
        letterSpacing: 1,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isPill ? `${Math.max(size * 0.18, 8)}px ${Math.max(size * 0.42, 18)}px` : 0,
          borderRadius: 999,
          background: isPill ? "rgba(0,0,0,0.38)" : "transparent",
          border: isPill ? `2px solid ${color}88` : "none",
          backdropFilter: isPill && !isRemotionRender ? "blur(14px)" : "none",
          fontFamily: LABEL_FONT_STACK,
          whiteSpace: "nowrap",
          width: "max-content",
          maxWidth: "none",
          flexShrink: 0,
          boxShadow: isPill ? `0 0 ${isRemotionRender ? 8 : 18}px ${color}33, inset 0 0 14px rgba(255,255,255,0.06)` : "none",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function getOpticalCaptionLayout({
  width,
  height,
  requestedTextSize,
}: {
  width: number;
  height: number;
  requestedTextSize: number;
}) {
  const safeWidth = Math.max(width || 1080, 360);
  const safeHeight = Math.max(height || 1920, 360);
  const aspectRatio = safeWidth / safeHeight;

  const isLandscape = aspectRatio > 1.2;
  const isSquare = aspectRatio >= 0.9 && aspectRatio <= 1.1;

  // Bigger cinematic reading area like the approved reference.
  // Long ayahs are still paged/auto-fitted inside AnimatedText.
  const zoneTopRatio = isLandscape ? 0.145 : isSquare ? 0.165 : 0.17;
  // Lift the ayah + tafsir block optically upward inside vertical exports.
  // This removes the large empty area above the text while keeping bottom labels safe.
  const zoneBottomRatio = isLandscape ? 0.155 : isSquare ? 0.175 : 0.225;
  const zoneTop = `${zoneTopRatio * 100}%`;
  const zoneBottom = `${zoneBottomRatio * 100}%`;
  const tafsirZoneBottom = `${Math.max(zoneBottomRatio - 0.035, 0.095) * 100}%`;

  const referenceWidth = 1080;
  const referenceHeight = 1920;
  const physicalScale = Math.min(
    safeWidth / referenceWidth,
    safeHeight / referenceHeight,
  );

  const opticalScale = Math.pow(clampNumber(physicalScale, 0.52, 1.55), 0.12);
  const userScale = clampNumber(Number(requestedTextSize || 88) / 62, 1.02, 1.7);

  const baseFont = isLandscape
    ? Math.min(safeWidth, safeHeight) * 0.088
    : isSquare
      ? Math.min(safeWidth, safeHeight) * 0.084
      : safeWidth * 0.086;

  const fontSize = clampNumber(
    baseFont * opticalScale * userScale,
    isLandscape ? 50 : isSquare ? 56 : 64,
    isLandscape ? 96 : isSquare ? 106 : 120,
  );

  return {
    fontSize,
    maxWidth: isLandscape ? "94%" : isSquare ? "95%" : "96%",
    lineHeight: isLandscape ? 1.62 : isSquare ? 1.74 : 1.92,
    sidePadding: Math.round(safeWidth * (isLandscape ? 0.035 : 0.026)) + 14,
    paddingX: 0,
    paddingY: 0,
    borderRadius: 0,
    zoneTop,
    zoneBottom,
    tafsirZoneBottom,
    isLandscape,
    isSquare,
  };
}

function getAutoFitQuranFontSize({
  text,
  requestedSize,
  isLandscape = false,
  isSquare = false,
}: {
  text: string;
  requestedSize: number;
  isLandscape?: boolean;
  isSquare?: boolean;
}) {
  const cleanText = String(text || "").trim();
  const words = splitArabicWords(cleanText);
  const characterCount = cleanText.replace(/\s+/g, "").length;
  const wordCount = words.length;
  const density = characterCount + wordCount * 3;

  const minSize = isLandscape ? 40 : isSquare ? 44 : 50;
  const maxSize = isLandscape ? 96 : isSquare ? 106 : 120;

  let targetSize = clampNumber(requestedSize, minSize, maxSize);

  // Big short ayahs, readable long ayahs. This keeps the reference style
  // without letting long verses overflow the vertical reel frame.
  if (isLandscape) {
    if (density <= 38) targetSize = Math.max(targetSize, 112);
    else if (density <= 70) targetSize = Math.max(targetSize, 80);
    else if (density <= 115) targetSize = Math.min(Math.max(targetSize, 68), 78);
    else if (density <= 190) targetSize = Math.min(Math.max(targetSize, 58), 68);
    else if (density <= 280) targetSize = Math.min(Math.max(targetSize, 48), 58);
    else targetSize = Math.min(Math.max(targetSize, 40), 50);
  } else if (isSquare) {
    if (density <= 38) targetSize = Math.max(targetSize, 112);
    else if (density <= 70) targetSize = Math.max(targetSize, 98);
    else if (density <= 115) targetSize = Math.min(Math.max(targetSize, 74), 84);
    else if (density <= 190) targetSize = Math.min(Math.max(targetSize, 62), 72);
    else if (density <= 280) targetSize = Math.min(Math.max(targetSize, 52), 62);
    else targetSize = Math.min(Math.max(targetSize, 44), 54);
  } else {
    if (density <= 32) targetSize = Math.max(targetSize, 108);
    else if (density <= 55) targetSize = Math.min(Math.max(targetSize, 92), 102);
    else if (density <= 85) targetSize = Math.min(Math.max(targetSize, 82), 92);
    else if (density <= 115) targetSize = Math.min(Math.max(targetSize, 76), 86);
    else if (density <= 190) targetSize = Math.min(Math.max(targetSize, 68), 78);
    else if (density <= 280) targetSize = Math.min(Math.max(targetSize, 58), 68);
    else targetSize = Math.min(Math.max(targetSize, 50), 58);
  }

  return clampNumber(targetSize, minSize, maxSize);
}

function getAutoFitTafsirFontSize({
  text,
  requestedSize,
  isLandscape = false,
  isSquare = false,
}: {
  text: string;
  requestedSize: number;
  isLandscape?: boolean;
  isSquare?: boolean;
}) {
  const length = String(text || "").replace(/\s+/g, " ").trim().length;
  const minSize = isLandscape ? 18 : isSquare ? 21 : 22;
  const maxSize = isLandscape ? 38 : isSquare ? 44 : 48;

  let targetSize = clampNumber(Math.max(requestedSize, minSize), minSize, maxSize);

  if (length <= 70) targetSize = Math.max(targetSize, isLandscape ? 34 : isSquare ? 40 : 44);
  else if (length <= 120) targetSize = Math.max(targetSize, isLandscape ? 30 : isSquare ? 36 : 40);
  else if (length <= 180) targetSize = Math.min(Math.max(targetSize, isLandscape ? 25 : isSquare ? 30 : 33), isLandscape ? 30 : isSquare ? 34 : 38);
  else if (length <= 260) targetSize = Math.min(targetSize, isLandscape ? 23 : isSquare ? 27 : 30);
  else targetSize = Math.min(targetSize, isLandscape ? 20 : isSquare ? 24 : 26);

  return clampNumber(targetSize, minSize, maxSize);
}

function AnimatedText({
  text,
  color,
  size,
  fontFamily,
  animationStyle,
  showWordHighlight,
  currentTime,
  duration,
  highlightColor,
  highlightGlowColor,
  dimColor,
  highlightStyle,
  transitionStyle,
  highlightSpeed,
  highlightOffset,
  highlightHold,
  highlightMode,
  manualTimings,
  preparedData,
  ayahNumber,
  isLandscapeCaption = false,
  isSquareCaption = false,
  isRemotionRender = false,
}: {
  text: string;
  color: string;
  size: number;
  fontFamily: string;
  animationStyle: string;
  showWordHighlight: boolean;
  currentTime: number;
  duration: number;
  highlightColor: string;
  highlightGlowColor: string;
  dimColor: string;
  highlightStyle: string;
  transitionStyle: string;
  highlightSpeed: number;
  highlightOffset: number;
  highlightHold: number;
  highlightMode: string;
  manualTimings: Array<number | null>;
  preparedData?: PreparedAyahRenderData;
  ayahNumber?: number;
  isLandscapeCaption?: boolean;
  isSquareCaption?: boolean;
  isRemotionRender?: boolean;
}) {
  const safeSize = getAutoFitQuranFontSize({
    text,
    requestedSize: size,
    isLandscape: isLandscapeCaption,
    isSquare: isSquareCaption,
  });
  const hasManualTimings = manualTimings.some(
    (time) => typeof time === "number" && Number.isFinite(time),
  );

  const canUsePreparedData = Boolean(
    preparedData &&
    preparedData.sourceText === text &&
    Math.abs(preparedData.duration - duration) < 0.001 &&
    Math.abs(preparedData.fontSize - safeSize) < 0.001 &&
    preparedData.isLandscape === isLandscapeCaption &&
    preparedData.isSquare === isSquareCaption &&
    preparedData.highlightMode === highlightMode &&
    Math.abs(preparedData.highlightSpeed - highlightSpeed) < 0.001,
  );

  const words = useMemo(() => {
    if (canUsePreparedData && preparedData?.words?.length) {
      return preparedData.words;
    }

    return splitArabicWords(text);
  }, [canUsePreparedData, preparedData, text]);

  const manualTimingsKey = useMemo(
    () => manualTimings.map((time) => time ?? "").join("|"),
    [manualTimings],
  );

  const captionPages = useMemo(() => {
    return buildFitZoneCaptionPages({
      words,
      fontSize: safeSize,
      isLandscape: isLandscapeCaption,
      isSquare: isSquareCaption,
    });
  }, [words, safeSize, isLandscapeCaption, isSquareCaption]);

  const wordStartTimes = useMemo(() => {
    if (
      canUsePreparedData &&
      !hasManualTimings &&
      preparedData?.wordStartTimes?.length
    ) {
      return preparedData.wordStartTimes;
    }

    return buildMergedWordStartTimes({
      words,
      duration,
      speed: highlightSpeed,
      mode: highlightMode,
      manualTimings,
    });
    // manualTimings is usually a fresh array from props, so the stable key avoids
    // recalculating recitation weights on every rendered frame.
  }, [
    canUsePreparedData,
    hasManualTimings,
    preparedData,
    words,
    duration,
    highlightSpeed,
    highlightMode,
    manualTimingsKey,
  ]);

  const activeWordIndex = getActiveWordIndexFast({
    currentTime,
    offset: Number(highlightOffset || 0) + DEFAULT_SUBTITLE_SYNC_ADVANCE_SECONDS,
    duration,
    speed: highlightSpeed,
    wordCount: words.length,
    startTimes: wordStartTimes,
  });

  const activePageIndex = Math.max(
    captionPages.findIndex((page) =>
      page.lines.some((line) =>
        line.some((item) => item.originalIndex === activeWordIndex),
      ),
    ),
    0,
  );

  const activePage = captionPages[activePageIndex] ||
    captionPages[0] || {
      lines: [words.map((word, index) => ({ word, originalIndex: index }))],
    };

  const resolvedFontFamily = normalizeArabicFontFamily(fontFamily);

  const baseStyle: React.CSSProperties = {
    color,
    fontSize: safeSize,
    fontWeight: 900,
    lineHeight: isLandscapeCaption ? 1.66 : isSquareCaption ? 1.82 : 2.08,
    textShadow: isRemotionRender
      ? "0 3px 9px rgba(0,0,0,0.98), 0 0 5px rgba(255,255,255,0.16)"
      : "0 4px 13px rgba(0,0,0,0.98), 0 0 11px rgba(255,255,255,0.18)",
    direction: "rtl",
    unicodeBidi: "plaintext",
    fontFamily: resolvedFontFamily === "Amiri Quran" ? QURAN_FONT_STACK : `"${resolvedFontFamily}", ${QURAN_FONT_STACK}`,
    fontKerning: "normal",
    fontVariantLigatures: "common-ligatures",
    fontFeatureSettings: '"liga" 1, "calt" 1, "kern" 1',
    textRendering: "geometricPrecision",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    textAlign: "center",
    textWrap: "balance" as any,
    whiteSpace: "normal",
    wordBreak: "normal",
    wordSpacing: isLandscapeCaption ? "0.012em" : "0.018em",
    overflowWrap: "normal",
    maxWidth: "100%",
    width: "100%",
    letterSpacing: "0",
    background: "transparent",
    border: "none",
    boxShadow: "none",
    filter: "none",
    backdropFilter: "none",
    animation:
      animationStyle === "glow" && !isRemotionRender
        ? undefined
        : undefined,
  };

  if (!showWordHighlight) {
    const visiblePage = activePage ||
      captionPages[0] || {
        lines: [words.map((word, index) => ({ word, originalIndex: index }))],
      };

    return (
      <div
        key={`caption-page-no-highlight-${activePageIndex}`}
        style={{
          ...baseStyle,
          paddingLeft: 12,
          paddingRight: 12,
          paddingBottom: 28,
          overflow: "visible",
          animation: isRemotionRender ? "none" : "fadeZoom 0.28s ease both",
        }}
      >
        {visiblePage.lines.map((line, lineIndex) => (
          <div
            key={`caption-page-no-highlight-line-${lineIndex}`}
            style={{
              display: "block",
              width: "100%",
              direction: "rtl",
              unicodeBidi: "plaintext" as any,
              whiteSpace: "nowrap",
              textWrap: "nowrap" as any,
              textAlign: "center",
              maxWidth: "100%",
              overflow: "visible",
              paddingInline: 0,
              boxSizing: "border-box",
              marginBlock: "0.46em",
            }}
          >
            {line.map((item, visibleIndex) => (
              <span
                key={`${item.word}-${item.originalIndex}-plain`}
                style={{
                  color,
                  display: "inline",
                  opacity: 1,
                  textShadow: baseStyle.textShadow,
                  filter: "none",
                  transform: "none",
                  transition: isRemotionRender ? "none" : "opacity 0.12s linear",
                }}
              >
                {item.word}
                {ayahNumber &&
                  activePageIndex === captionPages.length - 1 &&
                  visibleIndex === line.length - 1 &&
                  lineIndex === visiblePage.lines.length - 1 && (
                    <span
                      style={{
                        display: "inline-block",
                        marginInlineStart: Math.max(safeSize * 0.16, 7),
                        fontSize: Math.max(safeSize * 0.42, 14),
                        fontWeight: 900,
                        lineHeight: 1,
                        color: "rgba(255,255,255,0.96)",
                        textShadow: isRemotionRender
                          ? "0 1px 3px rgba(0,0,0,0.84)"
                          : "0 1px 5px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.45)",
                        verticalAlign: "-0.02em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {`﴿${toArabicNumbers(ayahNumber)}﴾`}
                    </span>
                  )}
                {visibleIndex < line.length - 1 ? " " : ""}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (words.length <= 1) {
    return (
      <div style={baseStyle}>
        {text}
        {ayahNumber && (
          <span
            style={{
              display: "inline-block",
              marginInlineStart: Math.max(safeSize * 0.14, 7),
              fontSize: Math.max(safeSize * 0.38, 14),
              fontWeight: 900,
              lineHeight: 1,
              color: "rgba(255,255,255,0.96)",
              textShadow: isRemotionRender
                ? "0 1px 3px rgba(0,0,0,0.84)"
                : "0 1px 5px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.45)",
              verticalAlign: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {` ﴿${toArabicNumbers(ayahNumber)}﴾`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      key={`caption-page-${activePageIndex}`}
      style={{
        ...baseStyle,
        paddingLeft: 12,
        paddingRight: 12,
        paddingBottom: 28,
        overflow: "visible",
        animation: isRemotionRender ? "none" : "fadeZoom 0.28s ease both",
      }}
    >
      {activePage.lines.map((line, lineIndex) => (
        <div
          key={`caption-page-line-${lineIndex}`}
          style={{
            display: "block",
            width: "100%",
            direction: "rtl",
            unicodeBidi: "plaintext" as any,
            whiteSpace: "nowrap",
            textWrap: "nowrap" as any,
            textAlign: "center",
            maxWidth: "100%",
            overflow: "visible",
            paddingInline: 0,
            boxSizing: "border-box",
            marginBlock: "0.46em",
          }}
        >
          {line.map((item, visibleIndex) => {
            const isActive = item.originalIndex === activeWordIndex;
            const isPrevious =
              highlightMode === "karaoke" &&
              item.originalIndex < activeWordIndex;

            const wordStyle = getHighlightedWordStyle({
              isActive,
              isPrevious,
              color,
              dimColor,
              highlightColor,
              highlightGlowColor,
              highlightStyle,
              transitionStyle,
              hold: highlightHold,
              isRemotionRender,
            });

            return (
              <span
                key={`${item.word}-${item.originalIndex}`}
                style={wordStyle}
              >
                {item.word}
                {ayahNumber &&
                  activePageIndex === captionPages.length - 1 &&
                  visibleIndex === line.length - 1 &&
                  lineIndex === activePage.lines.length - 1 && (
                    <span
                      style={{
                        display: "inline-block",
                        marginInlineStart: Math.max(safeSize * 0.16, 7),
                        fontSize: Math.max(safeSize * 0.42, 14),
                        fontWeight: 900,
                        lineHeight: 1,
                        color: "rgba(255,255,255,0.96)",
                        textShadow: isRemotionRender
                          ? "0 1px 3px rgba(0,0,0,0.84)"
                          : "0 1px 5px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.45)",
                        verticalAlign: "-0.02em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {`﴿${toArabicNumbers(ayahNumber)}﴾`}
                    </span>
                  )}
                {visibleIndex < line.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function buildFitZoneCaptionPages({
  words,
  fontSize,
  isLandscape = false,
  isSquare = false,
}: {
  words: string[];
  fontSize: number;
  isLandscape?: boolean;
  isSquare?: boolean;
}) {
  if (!words.length) {
    return [{ lines: [] }];
  }

  const lineMaxEm = getNaturalLineMaxEm({ fontSize, isLandscape, isSquare });
  const shortAyahMaxEm = lineMaxEm * 1.02;

  const allWords = words.map((word, index) => ({
    word,
    originalIndex: index,
  }));

  const totalEm = allWords.reduce((sum, item, index) => {
    return sum + estimateArabicWordWidthEm(item.word) + (index > 0 ? 0.42 : 0);
  }, 0);

  // Short ayahs must stay on one line.
  if (allWords.length <= 7 || totalEm <= shortAyahMaxEm) {
    return [{ lines: [allWords] }];
  }

  const pages: CaptionPage[] = [];
  let currentPageLines: Array<Array<{ word: string; originalIndex: number }>> = [];
  let currentLine: Array<{ word: string; originalIndex: number }> = [];
  let currentLineEm = 0;

  const flushLine = () => {
    if (!currentLine.length) return;

    currentPageLines.push(currentLine);
    currentLine = [];
    currentLineEm = 0;

    if (currentPageLines.length >= 2) {
      pages.push({ lines: currentPageLines.slice(0, 2) });
      currentPageLines = [];
    }
  };

  allWords.forEach((item) => {
    const wordEm = estimateArabicWordWidthEm(item.word);
    const spaceEm = currentLine.length ? 0.42 : 0;
    const nextEm = currentLineEm + spaceEm + wordEm;

    if (
      currentLine.length > 0 &&
      nextEm > lineMaxEm &&
      currentLineEm >= lineMaxEm * 0.42
    ) {
      flushLine();
    }

    currentLine.push(item);
    currentLineEm += (currentLine.length > 1 ? 0.42 : 0) + wordEm;
  });

  flushLine();

  if (currentPageLines.length) {
    pages.push({ lines: currentPageLines.slice(0, 2) });
  }

  const balancedPages = pages.map((page) =>
    balanceCaptionPageLines({
      page,
      lineMaxEm,
      isLandscape,
      isSquare,
    }),
  );

  return balancedPages.length ? balancedPages : [{ lines: [allWords] }];
}

function balanceCaptionPageLines({
  page,
  lineMaxEm,
  isLandscape,
  isSquare,
}: {
  page: CaptionPage;
  lineMaxEm: number;
  isLandscape: boolean;
  isSquare: boolean;
}): CaptionPage {
  if (!page.lines || page.lines.length !== 2) {
    return page;
  }

  const items = page.lines.flat();
  if (items.length <= 3) {
    return page;
  }

  const currentFirst = page.lines[0];
  const currentSecond = page.lines[1];
  const currentScore = getLineBalanceScore(currentFirst, currentSecond, lineMaxEm);
  let bestLines = page.lines;
  let bestScore = currentScore;

  for (let split = 2; split <= items.length - 2; split += 1) {
    const first = items.slice(0, split);
    const second = items.slice(split);
    const firstEm = getCaptionLineWidthEm(first);
    const secondEm = getCaptionLineWidthEm(second);
    const maxAllowed = lineMaxEm * (isLandscape ? 0.99 : isSquare ? 0.985 : 0.98);

    if (firstEm > maxAllowed || secondEm > maxAllowed) {
      continue;
    }

    const score = getLineBalanceScore(first, second, lineMaxEm);
    if (score < bestScore) {
      bestScore = score;
      bestLines = [first, second];
    }
  }

  return { lines: bestLines };
}

function getLineBalanceScore(
  first: Array<{ word: string; originalIndex: number }>,
  second: Array<{ word: string; originalIndex: number }>,
  lineMaxEm: number,
) {
  const firstEm = getCaptionLineWidthEm(first);
  const secondEm = getCaptionLineWidthEm(second);
  const balancePenalty = Math.abs(firstEm - secondEm) * 8;
  const unusedSpacePenalty = Math.abs(lineMaxEm - Math.max(firstEm, secondEm)) * 0.35;
  const orphanPenalty = first.length <= 1 || second.length <= 1 ? 120 : 0;

  return balancePenalty + unusedSpacePenalty + orphanPenalty;
}

function getCaptionLineWidthEm(
  line: Array<{ word: string; originalIndex: number }>,
) {
  return line.reduce((sum, item, index) => {
    return sum + estimateArabicWordWidthEm(item.word) + (index > 0 ? 0.42 : 0);
  }, 0);
}

function getNaturalLineMaxEm({
  fontSize,
  isLandscape,
  isSquare,
}: {
  fontSize: number;
  isLandscape: boolean;
  isSquare: boolean;
}) {
  // Tuned for 90% caption width. Larger than the previous nowrap line limit,
  // because this is a natural wrapping block, not a hard one-line layout.
  const base = isLandscape ? 35.5 : isSquare ? 21.4 : 18.9;
  const sizeAdjustment = clampNumber(68 / Math.max(fontSize || 68, 1), 0.92, 1.16);

  return base * sizeAdjustment;
}

function estimateArabicWordWidthEm(rawWord: string) {
  const word = String(rawWord || "");
  let width = 0;

  for (const char of word) {
    if (/[\u064B-\u065F\u0670\u06D6-\u06ED]/u.test(char)) {
      width += 0.02;
      continue;
    }

    if (char === "ـ") {
      width += 0.2;
      continue;
    }

    if (/[اأإآٱلرزدذوؤىء]/u.test(char)) {
      width += 0.34;
      continue;
    }

    if (/[سشصضطظعغفقكمهحة]/u.test(char)) {
      width += 0.58;
      continue;
    }

    if (/[بتثجخننيئ]/u.test(char)) {
      width += 0.5;
      continue;
    }

    if (/[﴿﴾۝۞0-9٠-٩]/u.test(char)) {
      width += 0.46;
      continue;
    }

    width += 0.48;
  }

  return Math.max(width, 0.8);
}

function buildSmartAyahCaptionPages({
  words,
  fontSize,
  isLandscape = false,
  isSquare = false,
}: {
  words: string[];
  fontSize: number;
  isLandscape?: boolean;
  isSquare?: boolean;
}) {
  if (!words.length) {
    return [{ lines: [] }];
  }

  // Real layout behavior:
  // - One visible line only.
  // - The line is built by estimated visual width, not raw character count.
  // - Long ayahs are split into one-line pages that follow the active word.
  const maxLineEm = getSingleLineMaxEm({ fontSize, isLandscape, isSquare });
  const pages: CaptionPage[] = [];
  let line: Array<{ word: string; originalIndex: number }> = [];
  let lineEm = 0;

  words.forEach((word, index) => {
    const wordEm = estimateArabicWordWidthEm(word);
    const spaceEm = line.length ? 0.42 : 0;
    const nextEm = lineEm + spaceEm + wordEm;

    const shouldBreak =
      line.length > 0 &&
      nextEm > maxLineEm &&
      // Avoid pages that are too tiny unless the single word is naturally huge.
      lineEm >= maxLineEm * 0.58;

    if (shouldBreak) {
      pages.push({ lines: [line] });
      line = [];
      lineEm = 0;
    }

    line.push({ word, originalIndex: index });
    lineEm += (line.length > 1 ? 0.42 : 0) + wordEm;
  });

  if (line.length) {
    pages.push({ lines: [line] });
  }

  return pages.length ? pages : [{ lines: [] }];
}

function getSingleLineMaxEm({
  fontSize,
  isLandscape,
  isSquare,
}: {
  fontSize: number;
  isLandscape: boolean;
  isSquare: boolean;
}) {
  // These values are tuned for Amiri Quran's visual width.
  // Landscape can carry more words; vertical must stay readable.
  const base = isLandscape ? 28 : isSquare ? 16 : 13.2;

  // Smaller fonts can carry slightly more text, larger fonts slightly less.
  const sizeAdjustment = clampNumber(64 / Math.max(fontSize || 64, 1), 0.86, 1.18);

  return base * sizeAdjustment;
}

function buildFullAyahCaptionLines({
  words,
  fontSize,
  isLandscape = false,
  isSquare = false,
}: {
  words: string[];
  fontSize: number;
  isLandscape?: boolean;
  isSquare?: boolean;
}) {
  const items = words.map((word, index) => ({ word, originalIndex: index }));
  const totalChars = words.join(" ").length;

  // Keep short and medium ayahs together as much as possible.
  // The transparent full-width layout gives the text real room now.
  if (items.length <= 6 || totalChars <= (isLandscape ? 70 : isSquare ? 48 : 42)) {
    return [items];
  }

  const charsPerLine = isLandscape
    ? clampNumber(fontSize * 6.2, 260, 680)
    : isSquare
      ? clampNumber(fontSize * 5.0, 200, 460)
      : clampNumber(fontSize * 4.6, 185, 410);

const preferredLineCount = clampNumber(
    Math.ceil(totalChars / charsPerLine),
    1,
    isLandscape ? 4 : isSquare ? 5 : 6,
  );

  const lineCount = Math.min(Math.max(preferredLineCount, 1), items.length);
  const targetCharsPerLine = Math.ceil(totalChars / lineCount);
  const lines: Array<Array<{ word: string; originalIndex: number }>> = [];
  let currentLine: Array<{ word: string; originalIndex: number }> = [];
  let currentLength = 0;

  items.forEach((item) => {
    const nextLength = currentLength + item.word.length + (currentLine.length ? 1 : 0);
    const remainingLines = lineCount - lines.length - 1;
    const remainingWordsAfterThis = items.length - item.originalIndex - 1;
    const canStartNewLine =
      currentLine.length > 1 &&
      lines.length < lineCount - 1 &&
      remainingWordsAfterThis >= remainingLines;

    if (canStartNewLine && nextLength > targetCharsPerLine * 1.12) {
      lines.push(currentLine);
      currentLine = [];
      currentLength = 0;
    }

    currentLine.push(item);
    currentLength += item.word.length + (currentLine.length > 1 ? 1 : 0);
  });

  if (currentLine.length) {
    lines.push(currentLine);
  }

  return lines;
}

function buildPagedCaptionLines({
  words,
  fontSize,
  isLandscape = false,
  isSquare = false,
}: {
  words: string[];
  fontSize: number;
  isLandscape?: boolean;
  isSquare?: boolean;
}) {
  if (!words.length) return [];

  return [
    {
      lines: buildFullAyahCaptionLines({
        words,
        fontSize,
        isLandscape,
        isSquare,
      }),
    },
  ];
}

function splitCaptionPageIntoLines(
  items: Array<{ word: string; originalIndex: number }>,
) {
  if (items.length <= 3) {
    return [items];
  }

  let bestSplit = Math.ceil(items.length / 2);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let split = 2; split <= items.length - 1; split += 1) {
    const firstText = items
      .slice(0, split)
      .map((item) => item.word)
      .join(" ");

    const secondText = items
      .slice(split)
      .map((item) => item.word)
      .join(" ");

    const firstLength = firstText.length;
    const secondLength = secondText.length;

    const balancePenalty = Math.abs(firstLength - secondLength);
    const orphanPenalty = items.length - split <= 1 || split <= 1 ? 100 : 0;

    const score = balancePenalty + orphanPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestSplit = split;
    }
  }

  return [items.slice(0, bestSplit), items.slice(bestSplit)];
}

function normalizeAyahsWithBismillahIntro({
  ayahs,
  showBismillahIntro,
  bismillahAudioUrl,
  bismillahDuration,
}: {
  ayahs: Ayah[];
  showBismillahIntro: boolean;
  bismillahAudioUrl: string;
  bismillahDuration: number;
}): Ayah[] {
  const inputAyahs = ayahs.length > 0 ? ayahs : [FALLBACK_AYAH];

  if (!showBismillahIntro) {
    return inputAyahs;
  }

  const intro = createBismillahIntro({ bismillahAudioUrl, bismillahDuration });
  const introDuration = Math.max(Number(bismillahDuration || 3.2), 1.8);
  const cleanedAyahs: Ayah[] = [];
  let removedLeadingBismillah = false;

  for (let index = 0; index < inputAyahs.length; index += 1) {
    const ayah = inputAyahs[index];
    const text = ayah?.text || "";

    if (!text.trim()) {
      continue;
    }

    // Only the fixed intro is allowed to show the basmalah.
    // If the API/source sends basmalah as its own first ayah, drop it.
    if (!removedLeadingBismillah && isBismillahOnly(text)) {
      removedLeadingBismillah = true;
      continue;
    }

    // If the first recited ayah starts with basmalah, remove it from the visible text.
    // This handles diacritics, Quran stop marks, Arabic presentation forms and the ﷽ ligature.
    if (!removedLeadingBismillah && startsWithBismillah(text)) {
      const remainder = removeLeadingBismillahText(text).trim();
      removedLeadingBismillah = true;

      if (!remainder) {
        continue;
      }

      cleanedAyahs.push({
        ...ayah,
        text: remainder,
      });

      continue;
    }

    cleanedAyahs.push(ayah);
  }

  return [intro, ...(cleanedAyahs.length > 0 ? cleanedAyahs : [])];
}

function createBismillahIntro({
  bismillahAudioUrl,
  bismillahDuration,
}: {
  bismillahAudioUrl: string;
  bismillahDuration: number;
}): Ayah {
  return {
    text: BISMILLAH_TEXT,
    audio: bismillahAudioUrl || "",
    duration: Math.max(Number(bismillahDuration || 3.2), 1.8),
    numberInSurah: undefined,
    __isBismillahIntro: true,
  };
}

function isBismillahOnly(text: string) {
  return normalizeArabicForBismillah(text) === normalizeArabicForBismillah(BISMILLAH_TEXT);
}

function startsWithBismillah(text: string) {
  const normalizedText = normalizeArabicForBismillah(text);
  const normalizedBismillah = normalizeArabicForBismillah(BISMILLAH_TEXT);

  return normalizedText.startsWith(normalizedBismillah);
}

function removeLeadingBismillahText(text: string) {
  const trimmed = text.trimStart();

  if (trimmed.startsWith("﷽")) {
    return trimmed.slice("﷽".length).trimStart();
  }

  const words = trimmed.split(/(\s+)/u);
  let normalizedCursor = "";
  let lastTokenToRemove = -1;
  const normalizedBismillah = normalizeArabicForBismillah(BISMILLAH_TEXT);

  for (let index = 0; index < words.length; index += 1) {
    const token = words[index];
    const normalizedToken = normalizeArabicForBismillah(token);

    if (!normalizedToken) {
      continue;
    }

    normalizedCursor += normalizedToken;
    lastTokenToRemove = index;

    if (normalizedCursor === normalizedBismillah) {
      return words.slice(lastTokenToRemove + 1).join("").trimStart();
    }

    if (!normalizedBismillah.startsWith(normalizedCursor)) {
      return trimmed;
    }
  }

  return trimmed;
}

function normalizeArabicForBismillah(value: string) {
  return value
    .replace(/﷽/g, "بسم الله الرحمن الرحيم")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u06D6-\u06ED۝۞]/g, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF]/g, "")
    .trim();
}

function toArabicNumbers(value: number | string) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function splitArabicWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function buildMergedWordStartTimes({
  words,
  duration,
  speed,
  mode,
  manualTimings = [],
}: {
  words: string[];
  duration: number;
  speed: number;
  mode: string;
  manualTimings?: Array<number | null>;
}) {
  if (!words.length) return [];

  const safeDuration = Math.max(duration || 5, 0.5);
  const safeSpeed = Math.max(speed || 1, 0.25);
  const mappedDuration = safeDuration / safeSpeed;

  const autoStartTimes = buildAutoWordStartTimes({
    words,
    duration: mappedDuration,
    mode,
  });

  return autoStartTimes.map((time, index) => {
    const manualTime = manualTimings[index];

    return typeof manualTime === "number"
      ? clampNumber(manualTime, 0, mappedDuration)
      : time;
  });
}

function getActiveWordIndexFast({
  currentTime,
  offset,
  duration,
  speed,
  wordCount,
  startTimes,
}: {
  currentTime: number;
  offset: number;
  duration: number;
  speed: number;
  wordCount: number;
  startTimes: number[];
}) {
  if (!wordCount || !startTimes.length) return 0;

  const safeDuration = Math.max(duration || 5, 0.5);
  const safeSpeed = Math.max(speed || 1, 0.25);
  const mappedDuration = safeDuration / safeSpeed;
  const syncedTime = clampNumber(currentTime + offset, 0, mappedDuration);

  let low = 0;
  let high = startTimes.length - 1;
  let activeIndex = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (startTimes[mid] <= syncedTime) {
      activeIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return clampNumber(activeIndex, 0, wordCount - 1);
}

function getActiveWordIndex({
  currentTime,
  duration,
  words,
  speed,
  offset,
  mode,
  manualTimings = [],
}: {
  currentTime: number;
  duration: number;
  words: string[];
  speed: number;
  offset: number;
  mode: string;
  manualTimings?: Array<number | null>;
}) {
  if (!words.length) return 0;

  const safeDuration = Math.max(duration || 5, 0.5);
  const safeSpeed = Math.max(speed || 1, 0.25);
  const mappedDuration = safeDuration / safeSpeed;
  const syncedTime = clampNumber(currentTime + offset, 0, mappedDuration);

  const autoStartTimes = buildAutoWordStartTimes({
    words,
    duration: mappedDuration,
    mode,
  });

  const mergedStartTimes = autoStartTimes.map((time, index) => {
    const manualTime = manualTimings[index];

    return typeof manualTime === "number"
      ? clampNumber(manualTime, 0, mappedDuration)
      : time;
  });

  let activeIndex = 0;
  let activeStart = -1;

  for (let index = 0; index < mergedStartTimes.length; index += 1) {
    const startTime = mergedStartTimes[index];

    if (syncedTime >= startTime && startTime >= activeStart) {
      activeIndex = index;
      activeStart = startTime;
    }
  }

  return clampNumber(activeIndex, 0, words.length - 1);
}

function buildAutoWordStartTimes({
  words,
  duration,
  mode,
}: {
  words: string[];
  duration: number;
  mode: string;
}) {
  if (!words.length) return [];

  if (mode === "linear" || mode === "karaoke") {
    const wordDuration = duration / words.length;

    return words.map((_, index) => index * wordDuration);
  }

  const weights = words.map(getRecitationWordWeight);
  const totalWeight = weights.reduce((sum, item) => sum + item, 0);

  let cursor = 0;

  return words.map((_, index) => {
    const start = cursor;
    const share = weights[index] / Math.max(totalWeight, 0.001);

    cursor += share * duration;

    return start;
  });
}

function getRecitationWordWeight(rawWord: string) {
  const word = rawWord || "";
  const cleanWord = word.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "");

  const letters = cleanWord.length;
  const harakat = (word.match(/[ًٌٍَُِّْٰ]/g) || []).length;
  const maddLetters = (word.match(/[اويىآ]/g) || []).length;
  const shadda = (word.match(/[ّ]/g) || []).length;

  const hasSmallPause = /[،؛]/.test(word);
  const hasBigPause = /[.؟!ۚۖۗۙۛۜ]/.test(word);
  const hasAyahStop = /[۝۞]/.test(word);

  let weight = 0.9;

  weight += letters * 0.28;
  weight += harakat * 0.035;
  weight += maddLetters * 0.24;
  weight += shadda * 0.2;

  if (hasSmallPause) weight += 0.75;
  if (hasBigPause) weight += 1.15;
  if (hasAyahStop) weight += 1.4;

  return clampNumber(weight, 0.9, 4.5);
}

function getHighlightedWordStyle({
  isActive,
  isPrevious,
  color,
  dimColor,
  highlightColor,
  highlightGlowColor,
  highlightStyle,
  transitionStyle,
  hold,
  isRemotionRender = false,
}: {
  isActive: boolean;
  isPrevious: boolean;
  color: string;
  dimColor: string;
  highlightColor: string;
  highlightGlowColor: string;
  highlightStyle: string;
  transitionStyle: string;
  hold: number;
  isRemotionRender?: boolean;
}) {
  const base: React.CSSProperties = {
    display: "inline",
    margin: "0",
    padding: "0",
    borderRadius: 0,
    color: isPrevious ? color : dimColor,
    opacity: 1,
    transition: isRemotionRender
      ? "none"
      : `color ${Math.max(0.12, hold + 0.16)}s ease, text-shadow ${Math.max(0.12, hold + 0.16)}s ease`,
    transform: "none",
    background: "transparent",
    border: "none",
    boxShadow: "none",
    textShadow: isRemotionRender
      ? "0 2px 5px rgba(0,0,0,0.92)"
      : "0 3px 12px rgba(0,0,0,0.98)",
  };

  if (!isActive) {
    return base;
  }

  const active: React.CSSProperties = {
    ...base,
    color: highlightStyle === "gold" ? "#fef3c7" : highlightColor,
    opacity: 1,
    transform: "none",
    textShadow: isRemotionRender
      ? highlightStyle === "gold"
        ? "0 0 7px rgba(251,191,36,.72), 0 0 10px rgba(0,0,0,.88)"
        : `0 0 8px ${highlightGlowColor}, 0 0 10px rgba(0,0,0,.9)`
      : highlightStyle === "gold"
        ? "0 0 22px rgba(251,191,36,.95), 0 0 16px rgba(0,0,0,.98)"
        : `0 0 20px ${highlightGlowColor}, 0 0 15px rgba(0,0,0,.98)`,
  };

  // No background panels behind highlighted words. Color/glow only.
  if (highlightStyle === "underline") {
    active.borderBottom = `0.08em solid ${highlightColor}`;
    active.borderRadius = 0;
  }

  active.background = "transparent";
  active.border = highlightStyle === "underline" ? active.border : "none";
  active.boxShadow = "none";

  return active;
}

function getTextVerticalPosition(position: string) {
  if (position === "start" || position === "top") return "flex-start";
  if (position === "end" || position === "bottom") return "flex-end";

  return "center";
}

function getAyahAnimation(
  animationStyle: string,
  previewPlaying: boolean,
  isRemotionRender: boolean,
) {
  if (!previewPlaying && !isRemotionRender) return "none";

  if (animationStyle === "fade") return "fadeZoom 0.75s ease";
  if (animationStyle === "zoom") return "fadeZoom 0.9s ease";
  if (animationStyle === "glow") return "fadeZoom 0.75s ease";

  return "slideSoft 0.75s ease";
}

function getAyahManualTimingKey(ayah?: Ayah) {
  if (!ayah) return "fallback";

  return ayah.numberInSurah
    ? `ayah-${ayah.numberInSurah}`
    : `text-${ayah.text.slice(0, 24)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(value: number) {
  const t = clampNumber(value, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(value: number) {
  const safeValue = clampNumber(value, 0, 1);
  return -(Math.cos(Math.PI * safeValue) - 1) / 2;
}

function formatSurahTitle(value: string) {
  const cleaned = value
    .replace(/^\s*سورة\s+/u, "")
    .replace(/^\s*سُورَةُ\s+/u, "")
    .replace(/^\s*سُورَة\s+/u, "")
    .trim();

  if (!cleaned) return "";

  return `سورة ${cleaned}`;
}
