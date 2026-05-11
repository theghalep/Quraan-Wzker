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

type Ayah = {
  text: string;
  audio?: string;
  duration?: number;
  numberInSurah?: number;
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

  previewPlaying?: boolean;
  previewSeekSeconds?: number;

  textPosition?: string;
  animationStyle?: string;
  wordSpeed?: string;

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

const FALLBACK_AYAH: Ayah = {
  text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  audio: "",
  duration: 5,
  numberInSurah: 1,
};

const DEFAULT_FPS = 30;

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
  const currentAyah =
    getTimelineItemByFrame(timeline, frame)?.ayah || normalized.safeAyahs[0];

  const videoProgress = Math.min((frame / Math.max(totalFrames, 1)) * 100, 100);
  const remainingVideoSeconds = Math.max(
    Math.ceil(totalSeconds - frame / (fps || DEFAULT_FPS)),
    0,
  );

  return (
    <VideoCanvas
      {...normalized}
      currentAyah={currentAyah}
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

    const shouldHardSeek = Math.abs(audio.currentTime - ayahLocalTime) > 0.18;

    if (shouldHardSeek) {
      try {
        audio.currentTime = ayahLocalTime;
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
  fontFamily = "Amiri",
  backgroundVideoUrl = "",
  backgroundType = "video",

  textPosition = "center",
  animationStyle = "slide",
  wordSpeed = "normal",

  showProgressBar = true,
  showCountdownTimer = true,
  progressColor = "#34d399",
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
  reciterNameColor = "#34d399",
  reciterNameSize = 28,
  reciterNamePosition = "bottom",

  showBrandName = true,
  brandName = "وذكر | wzkerq",
  brandNameColor = "#ffffff",
  brandNameSize = 24,
  brandNamePosition = "bottom",
  brandNameStyle = "glass",
}: Props) {
  const safeAyahs = useMemo(
    () => (ayahs.length > 0 ? ayahs : [FALLBACK_AYAH]),
    [ayahs],
  );

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

    textPosition,
    animationStyle,
    wordSpeed,

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
  textPosition,
  animationStyle,

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
  videoProgress: number;
  remainingVideoSeconds: number;
  isRemotionRender: boolean;
  audioLayer: React.ReactNode;
  backgroundVideoRef?: React.RefObject<HTMLVideoElement | null>;
  previewPlaying?: boolean;
}) {
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

  const adaptiveTextSize =
    currentAyah?.text?.length > 95
      ? textSize * 0.48
      : currentAyah?.text?.length > 75
        ? textSize * 0.56
        : currentAyah?.text?.length > 45
          ? textSize * 0.7
          : textSize;

  const textVerticalPosition = getTextVerticalPosition(textPosition);
  const ayahAnimation = getAyahAnimation(
    animationStyle,
    previewPlaying,
    isRemotionRender,
  );
  const safeSurahTitle = formatSurahTitle(surahName);

  return (
    <>
      <style>{animationStyleTag}</style>

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
                "radial-gradient(circle at top, rgba(52,211,153,0.22), transparent 35%), linear-gradient(to bottom, #021b13, #000000, #04281e)",
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
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.22), rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.72))",
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.42) 100%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {showSurahName && safeSurahTitle && (
          <FloatingText
            text={safeSurahTitle}
            color={surahNameColor}
            size={surahNameSize}
            position={surahNamePosition}
            top={45}
            bottom={105}
            variant="pill"
          />
        )}

        {showReciterName && (
          <FloatingText
            text={reciter}
            color={reciterNameColor}
            size={reciterNameSize}
            position={reciterNamePosition}
            top={95}
            bottom={65}
            variant="plain"
          />
        )}

        {showBrandName && (
          <FloatingText
            text={brandName}
            color={brandNameColor}
            size={brandNameSize}
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
          />
        )}

        <div
          key={currentAyah?.numberInSurah || currentAyah?.text}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            alignItems: textVerticalPosition,
            justifyContent: "center",
            padding: "0 55px",
            textAlign: "center",
            animation: ayahAnimation,
          }}
        >
          <div
            style={{
              color: textColor,
              fontSize: textSize * 0.42,
              fontWeight: "bold",
              lineHeight: 1.9,
              textShadow: "0 0 32px rgba(0,0,0,0.98)",
              backdropFilter: "blur(5px)",
              background:
                "linear-gradient(135deg, rgba(0,0,0,0.24), rgba(0,0,0,0.08))",
              borderRadius: 28,
              padding: "24px 28px",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 18px 70px rgba(0,0,0,0.48)",
              maxWidth: "100%",
            }}
          >
            <AnimatedText
              text={
                currentAyah?.text || "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
              }
              color={textColor}
              size={adaptiveTextSize}
              fontFamily={fontFamily}
              animationStyle={animationStyle}
            />

            {currentAyah?.numberInSurah && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  marginTop: 8,
                  minWidth: 34,
                  height: 34,
                  borderRadius: 999,
                  fontSize: Math.min(textSize * 0.42, 20),
                  opacity: 0.95,
                  color: textColor,
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                {currentAyah.numberInSurah}
              </span>
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
              textShadow: "0 0 20px rgba(0,0,0,0.9)",
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
              left: 45,
              right: 45,
              top: progressPosition === "top" ? 12 : undefined,
              bottom: progressPosition === "bottom" ? 12 : undefined,
              height: progressHeight,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              zIndex: 30,
              overflow: "hidden",
              boxShadow: "0 0 22px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                width: `${videoProgress}%`,
                height: "100%",
                borderRadius: 999,
                background: progressColor,
                boxShadow: `0 0 18px ${progressColor}`,
                transition: isRemotionRender ? "none" : "width 0.08s linear",
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

function FloatingText({
  text,
  color,
  size,
  position,
  top,
  bottom,
  variant = "plain",
}: {
  text: string;
  color: string;
  size: number;
  position: string;
  top: number;
  bottom: number;
  variant?: "plain" | "pill" | "glow";
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
        textShadow: isGlow
          ? `0 0 22px ${color}, 0 0 35px rgba(0,0,0,0.95)`
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
          backdropFilter: isPill ? "blur(12px)" : "none",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function AnimatedText({
  text,
  color,
  size,
  fontFamily,
  animationStyle,
}: {
  text: string;
  color: string;
  size: number;
  fontFamily: string;
  animationStyle: string;
}) {
  return (
    <div
      style={{
        color,
        fontSize: Math.min(size, 38),
        fontWeight: "bold",
        lineHeight: 1.95,
        textShadow: "0 0 30px rgba(0,0,0,0.95)",
        direction: "rtl",
        unicodeBidi: "isolate",
        fontFamily: `"${fontFamily}", "Amiri", "Noto Naskh Arabic", serif`,
        textAlign: "center",
        whiteSpace: "normal",
        wordBreak: "normal",
        maxWidth: "100%",
        animation:
          animationStyle === "glow"
            ? "glowText 2.2s ease-in-out infinite"
            : undefined,
      }}
    >
      {text}
    </div>
  );
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

function formatSurahTitle(value: string) {
  const cleaned = value
    .replace(/^\s*سورة\s+/u, "")
    .replace(/^\s*سُورَةُ\s+/u, "")
    .replace(/^\s*سُورَة\s+/u, "")
    .trim();

  if (!cleaned) return "";

  return `سورة ${cleaned}`;
}
