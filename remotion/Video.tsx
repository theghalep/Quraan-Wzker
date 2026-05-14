"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Audio,
  Img,
  Loop,
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
  tafsir?: string;
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

const BACKGROUND_LOOP_SECONDS = 7;
const BACKGROUND_LOOP_CROSSFADE_SECONDS = 1.65;

const QURAN_FONT_FACE_CSS = `
@font-face {
  font-family: "KFGQPC Uthmanic Script HAFS";
  src: url("${staticFile("fonts/KFGQPC Uthmanic Script HAFS.otf")}") format("opentype");
  font-weight: 400 900;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Amiri Quran";
  src: url("${staticFile("fonts/AmiriQuran-Regular.ttf")}") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Amiri";
  src: url("${staticFile("fonts/Amiri-Regular.ttf")}") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Noto Naskh Arabic";
  src: url("${staticFile("fonts/NotoNaskhArabic-Regular.ttf")}") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Cairo";
  src: url("${staticFile("fonts/Cairo-Regular.ttf")}") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "IBM Plex Sans Arabic";
  src: url("${staticFile("fonts/IBMPlexSansArabic-Regular.ttf")}") format("truetype");
  font-weight: 400 900;
  font-style: normal;
  font-display: block;
}
`;

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

    try {
      video.playbackRate = smartBackgroundPlaybackRate;
    } catch {
      // ignore playbackRate assignment errors
    }

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
  textSize = 48,
  fontFamily = "Amiri Quran",
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

  showTafsir = false,
  tafsirText = "",
  tafsirColor = "rgba(255,255,255,0.88)",
  tafsirSize = 17,

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
  surahNameX,
  surahNameY,

  showReciterName = true,
  reciter = "مشاري العفاسي",
  reciterNameColor = "#facc15",
  reciterNameSize = 28,
  reciterNamePosition = "bottom",
  reciterNameX,
  reciterNameY,

  showBrandName = true,
  brandName = "وذكر | wzkerq",
  brandNameColor = "#ffffff",
  brandNameSize = 24,
  brandNamePosition = "bottom",
  brandNameX,
  brandNameY,
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

  const smartBackgroundPlaybackRate = getSmartBackgroundPlaybackRate({
    sourceDurationInSeconds: Number(backgroundVideoDuration || 0),
    targetDurationInSeconds: Number(totalVideoDuration || 0),
  });

  return (
    <>
      <style suppressHydrationWarning>{`${QURAN_FONT_FACE_CSS}${animationStyleTag}`}</style>

      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
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
            x={surahNameX}
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
            x={reciterNameX}
            y={reciterNameY}
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
          key={`${currentAyah?.__isBismillahIntro ? "bismillah" : currentAyah?.numberInSurah || "ayah"}-${currentAyah?.text}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: captionLayout.zoneTop,
            bottom:
              showTafsir && !currentAyah?.__isBismillahIntro
                ? `calc(${captionLayout.zoneBottom} + 5%)`
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
                  ? captionLayout.fontSize * 0.86
                  : captionLayout.fontSize,
              fontWeight: 800,
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

            {showTafsir &&
              !currentAyah?.__isBismillahIntro &&
              (currentAyah?.tafsir || tafsirText) && (
                <TafsirText
                  text={currentAyah?.tafsir || tafsirText}
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

  const safeSize = clampNumber(
    Number(size || 17),
    isLandscapeCaption ? 11 : 12,
    isLandscapeCaption ? 20 : isSquareCaption ? 19 : 18,
  );

  const maxLines = isLandscapeCaption ? 2 : isSquareCaption ? 2 : 3;

  return (
    <div
      style={{
        marginTop: isLandscapeCaption ? "0.9em" : "1.15em",
        marginInline: "auto",
        padding: 0,
        width: "98%",
        maxWidth: isLandscapeCaption ? "92%" : "98%",
        color,
        fontSize: safeSize,
        lineHeight: isLandscapeCaption ? 1.58 : 1.66,
        fontWeight: 800,
        fontFamily: `"Cairo", "IBM Plex Sans Arabic", "Noto Naskh Arabic", sans-serif`,
        textAlign: "center",
        direction: "rtl",
        unicodeBidi: "plaintext",
        textWrap: "balance" as any,
        whiteSpace: "normal",
        textShadow: isRemotionRender
          ? "0 1px 4px rgba(0,0,0,0.9)"
          : "0 2px 8px rgba(0,0,0,0.95)",
        opacity: 0.94,
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: "vertical",
      }}
    >
      {cleanText}
    </div>
  );
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

  // Reels need a concise meaning, not a full paragraph.
  const maxLength = 150;
  if (normalized.length <= maxLength) return normalized;

  const clipped = normalized.slice(0, maxLength);
  const lastStop = Math.max(
    clipped.lastIndexOf("،"),
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("؛"),
  );

  if (lastStop > 70) {
    return `${clipped.slice(0, lastStop).trim()}…`;
  }

  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 70 ? lastSpace : maxLength).trim()}…`;
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
    return "Cairo";
  }

  if (normalized === "Amiri") {
    return "Amiri";
  }

  return "Amiri Quran";
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
        fontWeight: 800,
        fontFamily: `"Cairo", "IBM Plex Sans Arabic", "Noto Naskh Arabic", sans-serif`,
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
          padding: isPill ? "8px 16px" : 0,
          borderRadius: 999,
          background: isPill ? "rgba(0,0,0,0.28)" : "transparent",
          border: isPill ? "1px solid rgba(255,255,255,0.14)" : "none",
          backdropFilter: isPill && !isRemotionRender ? "blur(12px)" : "none",
          fontFamily: `"Cairo", "IBM Plex Sans Arabic", "Noto Naskh Arabic", sans-serif`,
          whiteSpace: "nowrap",
          width: "max-content",
          maxWidth: "none",
          flexShrink: 0,
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

  // Dedicated caption safe area:
  // Vertical keeps the top and bottom quarters free for labels, player, tafsir later.
  // Landscape gets a wider middle band.
  const zonePaddingRatio = isLandscape ? 0.2 : isSquare ? 0.25 : 0.31;
  const zoneTop = `${zonePaddingRatio * 100}%`;
  const zoneBottom = `${zonePaddingRatio * 100}%`;

  const referenceWidth = 1080;
  const referenceHeight = 1920;
  const physicalScale = Math.min(
    safeWidth / referenceWidth,
    safeHeight / referenceHeight,
  );

  const opticalScale = Math.pow(clampNumber(physicalScale, 0.52, 1.55), 0.1);
  const userScale = clampNumber(Number(requestedTextSize || 58) / 58, 0.78, 1.25);

  const baseFont = isLandscape
    ? Math.min(safeWidth, safeHeight) * 0.06
    : isSquare
      ? Math.min(safeWidth, safeHeight) * 0.058
      : safeWidth * 0.044;

  const fontSize = clampNumber(
    baseFont * opticalScale * userScale,
    isLandscape ? 28 : isSquare ? 30 : 32,
    isLandscape ? 54 : isSquare ? 56 : 58,
  );

  return {
    fontSize,
    maxWidth: "100%",
    lineHeight: isLandscape ? 1.42 : isSquare ? 1.48 : 1.54,
    sidePadding: Math.round(safeWidth * 0.05),
    paddingX: 0,
    paddingY: 0,
    borderRadius: 0,
    zoneTop,
    zoneBottom,
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

  const minSize = isLandscape ? 26 : isSquare ? 28 : 30;
  const maxSize = isLandscape ? 58 : isSquare ? 60 : 62;

  let targetSize = clampNumber(requestedSize, minSize, maxSize);

  if (isLandscape) {
    if (density <= 38) targetSize = Math.max(targetSize, 56);
    else if (density <= 70) targetSize = Math.max(targetSize, 48);
    else if (density <= 115) targetSize = Math.min(targetSize, 40);
    else if (density <= 190) targetSize = Math.min(targetSize, 34);
    else targetSize = Math.min(targetSize, 30);
  } else if (isSquare) {
    if (density <= 38) targetSize = Math.max(targetSize, 58);
    else if (density <= 70) targetSize = Math.max(targetSize, 48);
    else if (density <= 115) targetSize = Math.min(targetSize, 40);
    else if (density <= 190) targetSize = Math.min(targetSize, 34);
    else targetSize = Math.min(targetSize, 30);
  } else {
    if (density <= 38) targetSize = Math.max(targetSize, 58);
    else if (density <= 70) targetSize = Math.max(targetSize, 48);
    else if (density <= 115) targetSize = Math.min(targetSize, 40);
    else if (density <= 190) targetSize = Math.min(targetSize, 34);
    else targetSize = Math.min(targetSize, 30);
  }

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
    offset: highlightOffset,
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
    fontWeight: 800,
    lineHeight: isLandscapeCaption ? 1.72 : isSquareCaption ? 1.78 : 1.9,
    textShadow: isRemotionRender
      ? "0 3px 7px rgba(0,0,0,0.95)"
      : "0 3px 9px rgba(0,0,0,0.96)",
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
    textWrap: "balance" as any,
    whiteSpace: "normal",
    wordBreak: "normal",
    wordSpacing: isLandscapeCaption ? "0.01em" : "0.012em",
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

  if (!showWordHighlight || words.length <= 1) {
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
            whiteSpace: "normal",
            textWrap: "balance" as any,
            textAlign: "center",
            maxWidth: "100%",
            overflow: "visible",
            paddingInline: 0,
            boxSizing: "border-box",
            marginBlock: "0.06em",
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

  // New approach:
  // We page by total visual width, not by pre-forcing visual lines.
  // Each page is rendered as one natural wrapping block using the full caption width.
  // This avoids both problems:
  // 1) text going outside the frame
  // 2) text becoming a tiny narrow column in the middle
  const maxLinesPerPage = isLandscape ? 2 : isSquare ? 2 : 3;
  const lineMaxEm = getNaturalLineMaxEm({ fontSize, isLandscape, isSquare });
  const pageMaxEm = lineMaxEm * maxLinesPerPage * 0.92;

  const pages: CaptionPage[] = [];
  let pageWords: Array<{ word: string; originalIndex: number }> = [];
  let pageEm = 0;

  words.forEach((word, index) => {
    const wordEm = estimateArabicWordWidthEm(word);
    const spaceEm = pageWords.length ? 0.42 : 0;
    const nextEm = pageEm + spaceEm + wordEm;

    const shouldBreak =
      pageWords.length > 0 &&
      nextEm > pageMaxEm &&
      pageEm >= pageMaxEm * 0.55;

    if (shouldBreak) {
      pages.push({ lines: [pageWords] });
      pageWords = [];
      pageEm = 0;
    }

    pageWords.push({ word, originalIndex: index });
    pageEm += (pageWords.length > 1 ? 0.42 : 0) + wordEm;
  });

  if (pageWords.length) {
    pages.push({ lines: [pageWords] });
  }

  return pages.length ? pages : [{ lines: [words.map((word, index) => ({ word, originalIndex: index }))] }];
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
  const base = isLandscape ? 36 : isSquare ? 21 : 18.5;
  const sizeAdjustment = clampNumber(50 / Math.max(fontSize || 50, 1), 0.92, 1.16);

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
