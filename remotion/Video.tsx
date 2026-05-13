"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  staticFile,
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
  backgroundType?: "video" | "image";
  isRemotionRender?: boolean;

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

  showSurahName?: boolean;
  surahName?: string;
  surahNameColor?: string;
  surahNameSize?: number;
  surahNamePosition?: string;

  showReciterName?: boolean;
  reciter?: string;
  reciterNameColor?: string;
  reciterNameSize?: number;
  reciterNamePosition?: string;

  showBrandName?: boolean;
  brandName?: string;
  brandNameColor?: string;
  brandNameSize?: number;
  brandNamePosition?: string;
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
const DEFAULT_BISMILLAH_AUDIO = staticFile("audio/bismillah.mp3");
const FALLBACK_AYAH: Ayah = {
  text: BISMILLAH_TEXT,
  audio: "",
  duration: 5,
  numberInSurah: 1,
};

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

    const duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 0;
    const targetTime = duration > 0 ? previewTime % duration : previewTime;
    const shouldHardSeek = Math.abs(video.currentTime - targetTime) > 0.22;

    if (shouldHardSeek) {
      try {
        video.currentTime = targetTime;
      } catch {
        // ignore browser seek race conditions while metadata is loading
      }
    }

    video.playbackRate = 1;

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
  textSize = 72,
  fontFamily = "KFGQPC Uthmanic Script HAFS",
  backgroundVideoUrl = "",
  backgroundType = "video",
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
  bismillahAudioUrl = DEFAULT_BISMILLAH_AUDIO,
  bismillahDuration = 3.2,

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
  surahNameSize = 30,
  surahNamePosition = "top",

  showReciterName = true,
  reciter = "مشاري العفاسي",
  reciterNameColor = "#facc15",
  reciterNameSize = 28,
  reciterNamePosition = "bottom",

  showBrandName = true,
  brandName = "وذكر | wzkerq",
  brandNameColor = "#ffffff",
  brandNameSize = 24,
  brandNamePosition = "bottom",
  brandNameStyle = "glass",
}: Props) {
  const safeAyahs = useMemo(() => {
    const inputAyahs = ayahs.length > 0 ? ayahs : [FALLBACK_AYAH];

    return normalizeAyahsWithBismillahIntro({
      ayahs: inputAyahs,
      showBismillahIntro,
      bismillahAudioUrl,
      bismillahDuration,
    });
  }, [ayahs, showBismillahIntro, bismillahAudioUrl, bismillahDuration]);

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
    backgroundType,
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

    showReciterName,
    reciter,
    reciterNameColor,
    reciterNameSize,
    reciterNamePosition,

    showBrandName,
    brandName,
    brandNameColor,
    brandNameSize,
    brandNamePosition,
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

  showReciterName,
  reciter,
  reciterNameColor,
  reciterNameSize,
  reciterNamePosition,

  showBrandName,
  brandName,
  brandNameColor,
  brandNameSize,
  brandNamePosition,
  brandNameStyle,
}: ReturnType<typeof useNormalizedProps> & {
  currentAyah: Ayah;
  currentAyahLocalSeconds: number;
  videoProgress: number;
  remainingVideoSeconds: number;
  isRemotionRender: boolean;
  audioLayer: React.ReactNode;
  backgroundVideoRef?: React.RefObject<HTMLVideoElement | null>;
  previewPlaying?: boolean;
}) {
  const IS_LITE_RENDER = isRemotionRender;

  const remotionFontFaceCss = isRemotionRender
    ? `
@font-face {
  font-family: "KFGQPC Uthmanic Script HAFS";
  src: url("${staticFile("fonts/KFGQPC Uthmanic Script HAFS.otf")}") format("opentype");
  font-display: swap;
}

@font-face {
  font-family: "Amiri Quran";
  src: url("${staticFile("fonts/ AmiriQuran-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "Amiri";
  src: url("${staticFile("fonts/ Amiri-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "Noto Naskh Arabic";
  src: url("${staticFile("fonts/ NotoNaskhArabic-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "Cairo";
  src: url("${staticFile("fonts/ Cairo-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "IBM Plex Sans Arabic";
  src: url("${staticFile("fonts/ IBMPlexSansArabic-Regular.ttf")}") format("truetype");
  font-display: swap;
}
`
    : "";

  const animationStyleTag = `

@font-face {
  font-family: "Amiri Quran";
  src: url("${staticFile("fonts/ AmiriQuran-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "Amiri";
  src: url("${staticFile("fonts/ Amiri-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "Noto Naskh Arabic";
  src: url("${staticFile("fonts/ NotoNaskhArabic-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "Cairo";
  src: url("${staticFile("fonts/ Cairo-Regular.ttf")}") format("truetype");
  font-display: swap;
}

@font-face {
  font-family: "IBM Plex Sans Arabic";
  src: url("${staticFile("fonts/ IBMPlexSansArabic-Regular.ttf")}") format("truetype");
  font-display: swap;
}

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
    ? "linear-gradient(to bottom, rgba(0,0,0,0.16), rgba(0,0,0,0.26) 35%, rgba(0,0,0,0.42))"
    : "linear-gradient(to bottom, rgba(0,0,0,0.20), rgba(0,0,0,0.32) 35%, rgba(0,0,0,0.34))";

  const adaptiveTextSize = captionLayout.fontSize;

  const textVerticalPosition = getTextVerticalPosition(textPosition);
  const ayahAnimation = getAyahAnimation(
    animationStyle,
    previewPlaying,
    isRemotionRender,
  );
  const safeSurahTitle = formatSurahTitle(surahName);

  return (
    <>
      <style suppressHydrationWarning>{`${remotionFontFaceCss}${animationStyleTag}`}</style>

      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          background: "#000",
          direction: "rtl",
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
            <OffthreadVideo
              src={backgroundVideoUrl}
              muted
              playbackRate={0.9}
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
            top={95}
            bottom={65}
            variant="plain"
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
          key={`${currentAyah?.__isBismillahIntro ? "bismillah" : currentAyah?.numberInSurah || "ayah"}-${currentAyah?.text}`}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            alignItems: textVerticalPosition,
            justifyContent: "center",
            padding: `0 ${captionLayout.sidePadding}px`,
            textAlign: "center",
            animation: IS_LITE_RENDER ? "none" : ayahAnimation,
          }}
        >
          <div
            style={{
              color: textColor,
              fontSize: Math.max(captionLayout.fontSize * 0.42, 16),
              fontWeight: "bold",
              lineHeight: captionLayout.lineHeight,
              textShadow: isRemotionRender
                ? "0 0 10px rgba(0,0,0,0.9)"
                : "0 0 12px rgba(0,0,0,0.98)",
              background: isRemotionRender
                ? "rgba(0,0,0,0.30)"
                : "rgba(0,0,0,0.36)",
              borderRadius: 38,
              padding: `${captionLayout.paddingY + 22}px ${captionLayout.paddingX + 28}px`,
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: isRemotionRender
                ? "0 6px 16px rgba(0,0,0,0.18)"
                : "0 10px 24px rgba(0,0,0,0.22)",
              width: isLandscapeExport ? "88%" : isSquareExport ? "86%" : "82%",
              maxWidth: captionLayout.maxWidth,
              minWidth: isLandscapeExport ? "56%" : "60%",
              overflow: "visible",
              backdropFilter: IS_LITE_RENDER ? "none" : "blur(10px)",
            }}
          >
            <AnimatedText
              text={
                currentAyah?.text || BISMILLAH_TEXT
              }
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
              ayahNumber={currentAyah?.__isBismillahIntro ? undefined : currentAyah?.numberInSurah}
              isLandscapeCaption={Boolean((captionLayout as any).isLandscape)}
              isSquareCaption={Boolean((captionLayout as any).isSquare)}
              isRemotionRender={isRemotionRender}
            />
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


function normalizeArabicFontFamily(fontFamily: string) {
  const normalized = String(fontFamily || "").trim();

  if (
    normalized === "KFGQPC" ||
    normalized === "KFGQPC Uthmanic" ||
    normalized === "KFGQPC Uthmanic Script" ||
    normalized === "Uthmanic"
  ) {
    return "KFGQPC Uthmanic Script HAFS";
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
    return "Cairo";
  }

  if (normalized === "Amiri") {
    return "Amiri";
  }

  return "KFGQPC Uthmanic Script HAFS";
}

function FloatingText({
  text,
  color,
  size,
  position,
  top,
  bottom,
  variant = "plain",
  isRemotionRender = false,
}: {
  text: string;
  color: string;
  size: number;
  position: string;
  top: number;
  bottom: number;
  variant?: "plain" | "pill" | "glow";
  isRemotionRender?: boolean;
}) {
  const isPill = variant === "pill";
  const isGlow = variant === "glow";

  return (
    <div
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        zIndex: 10,
        textAlign: "center",
        color,
        fontSize: size,
        fontWeight: "bold",
        top:
          position === "top" ? top : position === "center" ? "48%" : undefined,
        bottom: position === "bottom" ? bottom : undefined,
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
          padding: isPill ? "8px 16px" : 0,
          borderRadius: 999,
          background: isPill ? "rgba(0,0,0,0.28)" : "transparent",
          border: isPill ? "1px solid rgba(255,255,255,0.14)" : "none",
          backdropFilter: isPill && !isRemotionRender ? "blur(12px)" : "none",
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

  const referenceWidth = 1080;
  const referenceHeight = 1920;

  const physicalScale = Math.min(
    safeWidth / referenceWidth,
    safeHeight / referenceHeight,
  );

  const opticalScale = Math.pow(clampNumber(physicalScale, 0.52, 1.55), 0.3);
  const userScale = clampNumber(requestedTextSize / 72, 0.72, 1.08);

  // Vertical captions must stay elegant and horizontal, not huge stacked words.
  const baseFont = isLandscape ? 70 : isSquare ? 58 : 50;

  const fontSize = clampNumber(
    baseFont * opticalScale * userScale,
    isLandscape ? 38 : isSquare ? 32 : 34,
    isLandscape ? 70 : isSquare ? 52 : 46,
  );

  return {
    fontSize,
    maxWidth: isLandscape ? "94%" : isSquare ? "90%" : "88%",
    lineHeight: isLandscape ? 1.62 : isSquare ? 1.72 : 1.86,
    sidePadding: isLandscape
      ? Math.round(safeWidth * 0.035)
      : Math.round(safeWidth * 0.055),
    paddingX: isLandscape ? 22 : isSquare ? 24 : 28,
    paddingY: isLandscape ? 12 : isSquare ? 16 : 18,
    borderRadius: isLandscape ? 28 : 34,
    isLandscape,
    isSquare,
  };
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
  const safeSize = Math.min(Math.max(size, 24), isLandscapeCaption ? 64 : isSquareCaption ? 52 : 46);
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
    if (canUsePreparedData && preparedData?.captionPages?.length) {
      return preparedData.captionPages;
    }

    return buildPagedCaptionLines({
      words,
      fontSize: safeSize,
      isLandscape: isLandscapeCaption,
      isSquare: isSquareCaption,
    });
  }, [
    canUsePreparedData,
    preparedData,
    words,
    safeSize,
    isLandscapeCaption,
    isSquareCaption,
  ]);

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
    offset: highlightOffset,
    duration,
    speed: highlightSpeed,
    wordCount: words.length,
    startTimes: wordStartTimes,
  });

  const activePage = captionPages.find((page) =>
    page.lines.some((line) =>
      line.some((item) => item.originalIndex === activeWordIndex),
    ),
  ) ||
    captionPages[0] || {
      lines: [words.map((word, index) => ({ word, originalIndex: index }))],
    };

  const resolvedFontFamily = normalizeArabicFontFamily(fontFamily);

  const baseStyle: React.CSSProperties = {
    color,
    fontSize: safeSize,
    fontWeight: 800,
    lineHeight: isLandscapeCaption ? 1.9 : isSquareCaption ? 2.02 : 2.15,
    textShadow: isRemotionRender
      ? "0 2px 5px rgba(0,0,0,0.95)"
      : "0 1px 4px rgba(0,0,0,0.9)",
    direction: "rtl",
    unicodeBidi: "plaintext",
    fontFamily: `"${resolvedFontFamily}", "KFGQPC Uthmanic Script HAFS", "Amiri Quran", "Noto Naskh Arabic", "Amiri", serif`,
    fontKerning: "normal",
    fontVariantLigatures: "common-ligatures",
    fontFeatureSettings: '"liga" 1, "calt" 1, "kern" 1',
    textRendering: "geometricPrecision",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    textAlign: "center",
    whiteSpace: "normal",
    wordBreak: "normal",
    wordSpacing: isLandscapeCaption ? "0.10em" : "0.12em",
    overflowWrap: "normal",
    maxWidth: "100%",
    letterSpacing: "0",
    animation:
      animationStyle === "glow" && !isRemotionRender
        ? undefined
        : undefined,
  };

  if (!showWordHighlight || words.length <= 1) {
    return <div style={baseStyle}>{text}</div>;
  }

  return (
    <div style={baseStyle}>
      {activePage.lines.map((line, lineIndex) => (
        <div
          key={`caption-page-line-${lineIndex}`}
          style={{
            display: "block",
            whiteSpace: "normal",
            maxWidth: "100%",
            overflow: "visible",
            marginBlock: isLandscapeCaption ? "0.02em" : "0.04em",
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

  const maxWordsPerPage = isLandscape ? 14 : isSquare ? 7 : 5;
  const targetCharsPerPage = isLandscape
    ? clampNumber(Math.round(fontSize * 2.4), 72, 130)
    : isSquare
      ? clampNumber(Math.round(fontSize * 1.7), 42, 74)
      : clampNumber(Math.round(fontSize * 1.28), 26, 48);

  const pages: Array<{
    lines: Array<Array<{ word: string; originalIndex: number }>>;
  }> = [];

  let pageItems: Array<{ word: string; originalIndex: number }> = [];
  let pageLength = 0;

  words.forEach((word, index) => {
    const nextLength = pageLength + word.length + (pageItems.length ? 1 : 0);

    const shouldStartNewPage =
      pageItems.length >= 3 &&
      (nextLength > targetCharsPerPage || pageItems.length >= maxWordsPerPage);

    if (shouldStartNewPage) {
      pages.push({
        lines: splitCaptionPageIntoLines(pageItems),
      });

      pageItems = [];
      pageLength = 0;
    }

    pageItems.push({ word, originalIndex: index });
    pageLength += word.length + (pageItems.length > 1 ? 1 : 0);
  });

  if (pageItems.length) {
    pages.push({
      lines: splitCaptionPageIntoLines(pageItems),
    });
  }

  return pages;
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
    audio: bismillahAudioUrl || DEFAULT_BISMILLAH_AUDIO,
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
    margin: "0 0.08em",
    padding: "0 0.06em",
    borderRadius: 14,
    color: isPrevious ? color : dimColor,
    opacity: 1,
    transition: isRemotionRender
      ? "none"
      : `color ${Math.max(0.12, hold + 0.16)}s ease, text-shadow ${Math.max(0.12, hold + 0.16)}s ease`,
    transform: "none",
    textShadow: isRemotionRender
      ? "0 2px 5px rgba(0,0,0,0.92)"
      : "0 3px 14px rgba(0,0,0,0.98)",
  };

  if (!isActive) {
    return base;
  }

  const active: React.CSSProperties = {
    ...base,
    color: highlightStyle === "gold" ? "#fde68a" : highlightColor,
    opacity: 1,
    transform: "none",
    textShadow: isRemotionRender
      ? highlightStyle === "gold"
        ? "0 0 5px rgba(251,191,36,.62), 0 0 8px rgba(0,0,0,.86)"
        : `0 0 5px ${highlightGlowColor}, 0 0 8px rgba(0,0,0,.88)`
      : highlightStyle === "gold"
        ? "0 0 16px rgba(251,191,36,.85), 0 0 12px rgba(0,0,0,.95)"
        : `0 0 14px ${highlightGlowColor}, 0 0 12px rgba(0,0,0,.98)`,
  };

  if (highlightStyle === "pill") {
    active.background = `${highlightColor}26`;
    active.border = `1px solid ${highlightColor}66`;
    active.boxShadow = isRemotionRender
      ? "none"
      : `0 0 22px ${highlightGlowColor}66`;
  }

  if (highlightStyle === "underline") {
    active.borderBottom = `4px solid ${highlightColor}`;
    active.borderRadius = 6;
  }

  if (highlightStyle === "gold") {
    active.background = "transparent";
    active.border = "none";
    active.boxShadow = "none";
  }

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

function formatSurahTitle(value: string) {
  const cleaned = value
    .replace(/^\s*سورة\s+/u, "")
    .replace(/^\s*سُورَةُ\s+/u, "")
    .replace(/^\s*سُورَة\s+/u, "")
    .trim();

  if (!cleaned) return "";

  return `سورة ${cleaned}`;
}
