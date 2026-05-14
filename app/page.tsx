"use client";

import Video from "@/remotion/Video";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pickBackgroundFromTopics } from "@/lib/background-themes";

type Reciter = {
  identifier: string;
  englishName: string;
  name: string;
};

type Surah = {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
};

type Ayah = {
  numberInSurah: number;
  text: string;
  audio?: string;
};

type ReelAyah = {
  text: string;
  audio: string;
  duration: number;
  numberInSurah: number;
  tafsir?: string;
};

type AiSuggestion = {
  id: string;
  title: string;
  reason: string;
  chapter: string;
  surahName: string;
  fromAyah: string;
  toAyah: string;
  matchedAyahNumber: string;
  matchedAyahText: string;
  matchedWords: string[];
  score: number;
  scoreBreakdown?: {
    exactTextMatch: number;
    looseMatch: number;
    matchedWordsBonus: number;
    famousVerseBoost: number;
    contextualQueryBoost: number;
    total: number;
  };
  detectedTopics?: string[];
  hook?: string;
  shortTitle?: string;
  caption?: string;
  backgroundStyle: string;
  textColor: string;
  progressColor: string;
  textPosition: string;
  animationStyle: string;
  wordSpeed: string;
  showSurahName: boolean;
  showReciterName: boolean;
  showBrandName: boolean;
  showProgressBar: boolean;
  showCountdownTimer: boolean;
};

type ExportJob = {
  id?: string;
  jobId?: string;
  status: string;
  progress?: number;
  fileName?: string;
  url?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
  completedAt?: number | string;
  error?: string;
  reciter?: string;
  surahName?: string;
  fromAyah?: number | string;
  toAyah?: number | string;
  durationInSeconds?: number;
  metadata?: {
    reciter?: string;
    surahName?: string;
    firstAyah?: number | string;
    lastAyah?: number | string;
    durationInSeconds?: number;
  };
};

const SUGGESTED_PROMPTS = [
  "راحة نفسية",
  "حزن",
  "دعاء",
  "رزق",
  "توبة",
  "صبر",
  "قلق",
  "زواج",
];

const TRENDING_PROMPTS = [
  "الطمأنينة",
  "قيام الليل",
  "التوبة",
  "الرزق",
  "الوالدين",
];

type ExportPresetId =
  | "reels"
  | "tiktok"
  | "shorts"
  | "whatsapp"
  | "square"
  | "landscape";

type ExportQualityId = "draft" | "standard" | "high" | "ultra";

type HookStyle = "reflection" | "question" | "warning" | "emotional";

const EXPORT_QUALITIES: Array<{
  id: ExportQualityId;
  label: string;
  description: string;
  badge: string;
}> = [
  {
    id: "draft",
    label: "Draft",
    description: "سريع وخفيف للتجربة فقط",
    badge: "أسرع",
  },
  {
    id: "standard",
    label: "Standard",
    description: "جودة كويسة وحجم مناسب",
    badge: "متوازن",
  },
  {
    id: "high",
    label: "High",
    description: "أفضل اختيار للنشر",
    badge: "مقترح",
  },
  {
    id: "ultra",
    label: "Ultra",
    description: "أعلى جودة وأكبر حجم",
    badge: "أعلى جودة",
  },
];

const EXPORT_PRESETS: Array<{
  id: ExportPresetId;
  label: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  quality: "standard" | "high";
}> = [
  {
    id: "reels",
    label: "Instagram Reels",
    description: "أفضل مقاس للريلز والستوري العمودي",
    width: 1080,
    height: 1920,
    fps: 30,
    quality: "high",
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "فيديو عمودي كامل الشاشة",
    width: 1080,
    height: 1920,
    fps: 30,
    quality: "high",
  },
  {
    id: "shorts",
    label: "YouTube Shorts",
    description: "مقاس الشورتس القياسي",
    width: 1080,
    height: 1920,
    fps: 30,
    quality: "high",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Status",
    description: "نسخة أخف مناسبة للحالة",
    width: 720,
    height: 1280,
    fps: 30,
    quality: "standard",
  },
  {
    id: "square",
    label: "Square Post",
    description: "بوست مربع للسوشيال",
    width: 1080,
    height: 1080,
    fps: 30,
    quality: "high",
  },
  {
    id: "landscape",
    label: "Landscape",
    description: "يوتيوب أو عرض أفقي",
    width: 1920,
    height: 1080,
    fps: 30,
    quality: "high",
  },
];

const PreviewVideo = memo(Video as any);

const FALLBACK_PREVIEW_AYAHS: ReelAyah[] = [
  {
    text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    audio: "",
    duration: 5,
    numberInSurah: 1,
  },
];

const DEFAULT_BISMILLAH_DURATION_SECONDS = 3.2;
const BISMILLAH_TEXT = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";

const PREVIEW_BARS = Array.from({ length: 32 }, (_, index) => ({
  index,
  height: 18 + ((index * 17) % 34),
}));

const SYNC_WAVE_BARS = Array.from({ length: 48 }, (_, index) => ({
  index,
  height: 16 + ((index * 19) % 46),
}));

const BACKGROUND_CARDS = [
  {
    id: "rain",
    title: "مطر",
    description: "أجواء هادئة ومطر سينمائي",
    image:
      "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "clouds",
    title: "سحاب",
    description: "سماء ناعمة وحركة هادئة",
    image:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "mosque",
    title: "مسجد",
    description: "طابع إسلامي روحاني",
    image:
      "https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "nature",
    title: "طبيعة",
    description: "مشاهد طبيعية مريحة",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "night",
    title: "ليل",
    description: "أجواء ليلية ونجوم",
    image:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop",
  },
];


export default function Home() {
  const isMobile = useIsMobile();
  const exportLogTimersRef = useRef<number[]>([]);

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);

  const [chapter, setChapter] = useState("1");
  const [fromAyah, setFromAyah] = useState("1");
  const [toAyah, setToAyah] = useState("1");
  const [reciter, setReciter] = useState("ar.alafasy");

  const [selectedAyahs, setSelectedAyahs] = useState<ReelAyah[]>([]);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState("62");
  const [fontFamily, setFontFamily] = useState("Amiri Quran");

  const [backgroundStyle, setBackgroundStyle] = useState("emerald");
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState("");
  const [backgroundVideoDuration, setBackgroundVideoDuration] = useState(0);
  const [backgroundType, setBackgroundType] = useState<"video" | "image">(
    "video",
  );
  const [customBackgroundName, setCustomBackgroundName] = useState("");
  const [customBackgroundSize, setCustomBackgroundSize] = useState<
    number | null
  >(null);
  const [customBackgroundMimeType, setCustomBackgroundMimeType] = useState("");
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [loadingBackground, setLoadingBackground] = useState(false);

  const [textPosition, setTextPosition] = useState("center");
  const [animationStyle, setAnimationStyle] = useState("slide");
  const [wordSpeed, setWordSpeed] = useState("normal");

  const [showTafsir, setShowTafsir] = useState(true);
  const [tafsirText, setTafsirText] = useState("تفسير مختصر يظهر هنا أسفل الآية، ويمكن لاحقًا جلبه تلقائيًا لكل آية.");
  const [tafsirColor, setTafsirColor] = useState("#ffffff");
  const [tafsirSize, setTafsirSize] = useState("17");
  const [tafsirSource, setTafsirSource] = useState("muyassar");

  const [showWordHighlight, setShowWordHighlight] = useState(true);
  const [wordHighlightColor, setWordHighlightColor] = useState("#34d399");
  const [wordHighlightGlowColor, setWordHighlightGlowColor] =
    useState("#34d399");
  const [wordDimColor, setWordDimColor] = useState("rgba(255,255,255,0.62)");
  const [wordHighlightStyle, setWordHighlightStyle] = useState("glow");
  const [wordHighlightTransition, setWordHighlightTransition] =
    useState("scale");
  const [wordHighlightSpeed, setWordHighlightSpeed] = useState("1");
  const [wordHighlightOffset, setWordHighlightOffset] = useState("0");
  const [wordHighlightHold, setWordHighlightHold] = useState("0.12");
  const [wordHighlightMode, setWordHighlightMode] = useState("smart");
  const [manualWordTimings, setManualWordTimings] = useState<
    Record<string, Array<number | null>>
  >({});
  const [tapSyncIndex, setTapSyncIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [exportFileName, setExportFileName] = useState("quran-reel.mp4");
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [realRenderProgress, setRealRenderProgress] = useState(0);
  const [exportStartedAt, setExportStartedAt] = useState<number | null>(null);
  const [exportElapsedSeconds, setExportElapsedSeconds] = useState(0);
  const [exportEstimatedTotalSeconds, setExportEstimatedTotalSeconds] =
    useState(0);
  const [exportEstimatedRemainingSeconds, setExportEstimatedRemainingSeconds] =
    useState(0);
  const [recentExports, setRecentExports] = useState<ExportJob[]>([]);
  const [loadingRecentExports, setLoadingRecentExports] = useState(false);

  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAiReel, setGeneratingAiReel] = useState(false);
  const [aiSuggestionTitle, setAiSuggestionTitle] = useState("");
  const [aiSuggestionReason, setAiSuggestionReason] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiSearchWords, setAiSearchWords] = useState<string[]>([]);
  const [aiSearchMessage, setAiSearchMessage] = useState("");
  const [selectedAiSuggestionId, setSelectedAiSuggestionId] = useState("");
  const [aiSelectedReciter, setAiSelectedReciter] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [showSurahName, setShowSurahName] = useState(true);
  const [surahNameColor, setSurahNameColor] = useState("#ffffff");
  const [surahNameSize, setSurahNameSize] = useState("45");
  const [surahNamePosition, setSurahNamePosition] = useState("top");
  const [surahNameX, setSurahNameX] = useState("35");
  const [surahNameY, setSurahNameY] = useState("90");

  const [showReciterName, setShowReciterName] = useState(true);
  const [reciterNameColor, setReciterNameColor] = useState("#34d399");
  const [reciterNameSize, setReciterNameSize] = useState("34");
  const [reciterNamePosition, setReciterNamePosition] = useState("bottom");
  const [reciterNameX, setReciterNameX] = useState("69");
  const [reciterNameY, setReciterNameY] = useState("90");

  const [showBrandName, setShowBrandName] = useState(true);
  const [brandName, setBrandName] = useState("وذكر | wzkerq");
  const [brandNameColor, setBrandNameColor] = useState("#ffffff");
  const [brandNameSize, setBrandNameSize] = useState("35");
  const [brandNamePosition, setBrandNamePosition] = useState("bottom");
  const [brandNameX, setBrandNameX] = useState("50");
  const [brandNameY, setBrandNameY] = useState("15");
  const [brandNameStyle, setBrandNameStyle] = useState("glass");
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showCountdownTimer, setShowCountdownTimer] = useState(true);
  const [progressColor, setProgressColor] = useState("#34d399");
  const [timerColor, setTimerColor] = useState("#ffffff");
  const [progressPosition, setProgressPosition] = useState("bottom");
  const [timerPosition, setTimerPosition] = useState("bottom");
  const [progressHeight, setProgressHeight] = useState("5");
  const [timerSize, setTimerSize] = useState("18");

  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [previewSeekSeconds, setPreviewSeekSeconds] = useState(0);
  const [selectedExportPresetId, setSelectedExportPresetId] =
    useState<ExportPresetId>("reels");
  const [selectedExportQualityId, setSelectedExportQualityId] =
    useState<ExportQualityId>("high");

  const [showHook, setShowHook] = useState(true);
  const [hookText, setHookText] = useState("توقّف لحظة… هذه الآية لك");
  const [hookDuration, setHookDuration] = useState("2.5");
  const [hookStyle, setHookStyle] = useState<HookStyle>("reflection");

  const selectedExportPreset = useMemo(() => {

    return (
      EXPORT_PRESETS.find((preset) => preset.id === selectedExportPresetId) ||
      EXPORT_PRESETS[0]
    );
  }, [selectedExportPresetId]);


  const selectedExportQuality = useMemo(() => {
    return (
      EXPORT_QUALITIES.find(
        (quality) => quality.id === selectedExportQualityId,
      ) || EXPORT_QUALITIES[2]
    );
  }, [selectedExportQualityId]);

  const previewAspectRatio = `${selectedExportPreset.width} / ${selectedExportPreset.height}`;
  const previewIsLandscape =
    selectedExportPreset.width > selectedExportPreset.height;
  const previewIsSquare =
    selectedExportPreset.width === selectedExportPreset.height;
  const previewFrameStyle = useMemo(
    () =>
      previewIsLandscape || isMobile
        ? {
            width: "100%",
            aspectRatio: previewAspectRatio,
            maxHeight: isMobile ? "72vh" : "100%",
          }
        : {
            height: "100%",
            aspectRatio: previewAspectRatio,
            maxWidth: "100%",
          },
    [previewAspectRatio, previewIsLandscape, isMobile],
  );

  const [activeTab, setActiveTab] = useState<
    "quran" | "background" | "design" | "labels" | "timing" | "sync" | "export"
  >("quran");

  const [labelsSection, setLabelsSection] = useState<
    "surah" | "reciter" | "brand"
  >("surah");

  const selectedSurah = useMemo(
    () => surahs.find((surah) => String(surah.number) === chapter),
    [surahs, chapter],
  );
  const selectedReciter = useMemo(
    () => reciters.find((item) => item.identifier === reciter),
    [reciters, reciter],
  );
  const selectedReciterName = useMemo(
    () => selectedReciter?.name || selectedReciter?.englishName || reciter,
    [selectedReciter, reciter],
  );

  const displaySurahName = useMemo(
    () => cleanSurahName(selectedSurah?.name || "الفاتحة"),
    [selectedSurah?.name],
  );
  const previewAyahs = useMemo(
    () => (selectedAyahs.length > 0 ? selectedAyahs : FALLBACK_PREVIEW_AYAHS),
    [selectedAyahs],
  );

  const safeHookDuration = useMemo(() => {
    if (!showHook) return 0;

    return clampNumber(Number(hookDuration || 2.5), 1, 4);
  }, [showHook, hookDuration]);

  const basePreviewDurationSeconds = useMemo(() => {
    return Math.max(
      getDurationSecondsWithBismillahIntroForPreview(previewAyahs),
      5,
    );
  }, [previewAyahs]);

  const totalVideoDuration = useMemo(() => {
    return basePreviewDurationSeconds + safeHookDuration;
  }, [basePreviewDurationSeconds, safeHookDuration]);

  const previewDurationSeconds = totalVideoDuration;


  const currentSyncItem = useMemo(
    () => getCurrentPreviewSyncItem(previewAyahs, previewSeekSeconds),
    [previewAyahs, previewSeekSeconds],
  );
  const currentSyncAyah = currentSyncItem.ayah;
  const currentSyncWords = useMemo(
    () => splitTextWords(currentSyncAyah?.text || ""),
    [currentSyncAyah?.text],
  );
  const currentSyncKey = useMemo(
    () => getAyahSyncKey(currentSyncAyah, currentSyncItem.index),
    [currentSyncAyah, currentSyncItem.index],
  );
  const currentSyncTimings = useMemo(
    () => manualWordTimings[currentSyncKey] || [],
    [manualWordTimings, currentSyncKey],
  );

  useEffect(() => {
    setTapSyncIndex(0);
  }, [currentSyncKey]);

  const previewInputProps = useMemo(
    () => ({
    ayahs: previewAyahs,
    showHook,
    hookText,
    hookDuration: safeHookDuration,
    hookStyle,
    textColor,
    textSize: Number(textSize),
    fontFamily,
    backgroundStyle,
    backgroundVideoUrl,
    backgroundVideoDuration,
    totalVideoDuration,
    backgroundType,
    textPosition,
    animationStyle,
    wordSpeed,
    showWordHighlight,
    showTafsir,
    tafsirText,
    tafsirColor,
    tafsirSize: Number(tafsirSize),
    wordHighlightColor,
    wordHighlightGlowColor,
    wordDimColor,
    wordHighlightStyle,
    wordHighlightTransition,
    wordHighlightSpeed: Number(wordHighlightSpeed),
    wordHighlightOffset: Number(wordHighlightOffset),
    wordHighlightHold: Number(wordHighlightHold),
    wordHighlightMode,
    manualWordTimings,
    showSurahName,
    surahName: displaySurahName,
    surahNameColor,
    surahNameSize: Number(surahNameSize),
    surahNamePosition,
    surahNameX: Number(surahNameX),
    surahNameY: Number(surahNameY),
    showReciterName,
    reciter: selectedReciterName,
    reciterNameColor,
    reciterNameSize: Number(reciterNameSize),
    reciterNamePosition,
    reciterNameX: Number(reciterNameX),
    reciterNameY: Number(reciterNameY),
    showBrandName,
    brandName,
    brandNameColor,
    brandNameSize: Number(brandNameSize),
    brandNamePosition,
    brandNameX: Number(brandNameX),
    brandNameY: Number(brandNameY),
    brandNameStyle,

    showProgressBar,
    showCountdownTimer,
    progressColor,
    timerColor,
    progressPosition,
    timerPosition,
    progressHeight: Number(progressHeight),
    timerSize: Number(timerSize),
    exportPreset: selectedExportPreset.id,
    exportWidth: selectedExportPreset.width,
    exportHeight: selectedExportPreset.height,
    exportQuality: selectedExportQuality.id,
    isRemotionRender: false,
  }),
    [
      previewAyahs,
      showHook,
      hookText,
      safeHookDuration,
      hookStyle,
      textColor,
      textSize,
      fontFamily,
      backgroundStyle,
      backgroundVideoUrl,
      backgroundVideoDuration,
      totalVideoDuration,
      backgroundType,
      textPosition,
      animationStyle,
      wordSpeed,
      showWordHighlight,
      showTafsir,
      tafsirText,
      tafsirColor,
      tafsirSize,
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
      showSurahName,
      displaySurahName,
      surahNameColor,
      surahNameSize,
      surahNamePosition,
      surahNameX,
      surahNameY,
      showReciterName,
      selectedReciterName,
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
      showProgressBar,
      showCountdownTimer,
      progressColor,
      timerColor,
      progressPosition,
      timerPosition,
      progressHeight,
      timerSize,
      selectedExportPreset.id,
      selectedExportPreset.width,
      selectedExportPreset.height,
      selectedExportQuality.id,
    ],
  );
  useEffect(() => {
    setPreviewSeekSeconds(0);
    setPreviewPlaying(true);
  }, [selectedAyahs]);

  useEffect(() => {
    loadRecentExports();
  }, []);



  useEffect(() => {
    return () => {
      exportLogTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      exportLogTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("quran-reels-recent-searches");
      const parsed = stored ? JSON.parse(stored) : [];

      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.filter(Boolean).slice(0, 5));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  async function loadRecentExports() {
    try {
      setLoadingRecentExports(true);

      const response = await fetch(`/api/render?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = await response.json();
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      setRecentExports(jobs.map(normalizeExportJob));
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingRecentExports(false);
    }
  }

  useEffect(() => {
    if (!exporting || !exportStartedAt) return;

    const interval = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - exportStartedAt) / 1000);

      setExportElapsedSeconds((current) =>
        current === elapsedSeconds ? current : elapsedSeconds,
      );
      setExportEstimatedRemainingSeconds((current) => {
        const nextRemaining = Math.max(
          exportEstimatedTotalSeconds - elapsedSeconds,
          0,
        );

        return current === nextRemaining ? current : nextRemaining;
      });

    }, 1500);

    return () => window.clearInterval(interval);
  }, [exporting, exportStartedAt, exportEstimatedTotalSeconds]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setPreviewPlaying(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);


  useEffect(() => {
    async function getReciters() {
      try {
        const response = await fetch(
          "https://api.alquran.cloud/v1/edition?format=audio&language=ar&type=versebyverse",
        );
        const data = await response.json();
        setReciters(data.data || []);
      } catch (error) {
        console.log(error);
      }
    }

    getReciters();
  }, []);

  useEffect(() => {
    async function getSurahs() {
      try {
        const response = await fetch("https://api.alquran.cloud/v1/surah");
        const data = await response.json();
        setSurahs(data.data || []);
      } catch (error) {
        console.log(error);
      }
    }

    getSurahs();
  }, []);

  useEffect(() => {
    async function getAyahsForSelectedSurah() {
      try {
        setLoading(true);

        const loadedAyahs = await loadAyahsDirect(chapter, reciter);

        setAyahs(loadedAyahs);
        setFromAyah("1");
        setToAyah(String(loadedAyahs.length || 1));
        setSelectedAyahs([]);
        setDownloadUrl("");
      } catch (error) {
        console.log(error);
        alert("حدث خطأ أثناء تحميل الآيات");
      } finally {
        setLoading(false);
      }
    }

    getAyahsForSelectedSurah();
  }, [chapter, reciter]);

  async function loadAyahsDirect(nextChapter: string, nextReciter: string) {
    const response = await fetch(
      `https://api.alquran.cloud/v1/surah/${nextChapter}/${nextReciter}`,
      { cache: "no-store" },
    );

    const data = await response.json();

    if (!response.ok || !Array.isArray(data.data?.ayahs)) {
      throw new Error(data.message || "فشل تحميل آيات السورة");
    }

    return data.data.ayahs as Ayah[];
  }

  function setManualWordTiming(wordIndex: number) {
    const localSeconds = Number(currentSyncItem.localSeconds.toFixed(2));

    setManualWordTimings((current) => {
      const nextTimings = [...(current[currentSyncKey] || [])];

      nextTimings[wordIndex] = localSeconds;

      return {
        ...current,
        [currentSyncKey]: nextTimings,
      };
    });
  }

  function nudgeManualWordTiming(wordIndex: number, delta: number) {
    setManualWordTimings((current) => {
      const nextTimings = [...(current[currentSyncKey] || [])];
      const currentValue =
        typeof nextTimings[wordIndex] === "number"
          ? Number(nextTimings[wordIndex])
          : currentSyncItem.localSeconds;

      nextTimings[wordIndex] = Math.max(
        Number((currentValue + delta).toFixed(2)),
        0,
      );

      return {
        ...current,
        [currentSyncKey]: nextTimings,
      };
    });
  }

  function clearManualWordTiming(wordIndex: number) {
    setManualWordTimings((current) => {
      const nextTimings = [...(current[currentSyncKey] || [])];

      nextTimings[wordIndex] = null;

      return {
        ...current,
        [currentSyncKey]: nextTimings,
      };
    });
  }

  function clearCurrentManualWordTimings() {
    setManualWordTimings((current) => {
      const next = { ...current };

      delete next[currentSyncKey];

      return next;
    });
    setTapSyncIndex(0);
  }

  function applySyncPreset(
    preset: "fast" | "medium" | "slow" | "tarteel" | "tajweed",
  ) {
    if (preset === "fast") {
      setWordHighlightSpeed("1.25");
      setWordHighlightHold("0.06");
      setWordHighlightOffset("-0.05");
      setWordHighlightMode("smart");
      return;
    }

    if (preset === "slow") {
      setWordHighlightSpeed("0.82");
      setWordHighlightHold("0.2");
      setWordHighlightOffset("0.08");
      setWordHighlightMode("smart");
      return;
    }

    if (preset === "tarteel") {
      setWordHighlightSpeed("0.92");
      setWordHighlightHold("0.16");
      setWordHighlightOffset("0.02");
      setWordHighlightMode("smart");
      return;
    }

    if (preset === "tajweed") {
      setWordHighlightSpeed("0.72");
      setWordHighlightHold("0.28");
      setWordHighlightOffset("0.12");
      setWordHighlightMode("smart");
      return;
    }

    setWordHighlightSpeed("1");
    setWordHighlightHold("0.12");
    setWordHighlightOffset("0");
    setWordHighlightMode("smart");
  }

  function autoCalibrateCurrentAyah() {
    if (!currentSyncWords.length || !currentSyncAyah) return;

    const duration = Math.max(currentSyncAyah.duration || 5, 0.5);
    const timings = buildSmartManualTimings(currentSyncWords, duration);

    setManualWordTimings((current) => ({
      ...current,
      [currentSyncKey]: timings,
    }));

    setTapSyncIndex(0);
  }

  function tapSyncNextWord() {
    if (!currentSyncWords.length) return;

    const nextIndex = clampNumber(tapSyncIndex, 0, currentSyncWords.length - 1);
    const localSeconds = Number(currentSyncItem.localSeconds.toFixed(2));

    setManualWordTimings((current) => {
      const nextTimings = [...(current[currentSyncKey] || [])];

      nextTimings[nextIndex] = localSeconds;

      return {
        ...current,
        [currentSyncKey]: nextTimings,
      };
    });

    setTapSyncIndex((current) =>
      clampNumber(current + 1, 0, Math.max(currentSyncWords.length - 1, 0)),
    );
  }

  function undoTapSync() {
    setTapSyncIndex((current) => {
      const previousIndex = clampNumber(
        current - 1,
        0,
        Math.max(currentSyncWords.length - 1, 0),
      );

      clearManualWordTiming(previousIndex);

      return previousIndex;
    });
  }

  function distributeBetweenManualPoints() {
    if (!currentSyncWords.length || !currentSyncAyah) return;

    const duration = Math.max(currentSyncAyah.duration || 5, 0.5);
    const existing = currentSyncTimings;
    const nextTimings = fillManualTimingGaps(
      currentSyncWords,
      existing,
      duration,
    );

    setManualWordTimings((current) => ({
      ...current,
      [currentSyncKey]: nextTimings,
    }));
  }

  function makeLineAnchors() {
    if (!currentSyncWords.length || !currentSyncAyah) return;

    const duration = Math.max(currentSyncAyah.duration || 5, 0.5);
    const groupSize =
      currentSyncWords.length > 24 ? 5 : currentSyncWords.length > 14 ? 4 : 3;
    const timings = buildSmartManualTimings(currentSyncWords, duration).map(
      () => null as number | null,
    );

    for (let index = 0; index < currentSyncWords.length; index += groupSize) {
      timings[index] = Number(
        ((index / currentSyncWords.length) * duration).toFixed(2),
      );
    }

    timings[0] = 0;
    timings[currentSyncWords.length - 1] = Math.max(duration - 0.25, 0);

    setManualWordTimings((current) => ({
      ...current,
      [currentSyncKey]: fillManualTimingGaps(
        currentSyncWords,
        timings,
        duration,
      ),
    }));
    setTapSyncIndex(0);
  }

  function setCurrentWordAndAdvance() {
    const activeIndex = getNearestManualWordIndex(
      currentSyncWords.length,
      currentSyncTimings,
      currentSyncItem.localSeconds,
    );

    setManualWordTiming(activeIndex);
    setTapSyncIndex(
      clampNumber(activeIndex + 1, 0, Math.max(currentSyncWords.length - 1, 0)),
    );
  }

  function shiftPreviewAndCurrentWord(delta: number) {
    seekPreviewBySeconds(delta);
    const activeIndex = getNearestManualWordIndex(
      currentSyncWords.length,
      currentSyncTimings,
      currentSyncItem.localSeconds,
    );
    nudgeManualWordTiming(activeIndex, delta);
  }

  function shiftCurrentManualTimings(delta: number) {
    setManualWordTimings((current) => {
      const source = current[currentSyncKey] || [];
      const duration = Math.max(currentSyncAyah?.duration || 5, 0.5);
      const nextTimings = source.map((time) =>
        typeof time === "number"
          ? clampNumber(Number((time + delta).toFixed(2)), 0, duration)
          : time,
      );

      return {
        ...current,
        [currentSyncKey]: nextTimings,
      };
    });
  }

  function stretchCurrentManualTimings(factor: number) {
    setManualWordTimings((current) => {
      const source = current[currentSyncKey] || [];
      const duration = Math.max(currentSyncAyah?.duration || 5, 0.5);
      const nextTimings = source.map((time) =>
        typeof time === "number"
          ? clampNumber(Number((time * factor).toFixed(2)), 0, duration)
          : time,
      );

      return {
        ...current,
        [currentSyncKey]: nextTimings,
      };
    });
  }

  async function fetchBackgroundVideo(style: string) {
    try {
      setLoadingBackground(true);

      const response = await fetch(
        `/api/backgrounds?style=${style}&t=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        alert("لم يتم العثور على خلفية فيديو");
        return "";
      }

      const data = await response.json();

      if (!data.url) {
        alert("لم يتم العثور على خلفية فيديو");
        return "";
      }

      setBackgroundVideoUrl(data.url);
      setBackgroundType("video");
      setCustomBackgroundName("");
      setCustomBackgroundSize(null);
      setCustomBackgroundMimeType("");
      setPreviewSeekSeconds(0);
      setPreviewPlaying(true);
      return data.url;
    } catch (error) {
      console.log(error);
      alert("حدث خطأ أثناء جلب الخلفية");
      return "";
    } finally {
      setLoadingBackground(false);
    }
  }

  useEffect(() => {
    if (!backgroundVideoUrl) {
      setBackgroundVideoDuration(0);
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = backgroundVideoUrl;
    video.muted = true;

    const handleLoadedMetadata = () => {
      const duration = Number(video.duration || 0);
      setBackgroundVideoDuration(Number.isFinite(duration) ? duration : 0);
    };

    const handleError = () => {
      console.log("BACKGROUND_DURATION_MEASURE_ERROR");
      setBackgroundVideoDuration(0);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      video.removeAttribute("src");
      video.load();
    };
  }, [backgroundVideoUrl]);

  async function loadTafsirDirect(chapterNumber: string | number, ayahNumber: string | number) {
    try {
      const response = await fetch(
        `/api/tafsir?chapter=${encodeURIComponent(String(chapterNumber))}&ayah=${encodeURIComponent(String(ayahNumber))}&source=${encodeURIComponent(tafsirSource)}`,
        { cache: "no-store" },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.tafsir) {
        return "";
      }

      return String(data.tafsir || "").trim();
    } catch (error) {
      console.log("TAFSIR_LOAD_ERROR:", error);
      return "";
    }
  }

  async function uploadCustomBackground(file: File) {
    try {
      setUploadingBackground(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-background", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        alert(data.message || "فشل رفع الخلفية");
        return;
      }

      setBackgroundVideoUrl(data.url);
      setCustomBackgroundName(data.name || file.name);
      setCustomBackgroundSize(data.size || file.size);
      setCustomBackgroundMimeType(data.mimeType || file.type);
      setPreviewSeekSeconds(0);
      setPreviewPlaying(true);

      if (file.type.startsWith("image/")) {
        setBackgroundType("image");
      } else {
        setBackgroundType("video");
      }
    } catch (error) {
      console.log(error);
      alert("حدث خطأ أثناء رفع الخلفية");
    } finally {
      setUploadingBackground(false);
    }
  }

  function saveRecentSearchTerm(term: string) {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) return;

    setRecentSearches((current) => {
      const next = [
        normalizedTerm,
        ...current.filter((item) => item !== normalizedTerm),
      ].slice(0, 5);

      try {
        window.localStorage.setItem(
          "quran-reels-recent-searches",
          JSON.stringify(next),
        );
      } catch {
        // ignore storage errors
      }

      return next;
    });
  }

  const usePromptSuggestion = useCallback((prompt: string) => {
    setAiPrompt(prompt);
  }, []);

  const seekPreviewBySeconds = useCallback((delta: number) => {
    setPreviewSeekSeconds((current) =>
      clampNumber(current + delta, 0, previewDurationSeconds),
    );
    setPreviewPlaying(false);
  }, [previewDurationSeconds]);

  async function generateAiReel() {
    try {
      const prompt = aiPrompt.trim();

      if (!prompt) {
        alert("اكتب كلمة للبحث، مثال: الصيام");
        return;
      }

      saveRecentSearchTerm(prompt);

      const detectedReciter = detectReciterFromPrompt(prompt, reciters);
      const reciterToUse = detectedReciter || reciter;

      if (detectedReciter) {
        setReciter(detectedReciter);
      }
      setAiSelectedReciter(reciterToUse);

      setGeneratingAiReel(true);
      setDownloadUrl("");
      setSelectedAyahs([]);
      setAiSuggestions([]);
      setAiSearchWords([]);
      setAiSearchMessage("");
      setSelectedAiSuggestionId("");
      setAiSuggestionTitle("");
      setAiSuggestionReason("");

      const response = await fetch("/api/quran-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: prompt, limit: 10 }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAiSearchMessage(data.message || "لم يتم العثور على نتائج");
        alert(data.message || "فشل البحث");
        return;
      }

      const results = Array.isArray(data.results) ? data.results : [];

      setAiSuggestions(results);
      setAiSearchWords(Array.isArray(data.searchWords) ? data.searchWords : []);
      setAiSearchMessage(
        detectedReciter
          ? `${data.message || `تم العثور على ${results.length} نتيجة`} — تم اختيار القارئ تلقائيًا`
          : data.message || `تم العثور على ${results.length} نتيجة`,
      );
      setAiSuggestionTitle("اختر آية من النتائج");
      setAiSuggestionReason("النتائج مبنية على بحث مباشر في نص القرآن.");
      setActiveTab("quran");
    } catch (error) {
      console.log(error);
      alert("حدث خطأ أثناء البحث");
    } finally {
      setGeneratingAiReel(false);
    }
  }

  async function applyAiSuggestion(suggestion: AiSuggestion | any) {
    try {
      setPreparingPreview(true);
      setDownloadUrl("");
      setSelectedAyahs([]);
      setSelectedAiSuggestionId(
        suggestion.id ||
          `${suggestion.chapter}-${suggestion.numberInSurah || suggestion.fromAyah}`,
      );

      const nextChapter = String(suggestion.chapter || "1");

      const autoBackground = pickBackgroundFromTopics(
        suggestion.detectedTopics || [],
      );

      const nextBackgroundStyle =
        suggestion.backgroundStyle ||
        autoBackground ||
        backgroundStyle ||
        "mosque";

      const loadedAyahs = await loadAyahsDirect(
        nextChapter,
        aiSelectedReciter || reciter,
      );

      const maxAyah = loadedAyahs.length || 1;

      const ayahNumber = Number(suggestion.numberInSurah);
      const fromNumber = Number(suggestion.fromAyah);
      const toNumber = Number(suggestion.toAyah);

      let nextFromAyahNumber = ayahNumber || fromNumber || 1;

      // Auto Verse Grouping
      let nextToAyahNumber =
        toNumber && toNumber > nextFromAyahNumber
          ? toNumber
          : nextFromAyahNumber;

      nextFromAyahNumber = clampNumber(nextFromAyahNumber, 1, maxAyah);

      const selectedStartAyah = loadedAyahs[nextFromAyahNumber - 1];
      const selectedTextLength = selectedStartAyah?.text?.length || 0;

      if (Number(nextChapter) === 2 && nextFromAyahNumber === 183) {
        nextToAyahNumber = 185;
      } else if (selectedTextLength > 0 && selectedTextLength < 80) {
        nextToAyahNumber = nextFromAyahNumber + 2;
      } else if (selectedTextLength > 0 && selectedTextLength < 140) {
        nextToAyahNumber = nextFromAyahNumber + 1;
      }

      nextToAyahNumber = clampNumber(
        Math.max(nextToAyahNumber, nextFromAyahNumber),
        nextFromAyahNumber,
        maxAyah,
      );

      const nextFromAyah = String(nextFromAyahNumber);
      const nextToAyah = String(nextToAyahNumber);

      const selected = loadedAyahs.slice(
        nextFromAyahNumber - 1,
        nextToAyahNumber,
      );

      if (!selected.length) {
        alert("الاقتراح لا يحتوي على آيات صحيحة");
        return;
      }

      const generatedHook = buildReelHook(
        suggestion.detectedTopics || [],
        suggestion.text ||
          suggestion.matchedAyahText ||
          selected[0]?.text ||
          "",
      );

      const generatedTitle = buildReelTitle(
        suggestion.detectedTopics || [],
        suggestion.surahName || displaySurahName || nextChapter,
      );

      setAiSuggestionTitle(
        suggestion.shortTitle ||
          suggestion.title ||
          generatedTitle ||
          `سورة ${suggestion.surahName || nextChapter} — آية ${nextFromAyah}`,
      );

      setAiSuggestionReason(
        suggestion.hook ||
          generatedHook ||
          suggestion.reason ||
          "تم اختيار هذا المقطع بناءً على بحثك.",
      );

      setTextColor(suggestion.textColor || "#ffffff");
      setProgressColor(suggestion.progressColor || "#34d399");
      setTextPosition(suggestion.textPosition || "center");
      setAnimationStyle(suggestion.animationStyle || "slide");
      setWordSpeed(suggestion.wordSpeed || "normal");
      setShowSurahName(suggestion.showSurahName ?? true);
      setShowReciterName(suggestion.showReciterName ?? true);
      setShowBrandName(suggestion.showBrandName ?? true);
      setShowProgressBar(suggestion.showProgressBar ?? true);
      setShowCountdownTimer(suggestion.showCountdownTimer ?? true);

      setChapter(nextChapter);
      setAyahs(loadedAyahs);
      setFromAyah(nextFromAyah);
      setToAyah(nextToAyah);
      setBackgroundStyle(nextBackgroundStyle);
      setActiveTab("quran");
      setPreviewSeekSeconds(0);
      setPreviewPlaying(true);

      await fetchBackgroundVideo(nextBackgroundStyle);

      const ayahsWithDurations = await Promise.all(
        selected.map(async (ayah) => {
          const [duration, tafsir] = await Promise.all([
            getAudioDuration(ayah.audio || ""),
            loadTafsirDirect(nextChapter, ayah.numberInSurah),
          ]);

          return {
            text: ayah.text,
            audio: ayah.audio || "",
            duration,
            numberInSurah: ayah.numberInSurah,
            tafsir,
          };
        }),
      );

      setSelectedAyahs(ayahsWithDurations);
      setPreviewSeekSeconds(0);
      setPreviewPlaying(true);
    } catch (error) {
      console.log(error);
      alert("حدث خطأ أثناء تجهيز الاقتراح");
    } finally {
      setPreparingPreview(false);
    }
  }

  async function createPreview(options?: {
    ayahsOverride?: Ayah[];
    fromAyahOverride?: string;
    toAyahOverride?: string;
    backgroundStyleOverride?: string;
  }) {
    try {
      setPreparingPreview(true);
      setDownloadUrl("");

      const sourceAyahs = options?.ayahsOverride || ayahs;
      const nextFromAyah = options?.fromAyahOverride || fromAyah;
      const nextToAyah = options?.toAyahOverride || toAyah;
      const nextBackgroundStyle =
        options?.backgroundStyleOverride || backgroundStyle;

      const selected = sourceAyahs.slice(
        Number(nextFromAyah) - 1,
        Number(nextToAyah),
      );

      if (!selected.length) {
        alert("اختار آيات صحيحة أولًا");
        return;
      }

      if (!backgroundVideoUrl || options?.backgroundStyleOverride) {
        await fetchBackgroundVideo(nextBackgroundStyle);
      }

      const ayahsWithDurations = await Promise.all(
        selected.map(async (ayah) => {
          const [duration, tafsir] = await Promise.all([
            getAudioDuration(ayah.audio || ""),
            loadTafsirDirect(chapter, ayah.numberInSurah),
          ]);

          return {
            text: ayah.text,
            audio: ayah.audio || "",
            duration,
            numberInSurah: ayah.numberInSurah,
            tafsir,
          };
        }),
      );

      setSelectedAyahs(ayahsWithDurations);
      setPreviewSeekSeconds(0);
      setPreviewPlaying(true);
    } catch (error) {
      console.log(error);
      alert("حدث خطأ أثناء تجهيز المعاينة");
    } finally {
      setPreparingPreview(false);
    }
  }

  async function waitForRenderJob({
    jobId,
    startedAt,
    firstSelectedAyah,
    lastSelectedAyah,
  }: {
    jobId: string;
    startedAt: number;
    firstSelectedAyah: number | string;
    lastSelectedAyah: number | string;
  }) {
    let lastLoggedStatus = "";
    let lastLoggedProgress = -1;
    const maxAttempts = 900;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await sleep(attempt === 0 ? 900 : 2000);

      const response = await fetch(
        `/api/render?jobId=${encodeURIComponent(jobId)}&t=${Date.now()}`,
        { cache: "no-store" },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "فشل متابعة حالة التصدير",
        );
      }

      const job = data.job || data;
      const status = String(job.status || "queued");
      const progress = clampNumber(Number(job.progress || 0), 0, 100);
      const message = job.message || getRenderStatusMessage(status);

      setExportStatus(message);
      setRealRenderProgress((current) => Math.max(current, progress));

      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setExportElapsedSeconds(elapsedSeconds);

      if (
        status !== lastLoggedStatus ||
        progress === 100 ||
        Math.abs(progress - lastLoggedProgress) >= 10
      ) {
        setExportLogs((logs) => [
          ...logs,
          `${message}${progress ? ` — ${progress}%` : ""}`,
        ]);
        lastLoggedStatus = status;
        lastLoggedProgress = progress;
      }

      if (status === "completed") {
        if (!job.url) {
          throw new Error("تم التصدير لكن رابط التحميل غير موجود");
        }

        const finalElapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const finalUrl = `${job.url}${job.url.includes("?") ? "&" : "?"}t=${Date.now()}`;

        setDownloadUrl(finalUrl);
        setExportFileName(
          job.fileName ||
            buildDownloadFileName({
              reciter: selectedReciterName,
              surahName: displaySurahName || "surah",
              fromAyah: firstSelectedAyah,
              toAyah: lastSelectedAyah,
            }),
        );
        setExportElapsedSeconds(finalElapsedSeconds);
        setExportEstimatedRemainingSeconds(0);
        setRealRenderProgress(100);
        setExportStatus("تم التصدير بنجاح ✅");
        setExportLogs((logs) => [
          ...logs,
          `تم إنشاء ملف الفيديو بنجاح في ${formatDuration(finalElapsedSeconds)}`,
        ]);

        await loadRecentExports();
        playExportDoneSound();
        return;
      }

      if (status === "failed") {
        throw new Error(job.error || message || "فشل التصدير");
      }
    }

    throw new Error("انتهت مهلة متابعة التصدير. راجع logs السيرفر.");
  }

  async function exportVideo() {
    const startedAt = Date.now();

    try {
      if (selectedAyahs.length === 0) {
        alert("اضغط إنشاء معاينة الأول");
        return;
      }

      if (uploadingBackground || loadingBackground) {
        alert("استنى لحد ما الخلفية تخلص تحميل أو رفع");
        return;
      }

      if (!backgroundVideoUrl) {
        alert("اختار أو حمّل خلفية الأول");
        return;
      }

      const firstSelectedAyah = selectedAyahs[0]?.numberInSurah || fromAyah;
      const lastSelectedAyah =
        selectedAyahs[selectedAyahs.length - 1]?.numberInSurah || toAyah;

      const estimatedSeconds = estimateExportDurationSeconds(
        previewDurationSeconds,
        selectedAyahs.length,
        backgroundType,
      );

      setExporting(true);
      setDownloadUrl("");
      setExportStartedAt(startedAt);
      setExportElapsedSeconds(0);
      setExportEstimatedTotalSeconds(estimatedSeconds);
      setExportEstimatedRemainingSeconds(estimatedSeconds);
      setExportFileName("quran-reel.mp4");
      setExportStatus("جاري إرسال بيانات الفيديو...");
      setRealRenderProgress(0);
      setExportLogs([
        `تم بدء التصدير: سورة ${displaySurahName || chapter} - من آية ${firstSelectedAyah} إلى آية ${lastSelectedAyah}`,
        `القارئ: ${selectedReciterName}`,
        `الإعداد: ${selectedExportPreset.label} - ${selectedExportPreset.width}×${selectedExportPreset.height}`,
        `الجودة: ${selectedExportQuality.label}`,
        `الوقت المتوقع للتصدير: ${formatDuration(estimatedSeconds)}`,
        "جاري إرسال بيانات الفيديو للسيرفر...",
      ]);

      exportLogTimersRef.current.forEach((timer) => window.clearTimeout(timer));

      const logTimers = [
        window.setTimeout(() => {
          setExportStatus("جاري تجهيز ملفات الصوت والخلفية...");
          setExportLogs((logs) => [
            ...logs,
            "جاري تجهيز ملفات الصوت والخلفية...",
          ]);
        }, 900),
        window.setTimeout(() => {
          setExportStatus("جاري بناء مشروع Remotion...");
          setExportLogs((logs) => [...logs, "جاري بناء مشروع Remotion..."]);
        }, 1800),
        window.setTimeout(() => {
          setExportStatus("جاري دمج الصوت مع المشاهد...");
          setExportLogs((logs) => [...logs, "جاري دمج الصوت مع المشاهد..."]);
        }, 2800),
        window.setTimeout(() => {
          setExportStatus("جاري إخراج ملف MP4...");
          setExportLogs((logs) => [...logs, "جاري إخراج ملف MP4..."]);
        }, 3800),
      ];
      exportLogTimersRef.current = logTimers;

      const response = await fetch("/api/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ayahs: selectedAyahs,
          showHook,
          hookText,
          hookDuration: safeHookDuration,
          hookStyle,
          textColor,
          textSize: Number(textSize),
          fontFamily,
          backgroundStyle,
          backgroundVideoUrl,
          backgroundVideoDuration,
          totalVideoDuration,
          backgroundType,
          exportPreset: selectedExportPreset.id,
          exportWidth: selectedExportPreset.width,
          exportHeight: selectedExportPreset.height,
          exportFps: selectedExportPreset.fps,
          exportQuality: selectedExportQuality.id,
          textPosition,
          animationStyle,
          wordSpeed,
          showWordHighlight,
          showTafsir,
          tafsirText,
          tafsirColor,
          tafsirSize: Number(tafsirSize),
          wordHighlightColor,
          wordHighlightGlowColor,
          wordDimColor,
          wordHighlightStyle,
          wordHighlightTransition,
          wordHighlightSpeed: Number(wordHighlightSpeed),
          wordHighlightOffset: Number(wordHighlightOffset),
          wordHighlightHold: Number(wordHighlightHold),
          wordHighlightMode,
          manualWordTimings,
          showSurahName,
          surahName: displaySurahName,
          surahNameColor,
          surahNameSize: Number(surahNameSize),
          surahNamePosition,
          surahNameX: Number(surahNameX),
          surahNameY: Number(surahNameY),
          showReciterName,
          reciter: selectedReciterName,
          reciterNameColor,
          reciterNameSize: Number(reciterNameSize),
          reciterNamePosition,
          reciterNameX: Number(reciterNameX),
          reciterNameY: Number(reciterNameY),
          showBrandName,
          brandName,
          brandNameColor,
          brandNameSize: Number(brandNameSize),
          brandNamePosition,
          brandNameX: Number(brandNameX),
          brandNameY: Number(brandNameY),
          brandNameStyle,

          showProgressBar,
          showCountdownTimer,
          progressColor,
          timerColor,
          progressPosition,
          timerPosition,
          progressHeight: Number(progressHeight),
          timerSize: Number(timerSize),
        }),
      });

      logTimers.forEach((timer) => window.clearTimeout(timer));
      exportLogTimersRef.current = [];

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.jobId) {
        setExportStatus("فشل إرسال مهمة التصدير");
        setExportLogs((logs) => [
          ...logs,
          data.message || data.error || "فشل إرسال مهمة التصدير للسيرفر",
        ]);
        alert(data.message || data.error || "فشل إرسال مهمة التصدير");
        return;
      }

      setExportStatus(data.message || "تمت إضافة الفيديو لقائمة الانتظار");
      setExportLogs((logs) => [
        ...logs,
        `تم إنشاء مهمة التصدير: ${data.jobId}`,
        "جاري متابعة حالة التصدير من السيرفر...",
      ]);

      await waitForRenderJob({
        jobId: data.jobId,
        startedAt,
        firstSelectedAyah,
        lastSelectedAyah,
      });
    } catch (error) {
      console.log(error);
      setExportStatus("حدث خطأ أثناء التصدير");
      setRealRenderProgress(0);
      setExportLogs((logs) => [...logs, "حدث خطأ أثناء التصدير"]);
      alert("حدث خطأ أثناء التصدير");
    } finally {
      exportLogTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      exportLogTimersRef.current = [];
      setExporting(false);
      setExportStartedAt(null);
      setExportEstimatedRemainingSeconds(0);
    }
  }

  const backgroundCards = BACKGROUND_CARDS;

  return (
    <main
      dir="rtl"
      className="text-white"
      style={{
        minHeight: "100dvh",
        height: isMobile ? "auto" : "100vh",
        overflowX: "hidden",
        overflowY: isMobile ? "auto" : "hidden",
        padding: isMobile ? 8 : 12,
        background: "#020617",
      }}
    >
      <div
        className="mx-auto"
        style={{
          minHeight: isMobile ? "100dvh" : "100%",
          height: isMobile ? "auto" : "100%",
          maxWidth: 1920,
          overflow: isMobile ? "visible" : "hidden",
        }}
      >
        <div
          dir="ltr"
          style={{
            minHeight: isMobile ? "100dvh" : "100%",
            height: isMobile ? "auto" : "100%",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 12,
            overflow: isMobile ? "visible" : "hidden",
          }}
        >
          <section
            dir="rtl"
            style={{
              height: isMobile ? "auto" : "100%",
              minHeight: isMobile ? "58vh" : undefined,
              flex: "1 1 auto",
              minWidth: 0,
              overflow: "hidden",
              borderRadius: isMobile ? 22 : 30,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.24)",
              padding: isMobile ? 8 : 12,
              boxShadow: isMobile
                ? "0 16px 38px rgba(0,0,0,0.36)"
                : "0 30px 90px rgba(0,0,0,0.45)",
            }}
          >
            <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
              {!isMobile && (
                <>
                  <div className="absolute h-[520px] w-[520px] rounded-full bg-emerald-400/20 blur-[110px]" />
                  <div className="absolute h-[360px] w-[360px] translate-x-24 translate-y-20 rounded-full bg-cyan-400/10 blur-[110px]" />
                </>
              )}

              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[34px] border border-white/15 bg-black p-2 shadow-[0_18px_48px_rgba(0,0,0,0.55)]">
                <div className="pointer-events-none absolute -inset-1 rounded-[40px] border border-emerald-400/20" />
                <div
                  style={{
                    ...previewFrameStyle,
                    overflow: "hidden",
                    borderRadius: 28,
                  }}
                  className="relative bg-black"
                >
                  <PreviewVideo
                    {...({
                      ...previewInputProps,
                      previewPlaying,
                      previewSeekSeconds,
                    } as any)}
                  />

                  <div className={`pointer-events-none absolute right-4 top-4 z-20 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-[11px] font-black text-white ${isMobile ? "backdrop-blur-sm" : "backdrop-blur-xl"}`}>
                    {selectedExportPreset.label} · {selectedExportPreset.width}×
                    {selectedExportPreset.height} ·{" "}
                    {previewIsLandscape
                      ? "Landscape"
                      : previewIsSquare
                        ? "Square"
                        : "Vertical"}
                  </div>

                  <div className={`pointer-events-auto absolute inset-x-4 bottom-4 z-20 rounded-[26px] border border-white/10 bg-black/55 p-3 ${isMobile ? "shadow-lg backdrop-blur-sm" : "shadow-2xl backdrop-blur-xl"}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewPlaying((value) => !value)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-lg font-black text-black shadow-lg shadow-emerald-400/20"
                      >
                        {previewPlaying ? "⏸" : "▶"}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-neutral-300">
                          <span>{formatTime(previewSeekSeconds)}</span>
                          <span>{formatTime(previewDurationSeconds)}</span>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max={Math.max(previewDurationSeconds, 1)}
                          step="0.05"
                          value={previewSeekSeconds}
                          onChange={(e) => {
                            setPreviewSeekSeconds(Number(e.target.value));
                            setPreviewPlaying(false);
                          }}
                          className="w-full"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab("sync")}
                        className="rounded-2xl border border-cyan-300/30 bg-cyan-400/15 px-3 py-2 text-[11px] font-black text-cyan-100"
                      >
                        Sync
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {PREVIEW_BARS.map(({ index, height }) => {
                        const active =
                          index / 32 <=
                          previewSeekSeconds /
                            Math.max(previewDurationSeconds, 1);

                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setPreviewSeekSeconds(
                                (index / 31) * previewDurationSeconds,
                              );
                              setPreviewPlaying(false);
                            }}
                            className={`flex-1 rounded-full transition ${
                              active ? "bg-emerald-300" : "bg-white/20"
                            }`}
                            style={{ height }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">
                    تحكم دقيق في المعاينة
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    المشغل الأساسي بقى مدمج داخل الفيديو — هنا فقط أدوات دقيقة
                  </p>
                </div>

                <div className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs text-neutral-300">
                  {formatTime(previewSeekSeconds)} /{" "}
                  {formatTime(previewDurationSeconds)}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-4">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 via-transparent to-cyan-400/5" />

                <input
                  type="range"
                  min="0"
                  max={Math.max(previewDurationSeconds, 1)}
                  step="0.1"
                  value={previewSeekSeconds}
                  onChange={(e) => {
                    setPreviewSeekSeconds(Number(e.target.value));
                    setPreviewPlaying(false);
                  }}
                  className="relative z-10 w-full"
                />

                <div className="relative z-10 mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSeekSeconds(
                        Math.max(previewSeekSeconds - 5, 0),
                      );
                      setPreviewPlaying(false);
                    }}
                    className="floating-control rounded-2xl px-5 py-3 text-sm font-bold text-white"
                  >
                    ⏪ 5 ثواني
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewPlaying((value) => !value)}
                    className="floating-control animate-soft-pulse rounded-full px-8 py-5 text-xl font-black text-white"
                  >
                    {previewPlaying ? "⏸" : "▶"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSeekSeconds(
                        Math.min(
                          previewSeekSeconds + 5,
                          previewDurationSeconds,
                        ),
                      );
                      setPreviewPlaying(false);
                    }}
                    className="floating-control rounded-2xl px-5 py-3 text-sm font-bold text-white"
                  >
                    5 ثواني ⏩
                  </button>
                </div>

                <div className="relative z-10 mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSeekSeconds(0);
                      setPreviewPlaying(false);
                    }}
                    className="secondary-button px-4 py-3"
                  >
                    العودة للبداية
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSeekSeconds(0);
                      setPreviewPlaying(true);
                    }}
                    className="primary-button px-4 py-3"
                  >
                    إعادة تشغيل
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside
            dir="rtl"
            className="studio-sidebar-scroll"
            style={{
              height: isMobile ? "auto" : "calc(100vh - 24px)",
              maxHeight: isMobile ? "none" : "calc(100vh - 24px)",
              width: isMobile ? "100%" : 390,
              flex: isMobile ? "0 0 auto" : "0 0 390px",
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflowY: isMobile ? "visible" : "auto",
              overflowX: "hidden",
              overscrollBehavior: isMobile ? "auto" : "contain",
              paddingBottom: 12,
            }}
          >
            <div
              className="glass-card-strong shrink-0 rounded-[28px] p-3"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 50,
                background:
                  "linear-gradient(180deg, rgba(16,24,32,0.98), rgba(8,13,18,0.94))",
                backdropFilter: isMobile ? "blur(12px)" : "blur(28px)",
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">لوحة التحكم</h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    الأدوات يمين، الفيديو شمال، والتاب فقط يعمل بسكرول داخلي.
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <StatCard label="السورة" value={displaySurahName || "-"} />
                    <StatCard
                      label="المدة"
                      value={formatTime(previewDurationSeconds)}
                    />
                    <StatCard
                      label="الآيات"
                      value={`${fromAyah} - ${toAyah}`}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
                  Studio
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <TabButton
                  active={activeTab === "quran"}
                  onClick={() => setActiveTab("quran")}
                  label="القرآن"
                  icon="📖"
                />
                <TabButton
                  active={activeTab === "background"}
                  onClick={() => setActiveTab("background")}
                  label="الخلفية"
                  icon="🎞️"
                />
                <TabButton
                  active={activeTab === "design"}
                  onClick={() => setActiveTab("design")}
                  label="التصميم"
                  icon="🎨"
                />
                <TabButton
                  active={activeTab === "labels"}
                  onClick={() => setActiveTab("labels")}
                  label="العناوين"
                  icon="🏷️"
                />
                <TabButton
                  active={activeTab === "timing"}
                  onClick={() => setActiveTab("timing")}
                  label="التوقيت"
                  icon="⏱️"
                />
                <TabButton
                  active={activeTab === "sync"}
                  onClick={() => setActiveTab("sync")}
                  label="السينك"
                  icon="🎙️"
                />
                <TabButton
                  active={activeTab === "export"}
                  onClick={() => setActiveTab("export")}
                  label="التصدير"
                  icon="⬇️"
                />
              </div>
            </div>

            <div className="glass-card min-h-0 flex-none overflow-visible rounded-[28px]">
              <div className="p-3">
                {activeTab === "quran" && (
                  <Panel
                    title="اختيار الآيات والقارئ"
                    description="ابدأ باختيار السورة، الآيات، والقارئ."
                  >
                    <div className="rounded-[26px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">AI Auto Reel</p>
                          <p className="mt-1 text-xs leading-6 text-neutral-300">
                            اكتب كلمة أو موضوع، وسأبحث لك في نص القرآن وأعرض
                            أفضل الآيات.
                          </p>
                        </div>

                        <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-black text-emerald-300">
                          Search
                        </span>
                      </div>

                      <textarea
                        value={aiPrompt || ""}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="مثال: الصيام، الرزق، الدعاء، الصبر"
                        className="modern-input min-h-[82px] resize-none leading-7 lg:min-h-[96px]"
                      />

                      <PromptChips
                        title="جرّب بسرعة"
                        prompts={SUGGESTED_PROMPTS}
                        onSelect={usePromptSuggestion}
                      />

                      {recentSearches.length > 0 && (
                        <PromptChips
                          title="آخر عمليات البحث"
                          prompts={recentSearches}
                          onSelect={usePromptSuggestion}
                          compact
                        />
                      )}

                      <PromptChips
                        title="الأكثر استخدامًا"
                        prompts={TRENDING_PROMPTS}
                        onSelect={usePromptSuggestion}
                        compact
                      />

                      <button
                        type="button"
                        onClick={generateAiReel}
                        disabled={generatingAiReel || preparingPreview}
                        className="primary-button mt-3 w-full px-5 py-4 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingAiReel
                          ? "جاري البحث في الآيات..."
                          : preparingPreview
                            ? "جاري تجهيز المعاينة..."
                            : "بحث واقتراح آيات"}
                      </button>

                      {aiSuggestions.length > 0 && (
                        <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                          <p className="text-sm font-black leading-7 text-emerald-300">
                            ✨{" "}
                            {buildReelHook(
                              aiSuggestions[0]?.detectedTopics || [],
                              aiSuggestions[0]?.matchedAyahText || "",
                            )}
                          </p>
                          <p className="mt-1 text-xs text-neutral-300">
                            {buildReelTitle(
                              aiSuggestions[0]?.detectedTopics || [],
                              aiSuggestions[0]?.surahName,
                            )}
                          </p>
                        </div>
                      )}

                      {aiSearchMessage && (
                        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                          <p className="text-sm font-bold text-emerald-300">
                            {aiSearchMessage}
                          </p>

                          {aiSearchWords.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {aiSearchWords.slice(0, 8).map((word) => (
                                <span
                                  key={word}
                                  className="rounded-full bg-black/30 px-3 py-1 text-xs text-white"
                                >
                                  {word}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {generatingAiReel && aiSuggestions.length === 0 && (
                        <SearchSkeletonCards />
                      )}

                      {!generatingAiReel &&
                        aiSearchMessage &&
                        aiSuggestions.length === 0 && (
                          <EmptySearchState onSelect={usePromptSuggestion} />
                        )}

                      {aiSuggestions.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-white">
                              اختر من النتائج
                            </p>
                            <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-black text-emerald-300">
                              {aiSuggestions.length} نتيجة
                            </span>
                          </div>

                          <div className="space-y-3">
                            {aiSuggestions.map(
                              (suggestion: any, index: number) => {
                                const suggestionId =
                                  suggestion.id ||
                                  `${suggestion.chapter}-${suggestion.numberInSurah || suggestion.fromAyah}`;

                                return (
                                  <AiSuggestionCard
                                    key={`${suggestionId}-${index}`}
                                    suggestion={suggestion}
                                    index={index}
                                    active={
                                      selectedAiSuggestionId === suggestionId
                                    }
                                    disabled={preparingPreview}
                                    onPreview={() =>
                                      applyAiSuggestion(suggestion)
                                    }
                                  />
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}

                      {aiSuggestionTitle && (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-bold text-emerald-300">
                          <p>الاختيار الحالي: {aiSuggestionTitle}</p>

                          {aiSuggestionReason && (
                            <p className="mt-2 leading-6 text-neutral-300">
                              السبب: {aiSuggestionReason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <SelectBox
                      label="السورة"
                      value={chapter}
                      onChange={setChapter}
                    >
                      {surahs.map((surah) => (
                        <option key={surah.number} value={surah.number}>
                          {surah.number} - {surah.name} - {surah.englishName}
                        </option>
                      ))}
                    </SelectBox>

                    <div className="grid grid-cols-2 gap-3">
                      <BasicSelect
                        label="من آية"
                        value={fromAyah}
                        onChange={setFromAyah}
                      >
                        {ayahs.map((ayah) => (
                          <option
                            key={ayah.numberInSurah}
                            value={ayah.numberInSurah}
                          >
                            {ayah.numberInSurah} - {shortText(ayah.text)}
                          </option>
                        ))}
                      </BasicSelect>

                      <BasicSelect
                        label="إلى آية"
                        value={toAyah}
                        onChange={setToAyah}
                      >
                        {ayahs.map((ayah) => (
                          <option
                            key={ayah.numberInSurah}
                            value={ayah.numberInSurah}
                          >
                            {ayah.numberInSurah} - {shortText(ayah.text)}
                          </option>
                        ))}
                      </BasicSelect>
                    </div>

                    <SelectBox
                      label="القارئ"
                      value={reciter}
                      onChange={setReciter}
                    >
                      {reciters.map((item) => (
                        <option key={item.identifier} value={item.identifier}>
                          {item.name || item.englishName}
                        </option>
                      ))}
                    </SelectBox>

                    <button
                      onClick={() => createPreview()}
                      disabled={
                        loading ||
                        ayahs.length === 0 ||
                        preparingPreview ||
                        uploadingBackground ||
                        loadingBackground
                      }
                      className="primary-button mt-2 w-full px-5 py-4 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {preparingPreview
                        ? "جاري تجهيز المعاينة..."
                        : loading
                          ? "جاري تحميل الآيات..."
                          : "إنشاء معاينة"}
                    </button>
                  </Panel>
                )}

                {activeTab === "background" && (
                  <Panel
                    title="معرض الخلفيات"
                    description="اختار نوع الخلفية، أو جرب خلفية عشوائية جديدة."
                  >
                    <div className="grid grid-cols-2 gap-3">
                      {backgroundCards.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={async () => {
                            setBackgroundStyle(item.id);
                            await fetchBackgroundVideo(item.id);
                          }}
                          className={`group relative overflow-hidden rounded-[28px] border text-right transition duration-300 hover:-translate-y-1 ${
                            backgroundStyle === item.id
                              ? "border-emerald-400/70 shadow-[0_0_45px_rgba(52,211,153,0.24)]"
                              : "border-white/10 hover:border-emerald-400/35"
                          }`}
                        >
                          <div className="relative h-40 overflow-hidden bg-black">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                            />

                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                            <div className="absolute inset-0 bg-emerald-400/0 transition group-hover:bg-emerald-400/10" />

                            {backgroundStyle === item.id && (
                              <div className="absolute left-3 top-3 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-black">
                                نشط
                              </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <p className="text-lg font-black text-white">
                                {item.title}
                              </p>

                              <p className="mt-1 text-xs leading-5 text-neutral-300">
                                {item.description}
                              </p>

                              <p className="mt-2 text-[11px] font-bold text-emerald-300 opacity-0 transition group-hover:opacity-100">
                                اضغط لجلب فيديو عشوائي
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchBackgroundVideo(backgroundStyle)}
                      disabled={loadingBackground}
                      className="secondary-button w-full px-5 py-4 disabled:opacity-60"
                    >
                      {loadingBackground
                        ? "جاري جلب خلفية..."
                        : "تغيير الخلفية عشوائيًا"}
                    </button>

                    <div className="rounded-[24px] border border-dashed border-white/15 bg-black/25 p-4">
                      <label className="mb-3 block text-sm font-bold text-neutral-200">
                        رفع خلفية من جهازك صورة أو فيديو
                      </label>

                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await uploadCustomBackground(file);
                        }}
                        className="modern-input"
                      />
                    </div>

                    {uploadingBackground && (
                      <p className="text-sm text-emerald-300">
                        جاري رفع الخلفية...
                      </p>
                    )}

                    {customBackgroundName && !uploadingBackground && (
                      <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-xs text-emerald-300">
                        <p className="font-bold">
                          تم اختيار: {customBackgroundName}
                        </p>

                        {customBackgroundSize && (
                          <p className="mt-2 text-neutral-300">
                            الحجم: {formatFileSize(customBackgroundSize)}
                          </p>
                        )}

                        {customBackgroundMimeType && (
                          <p className="mt-1 text-neutral-300">
                            النوع: {customBackgroundMimeType}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setBackgroundVideoUrl("");
                            setBackgroundType("video");
                            setCustomBackgroundName("");
                            setCustomBackgroundSize(null);
                            setCustomBackgroundMimeType("");
                            setDownloadUrl("");
                            setPreviewSeekSeconds(0);
                            setPreviewPlaying(false);
                          }}
                          className="mt-4 w-full rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-3 font-bold text-red-200 transition hover:bg-red-500/20"
                        >
                          حذف الخلفية المرفوعة
                        </button>
                      </div>
                    )}
                  </Panel>
                )}

                {activeTab === "design" && (
                  <Panel
                    title="تصميم نص الآيات"
                    description="تحكم في الخط، الحجم، اللون، ومكان النص."
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <ColorInput
                        label="لون النص"
                        value={textColor}
                        onChange={setTextColor}
                      />
                      <div>
                        <label className="mb-2 block text-sm text-neutral-300">
                          حجم النص
                        </label>
                        <input
                          type="range"
                          min="36"
                          max="90"
                          value={textSize}
                          onChange={(e) => setTextSize(e.target.value)}
                          className="w-full"
                        />
                        <p className="text-xs text-neutral-400">{textSize}px</p>
                      </div>
                    </div>

                    <SelectBox
                      label="نوع الخط"
                      value={fontFamily}
                      onChange={setFontFamily}
                    >
                      <option value="KFGQPC Uthmanic Script HAFS">
                        KFGQPC Uthmanic Script HAFS
                      </option>
                      <option value="Amiri Quran">Amiri Quran</option>
                      <option value="Amiri">Amiri</option>
                      <option value="Noto Naskh Arabic">
                        Noto Naskh Arabic
                      </option>
                      <option value="Cairo">Cairo</option>
                      <option value="IBM Plex Sans Arabic">
                        IBM Plex Sans Arabic
                      </option>
                    </SelectBox>

                    <SelectBox
                      label="مكان النص"
                      value={textPosition}
                      onChange={setTextPosition}
                    >
                      <option value="start">أعلى الفيديو</option>
                      <option value="center">منتصف الفيديو</option>
                      <option value="end">أسفل الفيديو</option>
                    </SelectBox>

                    <SelectBox
                      label="حركة النص"
                      value={animationStyle}
                      onChange={setAnimationStyle}
                    >
                      <option value="fade">ظهور ناعم</option>
                      <option value="slide">ظهور من أسفل</option>
                      <option value="zoom">تكبير تدريجي</option>
                      <option value="glow">توهج</option>
                    </SelectBox>

                    <SelectBox
                      label="سرعة ظهور الكلمات"
                      value={wordSpeed}
                      onChange={setWordSpeed}
                    >
                      <option value="slow">بطيئة</option>
                      <option value="normal">متوسطة</option>
                      <option value="fast">سريعة</option>
                    </SelectBox>

                    <div className="rounded-[24px] border border-white/10 bg-black/25 p-4">
                      <Toggle
                        label="إظهار التفسير أسفل الآية"
                        checked={showTafsir}
                        onChange={setShowTafsir}
                      />

                      <div className="mt-4">
                        <SelectBox
                          label="مصدر التفسير"
                          value={tafsirSource}
                          onChange={setTafsirSource}
                        >
                          <option value="muyassar">التفسير الميسر</option>
                          <option value="jalalayn">تفسير الجلالين</option>
                          <option value="muyassarCloud">الميسر - مصدر بديل</option>
                        </SelectBox>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm text-neutral-300">
                          نص تفسير احتياطي
                        </label>
                        <textarea
                          value={tafsirText}
                          onChange={(e) => setTafsirText(e.target.value)}
                          className="modern-input min-h-[92px] resize-none leading-7"
                          placeholder="يظهر فقط لو لم يتوفر تفسير تلقائي للآية"
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <ColorInput
                          label="لون التفسير"
                          value={tafsirColor}
                          onChange={setTafsirColor}
                        />
                        <RangeInput
                          label="حجم التفسير"
                          value={tafsirSize}
                          onChange={setTafsirSize}
                          min="14"
                          max="34"
                          step="1"
                          suffix="px"
                        />
                      </div>
                    </div>
                  </Panel>
                )}

                {activeTab === "labels" && (
                  <Panel
                    title="العناوين والعلامة المائية"
                    description="قسّمنا إعدادات العناوين لتبقى أخف وأسهل بدل النزول الطويل."
                  >
                    <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/10 bg-black/25 p-2">
                      <MiniTabButton
                        active={labelsSection === "surah"}
                        onClick={() => setLabelsSection("surah")}
                        label="السورة"
                        icon="📘"
                      />
                      <MiniTabButton
                        active={labelsSection === "reciter"}
                        onClick={() => setLabelsSection("reciter")}
                        label="القارئ"
                        icon="🎙️"
                      />
                      <MiniTabButton
                        active={labelsSection === "brand"}
                        onClick={() => setLabelsSection("brand")}
                        label="العلامة"
                        icon="✨"
                      />
                    </div>

                    {labelsSection === "surah" && (
                      <CompactSection
                        title="اسم السورة"
                        description="تحكم في ظهور اسم السورة ومكانه على الفيديو."
                      >
                        <Toggle
                          label="إظهار اسم السورة"
                          checked={showSurahName}
                          onChange={setShowSurahName}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <ColorInput
                            label="اللون"
                            value={surahNameColor}
                            onChange={setSurahNameColor}
                          />
                          <NumberInput
                            label="الحجم"
                            value={surahNameSize}
                            onChange={setSurahNameSize}
                          />
                        </div>

                        <SelectBox
                          label="المكان السريع"
                          value={surahNamePosition}
                          onChange={setSurahNamePosition}
                        >
                          <option value="top">أعلى</option>
                          <option value="center">منتصف</option>
                          <option value="bottom">أسفل</option>
                        </SelectBox>

                        <div className="grid grid-cols-2 gap-3">
                          <RangeInput
                            label="X أفقي"
                            value={surahNameX}
                            onChange={setSurahNameX}
                            min="0"
                            max="100"
                            step="1"
                            suffix="%"
                          />
                          <RangeInput
                            label="Y رأسي"
                            value={surahNameY}
                            onChange={setSurahNameY}
                            min="0"
                            max="100"
                            step="1"
                            suffix="%"
                          />
                        </div>
                      </CompactSection>
                    )}

                    {labelsSection === "reciter" && (
                      <CompactSection
                        title="اسم القارئ"
                        description="خصص ظهور اسم القارئ داخل التصميم."
                      >
                        <Toggle
                          label="إظهار اسم القارئ"
                          checked={showReciterName}
                          onChange={setShowReciterName}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <ColorInput
                            label="اللون"
                            value={reciterNameColor}
                            onChange={setReciterNameColor}
                          />
                          <NumberInput
                            label="الحجم"
                            value={reciterNameSize}
                            onChange={setReciterNameSize}
                          />
                        </div>

                        <SelectBox
                          label="المكان السريع"
                          value={reciterNamePosition}
                          onChange={setReciterNamePosition}
                        >
                          <option value="top">أعلى</option>
                          <option value="center">منتصف</option>
                          <option value="bottom">أسفل</option>
                        </SelectBox>

                        <div className="grid grid-cols-2 gap-3">
                          <RangeInput
                            label="X أفقي"
                            value={reciterNameX}
                            onChange={setReciterNameX}
                            min="0"
                            max="100"
                            step="1"
                            suffix="%"
                          />
                          <RangeInput
                            label="Y رأسي"
                            value={reciterNameY}
                            onChange={setReciterNameY}
                            min="0"
                            max="100"
                            step="1"
                            suffix="%"
                          />
                        </div>
                      </CompactSection>
                    )}

                    {labelsSection === "brand" && (
                      <CompactSection
                        title="العلامة المائية"
                        description="تحكم في اسم الموقع أو العلامة التجارية."
                      >
                        <Toggle
                          label="إظهار اسم الموقع على الفيديو"
                          checked={showBrandName}
                          onChange={setShowBrandName}
                        />

                        <div>
                          <label className="mb-2 block text-sm text-neutral-300">
                            اسم الموقع
                          </label>
                          <input
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            className="modern-input"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <ColorInput
                            label="اللون"
                            value={brandNameColor}
                            onChange={setBrandNameColor}
                          />
                          <NumberInput
                            label="الحجم"
                            value={brandNameSize}
                            onChange={setBrandNameSize}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <SelectBox
                            label="المكان السريع"
                            value={brandNamePosition}
                            onChange={setBrandNamePosition}
                          >
                            <option value="top">أعلى</option>
                            <option value="center">منتصف</option>
                            <option value="bottom">أسفل</option>
                          </SelectBox>

                          <SelectBox
                            label="الشكل"
                            value={brandNameStyle}
                            onChange={setBrandNameStyle}
                          >
                            <option value="simple">بسيط</option>
                            <option value="glass">زجاجي</option>
                            <option value="glow">مضيء</option>
                          </SelectBox>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <RangeInput
                            label="X أفقي"
                            value={brandNameX}
                            onChange={setBrandNameX}
                            min="0"
                            max="100"
                            step="1"
                            suffix="%"
                          />
                          <RangeInput
                            label="Y رأسي"
                            value={brandNameY}
                            onChange={setBrandNameY}
                            min="0"
                            max="100"
                            step="1"
                            suffix="%"
                          />
                        </div>
                      </CompactSection>
                    )}
                  </Panel>
                )}

                {activeTab === "timing" && (
                  <Panel
                    title="إعدادات التوقيت"
                    description="تحكم في شريط التقدم والعداد العكسي."
                  >
                    <div className="mb-4 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-white">Hook Intro</p>
                          <p className="mt-1 text-xs leading-6 text-neutral-300">
                            جملة قوية تظهر في أول الفيديو قبل البسملة والآيات لزيادة الاحتفاظ بالمشاهدة.
                          </p>
                        </div>
                        <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-black text-emerald-300">
                          TikTok
                        </span>
                      </div>

                      <Toggle
                        label="تفعيل الهوك في بداية الفيديو"
                        checked={showHook}
                        onChange={setShowHook}
                      />

                      <div>
                        <label className="mb-2 block text-sm text-neutral-300">
                          نص الهوك
                        </label>
                        <textarea
                          value={hookText}
                          onChange={(e) => setHookText(e.target.value)}
                          placeholder="توقّف لحظة… هذه الآية لك"
                          className="modern-input min-h-[76px] resize-none leading-7"
                        />
                      </div>

                      <SelectBox
                        label="ستايل الهوك"
                        value={hookStyle}
                        onChange={(value) => setHookStyle(value as HookStyle)}
                      >
                        <option value="reflection">تأملي</option>
                        <option value="question">سؤال</option>
                        <option value="warning">تنبيه</option>
                        <option value="emotional">مؤثر</option>
                      </SelectBox>

                      <div>
                        <label className="mb-2 block text-sm text-neutral-300">
                          مدة الهوك
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="4"
                          step="0.1"
                          value={hookDuration}
                          onChange={(e) => setHookDuration(e.target.value)}
                          className="w-full"
                        />
                        <p className="text-xs text-neutral-400">
                          {safeHookDuration.toFixed(1)} ثانية
                        </p>
                      </div>
                    </div>

                    <Toggle
                      label="إظهار شريط التقدم"
                      checked={showProgressBar}
                      onChange={setShowProgressBar}
                    />
                    <Toggle
                      label="إظهار العداد العكسي لمدة الفيديو"
                      checked={showCountdownTimer}
                      onChange={setShowCountdownTimer}
                    />
                    <ColorInput
                      label="لون شريط التقدم"
                      value={progressColor}
                      onChange={setProgressColor}
                    />
                    <ColorInput
                      label="لون العداد العكسي"
                      value={timerColor}
                      onChange={setTimerColor}
                    />
                    <SelectBox
                      label="مكان شريط التقدم"
                      value={progressPosition}
                      onChange={setProgressPosition}
                    >
                      <option value="top">أعلى</option>
                      <option value="bottom">أسفل</option>
                    </SelectBox>
                    <SelectBox
                      label="مكان العداد العكسي"
                      value={timerPosition}
                      onChange={setTimerPosition}
                    >
                      <option value="top">أعلى</option>
                      <option value="bottom">أسفل</option>
                    </SelectBox>
                    <div>
                      <label className="mb-2 block text-sm text-neutral-300">
                        سمك شريط التقدم
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="14"
                        value={progressHeight}
                        onChange={(e) => setProgressHeight(e.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-neutral-400">
                        {progressHeight}px
                      </p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-neutral-300">
                        حجم العداد العكسي
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="42"
                        value={timerSize}
                        onChange={(e) => setTimerSize(e.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-neutral-400">{timerSize}px</p>
                    </div>
                  </Panel>
                )}

                {activeTab === "sync" && (
                  <Panel
                    title="Sync Studio"
                    description="طريقة أسهل لتظبيط التوقيت: ابدأ تلقائي، ظبط بالسحب/الموجة، أو اضغط مع التلاوة."
                  >
                    <div className="rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-white">
                            3-Step Sync
                          </p>
                          <p className="mt-1 text-xs leading-6 text-neutral-300">
                            أقل مجهود: Auto ثم Line Anchors ثم Fine Tune لو
                            احتجت.
                          </p>
                        </div>
                        <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-black text-emerald-300">
                          Recommended
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={autoCalibrateCurrentAyah}
                          className="primary-button px-2 py-4 text-xs"
                        >
                          1<br />
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={makeLineAnchors}
                          className="secondary-button px-2 py-4 text-xs"
                        >
                          2<br />
                          Line Anchors
                        </button>
                        <button
                          type="button"
                          onClick={distributeBetweenManualPoints}
                          className="secondary-button px-2 py-4 text-xs"
                        >
                          3<br />
                          Smooth Fill
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-5 gap-2">
                        {[
                          ["fast", "سريع"],
                          ["medium", "متوسط"],
                          ["slow", "بطيء"],
                          ["tarteel", "ترتيل"],
                          ["tajweed", "تجويد"],
                        ].map(([preset, label]) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => applySyncPreset(preset as any)}
                            className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-[10px] font-black text-white hover:bg-white/10"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-white">
                            Wave Sync
                          </p>
                          <p className="mt-1 text-xs leading-6 text-neutral-300">
                            اضغط على الموجة للانتقال، ثم ثبت الكلمة الحالية.
                          </p>
                        </div>
                        <div className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-black text-cyan-200">
                          {formatTime(previewSeekSeconds)}
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-white/10 bg-black/30 p-4">
                        <div className="mb-3 flex items-end gap-1">
                          {SYNC_WAVE_BARS.map(({ index, height }) => {
                            const active =
                              index / 48 <=
                              previewSeekSeconds /
                                Math.max(previewDurationSeconds, 1);

                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setPreviewSeekSeconds(
                                    (index / 47) * previewDurationSeconds,
                                  );
                                  setPreviewPlaying(false);
                                }}
                                className={`flex-1 rounded-full transition ${
                                  active ? "bg-cyan-300" : "bg-white/15"
                                }`}
                                style={{ height }}
                              />
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-5 gap-2">
                          <button
                            type="button"
                            onClick={() => seekPreviewBySeconds(-0.25)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            -0.25
                          </button>
                          <button
                            type="button"
                            onClick={() => seekPreviewBySeconds(-0.08)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            -0.08
                          </button>
                          <button
                            type="button"
                            onClick={setCurrentWordAndAdvance}
                            className="primary-button px-2 py-3 text-xs"
                          >
                            ثبت
                          </button>
                          <button
                            type="button"
                            onClick={() => seekPreviewBySeconds(0.08)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            +0.08
                          </button>
                          <button
                            type="button"
                            onClick={() => seekPreviewBySeconds(0.25)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            +0.25
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-white/10 bg-black/25 p-4">
                      <div className="mb-4 text-center">
                        <p className="text-xs text-neutral-400">
                          الكلمة التالية
                        </p>
                        <p className="mt-2 text-4xl font-black leading-[2] text-white">
                          {currentSyncWords[tapSyncIndex] || "—"}
                        </p>
                        <p className="text-xs font-bold text-cyan-200">
                          {currentSyncWords.length
                            ? `كلمة ${tapSyncIndex + 1} من ${currentSyncWords.length}`
                            : "أنشئ معاينة أولًا"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={tapSyncNextWord}
                        disabled={!currentSyncWords.length}
                        className="primary-button w-full px-5 py-5 text-lg disabled:opacity-50"
                      >
                        🎙️ Tap مع التلاوة
                      </button>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={undoTapSync}
                          className="secondary-button px-3 py-3 text-xs"
                        >
                          رجوع
                        </button>
                        <button
                          type="button"
                          onClick={() => setTapSyncIndex(0)}
                          className="secondary-button px-3 py-3 text-xs"
                        >
                          من الأول
                        </button>
                        <button
                          type="button"
                          onClick={clearCurrentManualWordTimings}
                          className="rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-xs font-bold text-red-200"
                        >
                          تصفير
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-white/10 bg-black/25 p-4">
                      <div className="mb-4">
                        <p className="text-lg font-black text-white">
                          Fine Tune
                        </p>
                        <p className="mt-1 text-xs leading-6 text-neutral-400">
                          التحكمات دي للتعديل الأخير بس.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <Toggle
                          label="تفعيل تمييز الكلمات"
                          checked={showWordHighlight}
                          onChange={setShowWordHighlight}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <SelectBox
                            label="شكل الهايلايت"
                            value={wordHighlightStyle}
                            onChange={setWordHighlightStyle}
                          >
                            <option value="glow">Glow</option>
                            <option value="pill">Pill</option>
                            <option value="underline">Underline</option>
                            <option value="gold">Gold</option>
                          </SelectBox>

                          <SelectBox
                            label="الانتقال"
                            value={wordHighlightTransition}
                            onChange={setWordHighlightTransition}
                          >
                            <option value="scale">Scale</option>
                            <option value="fade">Fade</option>
                            <option value="slide">Slide</option>
                            <option value="pulse">Pulse</option>
                          </SelectBox>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <ColorInput
                            label="لون الكلمة"
                            value={wordHighlightColor}
                            onChange={setWordHighlightColor}
                          />
                          <ColorInput
                            label="لون التوهج"
                            value={wordHighlightGlowColor}
                            onChange={setWordHighlightGlowColor}
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => shiftCurrentManualTimings(-0.08)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            كلهم -0.08
                          </button>
                          <button
                            type="button"
                            onClick={() => shiftCurrentManualTimings(0.08)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            كلهم +0.08
                          </button>
                          <button
                            type="button"
                            onClick={() => stretchCurrentManualTimings(0.96)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            ضغط
                          </button>
                          <button
                            type="button"
                            onClick={() => stretchCurrentManualTimings(1.04)}
                            className="secondary-button px-2 py-3 text-xs"
                          >
                            تمديد
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[32px] border border-white/10 bg-black/25 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-lg font-black text-white">
                          Word Timeline
                        </p>
                        <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-black text-cyan-200">
                          {currentSyncItem.localSeconds.toFixed(1)}ث
                        </span>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                        <div className="flex flex-wrap gap-2">
                          {currentSyncWords.map((word, index) => {
                            const timing = currentSyncTimings[index];
                            const hasManualTiming = typeof timing === "number";

                            return (
                              <button
                                key={`${word}-${index}`}
                                type="button"
                                onClick={() => setManualWordTiming(index)}
                                className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                                  hasManualTiming
                                    ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                                    : "border-white/10 bg-white/5 text-neutral-200"
                                }`}
                              >
                                {word}
                                {hasManualTiming && (
                                  <span className="mr-1 text-[10px] text-cyan-200">
                                    {Number(timing).toFixed(1)}ث
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Panel>
                )}

                {activeTab === "export" && (
                  <Panel
                    title="التصدير"
                    description="راجع معلومات الفيديو وابدأ التصدير بصيغة MP4."
                  >
                    <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">مقاس التصدير</p>
                          <p className="mt-1 text-xs leading-6 text-neutral-300">
                            اختار المنصة، والتصدير يستخدم المقاس المناسب لها.
                          </p>
                        </div>
                        <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-black text-emerald-300">
                          {selectedExportPreset.width}×
                          {selectedExportPreset.height}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {EXPORT_PRESETS.map((preset) => {
                          const active = selectedExportPresetId === preset.id;

                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                setSelectedExportPresetId(preset.id)
                              }
                              className={`rounded-2xl border p-3 text-right transition ${
                                active
                                  ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-400/20"
                                  : "border-white/10 bg-black/25 text-white hover:border-emerald-400/40 hover:bg-white/10"
                              }`}
                            >
                              <p className="text-xs font-black">
                                {preset.label}
                              </p>
                              <p
                                className={`mt-1 text-[10px] leading-5 ${
                                  active ? "text-black/70" : "text-neutral-400"
                                }`}
                              >
                                {preset.width}×{preset.height} •{" "}
                                {preset.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">جودة التصدير</p>
                          <p className="mt-1 text-xs leading-6 text-neutral-300">
                            اختار جودة الإخراج حسب السرعة وحجم الملف.
                          </p>
                        </div>
                        <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-black text-cyan-200">
                          {selectedExportQuality.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {EXPORT_QUALITIES.map((quality) => {
                          const active = selectedExportQualityId === quality.id;

                          return (
                            <button
                              key={quality.id}
                              type="button"
                              onClick={() =>
                                setSelectedExportQualityId(quality.id)
                              }
                              className={`rounded-2xl border p-3 text-right transition ${
                                active
                                  ? "border-cyan-300 bg-cyan-300 text-black shadow-lg shadow-cyan-300/20"
                                  : "border-white/10 bg-black/25 text-white hover:border-cyan-300/40 hover:bg-white/10"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-black">
                                  {quality.label}
                                </p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                                    active
                                      ? "bg-black/10 text-black/70"
                                      : "bg-white/10 text-cyan-100"
                                  }`}
                                >
                                  {quality.badge}
                                </span>
                              </div>
                              <p
                                className={`mt-1 text-[10px] leading-5 ${
                                  active ? "text-black/70" : "text-neutral-400"
                                }`}
                              >
                                {quality.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoPill
                        label="السورة"
                        value={displaySurahName || "-"}
                      />
                      <InfoPill label="القارئ" value={selectedReciterName} />
                      <InfoPill
                        label="الآيات"
                        value={`${fromAyah} - ${toAyah}`}
                      />
                      <InfoPill
                        label="المدة"
                        value={formatTime(previewDurationSeconds)}
                      />
                      <InfoPill
                        label="Preset"
                        value={`${selectedExportPreset.label} - ${selectedExportPreset.width}×${selectedExportPreset.height}`}
                      />
                      <InfoPill
                        label="الجودة"
                        value={selectedExportQuality.label}
                      />
                    </div>

                    <button
                      onClick={exportVideo}
                      disabled={
                        selectedAyahs.length === 0 ||
                        exporting ||
                        uploadingBackground ||
                        loadingBackground
                      }
                      className="primary-button w-full px-5 py-5 text-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exporting
                        ? "جاري التصدير..."
                        : `تصدير MP4 - ${selectedExportPreset.label}`}
                    </button>

                    {exporting && (
                      <div className="rounded-[26px] border border-emerald-400/30 bg-emerald-400/10 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold text-emerald-300">
                            {exportStatus}
                          </span>
                          <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-neutral-200">
                            متبقي تقريبًا:{" "}
                            {formatDuration(exportEstimatedRemainingSeconds)}
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                            style={{
                              width: `${Math.max(realRenderProgress, 8)}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-center text-sm font-bold text-emerald-300">
                          {realRenderProgress}% مكتمل
                        </p>
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-neutral-200">
                          <p className="mb-2 font-bold text-emerald-300">
                            سجل التصدير
                          </p>
                          <div className="space-y-1">
                            {exportLogs.map((log, index) => (
                              <p key={`${log}-${index}`} className="leading-6">
                                <span className="text-emerald-300">•</span>{" "}
                                {log}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3 space-y-1 text-center text-xs text-neutral-400">
                          <p>من فضلك لا تغلق الصفحة أثناء التصدير</p>
                          <p className="text-emerald-300">
                            الوقت المتوقع الكلي:{" "}
                            {formatDuration(exportEstimatedTotalSeconds)}
                          </p>
                          <p>
                            مرّ حتى الآن: {formatDuration(exportElapsedSeconds)}
                          </p>
                        </div>
                      </div>
                    )}

                    {downloadUrl && !exporting && (
                      <div className="rounded-[26px] border border-emerald-400/30 bg-emerald-400/10 p-4 text-center">
                        <p className="mb-2 font-semibold text-emerald-300">
                          تم التصدير بنجاح ✅
                        </p>
                        <p className="mb-1 text-xs text-neutral-300">
                          اسم الملف: {exportFileName}
                        </p>
                        <p className="mb-4 text-xs text-neutral-300">
                          الوقت المستغرق: {formatDuration(exportElapsedSeconds)}
                        </p>
                        <a
                          href={downloadUrl}
                          download={exportFileName}
                          className="primary-button block w-full px-5 py-4"
                        >
                          تحميل الفيديو
                        </a>
                      </div>
                    )}

                    <div className="rounded-[26px] border border-white/10 bg-black/25 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-white">آخر التصديرات</p>
                          <p className="mt-1 text-xs text-neutral-400">
                            محفوظة مؤقتًا من السيرفر الحالي
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={loadRecentExports}
                          disabled={loadingRecentExports}
                          className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                        >
                          {loadingRecentExports ? "تحديث..." : "تحديث"}
                        </button>
                      </div>

                      {recentExports.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-xs text-neutral-400">
                          لا توجد تصديرات محفوظة حتى الآن
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {recentExports.slice(0, 5).map((job, index) => {
                            const key =
                              job.jobId ||
                              job.id ||
                              `${job.fileName || "export"}-${index}`;

                            return <ExportJobCard key={key} job={job} />;
                          })}
                        </div>
                      )}
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function AiSuggestionCard({
  suggestion,
  index,
  active,
  disabled,
  onPreview,
}: {
  suggestion: AiSuggestion | any;
  index: number;
  active: boolean;
  disabled: boolean;
  onPreview: () => void;
}) {
  const topics: string[] = suggestion.detectedTopics || [];
  const suggestionText = suggestion.text || suggestion.matchedAyahText || "";
  const ayahNumber = suggestion.numberInSurah || suggestion.matchedAyahNumber;
  const moodEmoji = getMoodEmoji(topics);
  const viralScore = getViralScore(
    suggestion.score || 0,
    topics,
    suggestionText,
  );
  const aiMatch = Math.min(
    99,
    Math.max(82, Math.round((suggestion.score || 0) * 7.5)),
  );
  const predictedDuration = predictReelDurationSeconds(suggestionText, topics);
  const previewBackgroundClass = getTopicBackgroundClass(topics);
  const reelHook = suggestion.hook || buildReelHook(topics, suggestionText);
  const reelTitle =
    suggestion.shortTitle || buildReelTitle(topics, suggestion.surahName || "");
  const reelCaption =
    suggestion.caption || buildReelCaption(topics, suggestion.surahName || "");
  const mainTopic = topics[0] || "راحة نفسية";
  const secondTopic = topics[1] || suggestion.matchedWords?.[0] || "طمأنينة";
  const moodLabel = getMoodLabel(topics);

  return (
    <article
      className={`relative overflow-hidden rounded-[34px] border p-3 transition duration-300 ${
        active
          ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_55px_rgba(52,211,153,0.24)]"
          : "border-white/10 bg-[#061312] hover:border-emerald-400/40"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.10),transparent_30%)]" />

      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/25">
        <div className="relative min-h-[260px] overflow-hidden p-4">
          <div className={`absolute inset-0 ${previewBackgroundClass}`} />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-black/80 via-black/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 to-transparent" />

          <div className="relative z-10">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-xl backdrop-blur">
                🎬
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full border border-orange-300/40 bg-black/35 px-3 py-1.5 text-[11px] font-black text-orange-200 backdrop-blur">
                  🔥 Viral {viralScore}%
                </span>
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1.5 text-[11px] font-black text-emerald-200 backdrop-blur">
                  ✨ AI Match {aiMatch}%
                </span>
              </div>
            </div>

            <div className="mb-6 text-right">
              <p className="mb-2 text-xs font-black text-emerald-300">
                📖 سورة {suggestion.surahName || suggestion.chapter} — آية{" "}
                {ayahNumber || suggestion.fromAyah || "-"}
              </p>

              <h4 className="text-2xl font-black leading-10 text-white">
                {reelTitle}
              </h4>

              <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-neutral-300">
                {reelHook}
              </p>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {[mainTopic, secondTopic, "تدبر"]
                .filter(Boolean)
                .slice(0, 3)
                .map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-neutral-100 backdrop-blur"
                  >
                    #{item}
                  </span>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PremiumMetricCard label="الموضوع" value={mainTopic} icon="💚" />
              <PremiumMetricCard label="المعنى" value={secondTopic} icon="🧠" />
              <PremiumMetricCard
                label="المزاج"
                value={moodLabel}
                icon={moodEmoji}
              />
              <PremiumMetricCard
                label="المدة"
                value={`${Math.max(predictedDuration - 2, 5)} - ${predictedDuration}ث`}
                icon="⏱️"
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4 border-t border-white/10 bg-black/25 p-4">
          <div className="rounded-[26px] border border-white/10 bg-black/30 p-4 text-center">
            <p className="mb-3 text-right text-xs font-black text-emerald-300">
              📖 الآية المختارة
            </p>

            <p
              className="text-2xl font-black leading-[2.2] text-white"
              dangerouslySetInnerHTML={{
                __html: highlightMatchedWords(
                  suggestionText,
                  suggestion.matchedWords || [],
                ),
              }}
            />

            <p className="mt-2 text-xs text-neutral-400">
              سورة {suggestion.surahName || suggestion.chapter} — آية{" "}
              {ayahNumber || suggestion.fromAyah || "-"}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
              <div className="text-right">
                <p className="text-neutral-400">السبب</p>
                <p className="mt-1 line-clamp-2 font-bold leading-6 text-white">
                  {reelCaption}
                </p>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div className="text-center">
                <p className="text-neutral-400">النمط</p>
                <p className="mt-1 font-black text-white">{moodLabel}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[72px_72px_1fr] gap-2">
            <button
              type="button"
              onClick={onPreview}
              disabled={disabled}
              className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              👁️
              <span className="mt-1 block">معاينة</span>
            </button>

            <button
              type="button"
              onClick={onPreview}
              disabled={disabled}
              className="rounded-2xl border border-white/10 bg-white/5 px-2 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              ↻<span className="mt-1 block">تجديد</span>
            </button>

            <button
              type="button"
              onClick={onPreview}
              disabled={disabled}
              className="rounded-2xl bg-gradient-to-l from-emerald-400 to-green-300 px-4 py-3 text-sm font-black text-black shadow-lg shadow-emerald-400/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disabled
                ? "جاري التجهيز..."
                : active
                  ? "محدد الآن ✅"
                  : "استخدم هذا الستايل 🎬"}
              <span className="mt-1 block text-[11px] font-bold text-black/70">
                تطبيق الإعدادات وإنشاء الفيديو
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
            <span className="text-neutral-400">اقتراح ذكي</span>
            <span className="font-black text-emerald-300">
              ثقة عالية في التطابق {aiMatch}%
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function PremiumMetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/30 p-3 text-center backdrop-blur">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg">
        {icon}
      </div>
      <p className="text-[10px] text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function getMoodLabel(topics: string[] = []) {
  if (topics.includes("الحزن") || topics.includes("الضيق")) return "حزن";
  if (
    topics.includes("الطمأنينة") ||
    topics.includes("الراحة") ||
    topics.includes("الراحة النفسية")
  ) {
    return "راحة";
  }
  if (topics.includes("الدعاء") || topics.includes("دعاء")) return "دعاء";
  if (topics.includes("الرزق")) return "أمل";
  if (topics.includes("التوبة") || topics.includes("الذنوب")) return "رجوع";

  return "روحاني";
}

function PromptChips({
  title,
  prompts,
  onSelect,
  compact = false,
}: {
  title: string;
  prompts: string[];
  onSelect: (prompt: string) => void;
  compact?: boolean;
}) {
  if (!prompts.length) return null;

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="mb-2 text-[11px] font-black text-neutral-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-bold text-neutral-200 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchSkeletonCards() {
  return (
    <div className="mt-4 space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse overflow-hidden rounded-3xl border border-white/10 bg-black/20"
        >
          <div className="h-28 bg-white/10 lg:h-40" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-2/3 rounded-full bg-white/10" />
            <div className="h-3 w-full rounded-full bg-white/10" />
            <div className="h-3 w-4/5 rounded-full bg-white/10" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-white/10" />
              <div className="h-6 w-20 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptySearchState({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 text-xl">
        🔎
      </div>
      <p className="font-black text-white">لم تظهر نتائج مناسبة</p>
      <p className="mt-2 text-xs leading-6 text-neutral-400">
        جرّب كلمة أقصر أو موضوعًا شائعًا من الاقتراحات التالية.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {["راحة نفسية", "دعاء", "رزق", "توبة"].map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScoreBreakdownBox({
  scoreBreakdown,
}: {
  scoreBreakdown: NonNullable<AiSuggestion["scoreBreakdown"]>;
}) {
  return (
    <div className="mt-4 hidden rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-neutral-300 lg:block">
      <div className="mb-2 font-bold text-emerald-300">Score Breakdown</div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          Exact Match:
          <span className="ml-1 text-white">
            {scoreBreakdown.exactTextMatch}
          </span>
        </div>

        <div>
          Loose Match:
          <span className="ml-1 text-white">{scoreBreakdown.looseMatch}</span>
        </div>

        <div>
          Famous Boost:
          <span className="ml-1 text-white">
            {scoreBreakdown.famousVerseBoost}
          </span>
        </div>

        <div>
          Context Boost:
          <span className="ml-1 text-white">
            {scoreBreakdown.contextualQueryBoost}
          </span>
        </div>

        <div>
          Match Bonus:
          <span className="ml-1 text-white">
            {scoreBreakdown.matchedWordsBonus}
          </span>
        </div>

        <div className="font-bold text-emerald-300">
          Total:
          <span className="ml-1">{scoreBreakdown.total}</span>
        </div>
      </div>
    </div>
  );
}

function normalizeExportJob(job: any): ExportJob {
  const id = job?.jobId || job?.id || "";

  return {
    ...job,
    id: job?.id || id,
    jobId: id,
    status: job?.status || "queued",
    progress: Number.isFinite(Number(job?.progress)) ? Number(job.progress) : 0,
    fileName: job?.fileName || "",
    url: job?.url || "",
    createdAt: job?.createdAt || Date.now(),
    completedAt: job?.completedAt,
    error: job?.error || "",
    metadata: job?.metadata || {
      reciter: job?.reciter,
      surahName: job?.surahName,
      firstAyah: job?.fromAyah,
      lastAyah: job?.toAyah,
      durationInSeconds: job?.durationInSeconds,
    },
  };
}

function ExportJobCard({ job }: { job: ExportJob }) {
  const status = getExportStatusLabel(job.status || "queued");
  const jobIdentifier = String(job.jobId || job.id || job.fileName || "export");
  const title = job.fileName || `تصدير ${jobIdentifier.slice(0, 8)}`;
  const meta = job.metadata || {
    reciter: job.reciter,
    surahName: job.surahName,
    firstAyah: job.fromAyah,
    lastAyah: job.toAyah,
    durationInSeconds: job.durationInSeconds,
  };
  const ayahRange =
    meta?.firstAyah && meta?.lastAyah
      ? `آيات ${meta.firstAyah} - ${meta.lastAyah}`
      : "";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{title}</p>
          <p className="mt-1 truncate text-xs text-neutral-400">
            {[meta?.surahName, meta?.reciter, ayahRange]
              .filter(Boolean)
              .join(" • ") || "تصدير سابق"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all duration-300"
          style={{
            width: `${Math.max(job.progress || 0, job.status === "completed" ? 100 : 6)}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-neutral-400">
        <span>{formatExportDate(job.createdAt)}</span>

        {job.url ? (
          <a
            href={job.url}
            download={job.fileName || "quran-reel.mp4"}
            className="rounded-xl bg-emerald-400 px-3 py-2 font-black text-black transition hover:bg-emerald-300"
          >
            تحميل
          </a>
        ) : job.error ? (
          <span className="truncate text-red-300">{job.error}</span>
        ) : (
          <span className="text-emerald-300">قيد المعالجة</span>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-extrabold transition ${
        active
          ? "border border-emerald-400/50 bg-emerald-400 text-black shadow-lg shadow-emerald-400/20"
          : "border border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="animate-slide-up space-y-5">
      <div>
        <h3 className="text-2xl font-black text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-400">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function MiniTabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-xs font-extrabold transition ${
        active
          ? "bg-emerald-400 text-black shadow-lg shadow-emerald-400/20"
          : "bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function CompactSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="animate-fade-in rounded-[28px] border border-white/10 bg-black/20 p-4">
      <div className="mb-5">
        <h4 className="text-lg font-black text-white">{title}</h4>
        <p className="mt-1 text-xs leading-6 text-neutral-400">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] text-neutral-400">{label}</p>
      <p className="mt-1 truncate font-black text-white">{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}

function SettingsGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-3xl border border-white/10 bg-white/5 p-5"
    >
      <summary className="cursor-pointer select-none text-lg font-bold text-white">
        {title}
      </summary>
      <div className="mt-5 space-y-5">{children}</div>
    </details>
  );
}

function SelectBox({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-neutral-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="modern-input"
      >
        {children}
      </select>
    </div>
  );
}

function BasicSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-neutral-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="modern-input"
      >
        {children}
      </select>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-neutral-300">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full rounded-2xl border border-white/10 bg-black/35 p-2"
      />
    </div>
  );
}

function RangeInput({
  label,
  value,
  onChange,
  min = "0",
  max = "100",
  step = "1",
  suffix = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-neutral-300">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
      <p className="mt-1 text-xs text-neutral-400">
        {value}
        {suffix}
      </p>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-neutral-300">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="modern-input"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function SliderValueLabel({
  value,
  suffix = "",
}: {
  value: string;
  suffix?: string;
}) {
  return (
    <p className="mt-1 text-xs text-neutral-400">
      {value}
      {suffix}
    </p>
  );
}

function getExportStatusLabel(status: string) {
  if (status === "completed") {
    return {
      label: "مكتمل",
      className: "bg-emerald-400 text-black",
    };
  }

  if (status === "failed") {
    return {
      label: "فشل",
      className: "bg-red-500/20 text-red-200 border border-red-400/30",
    };
  }

  if (status === "rendering") {
    return {
      label: "يصدر",
      className: "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30",
    };
  }

  return {
    label: "قيد الانتظار",
    className: "bg-white/10 text-neutral-200 border border-white/10",
  };
}

function formatExportDate(value?: number | string) {
  if (!value) return "-";

  try {
    const date =
      typeof value === "number" && value < 100000000000
        ? new Date(value * 1000)
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(date);
  } catch {
    return "-";
  }
}


function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function cleanSurahName(name: string) {
  return name
    .replace(/^\s*سورة\s+/u, "")
    .replace(/^\s*سُورَةُ\s+/u, "")
    .replace(/^\s*سُورَة\s+/u, "")
    .trim();
}
function detectReciterFromPrompt(prompt: string, reciters: Reciter[]) {
  const normalizedPrompt = normalizeArabicText(prompt);

  for (const reciter of reciters) {
    const searchableText = normalizeArabicText(
      `
      ${reciter.identifier}
      ${reciter.name}
      ${reciter.englishName}
      `,
    );

    const searchableWords = searchableText
      .split(/\s+/)
      .filter((word) => word.length >= 3);

    const matched = searchableWords.some((word) =>
      normalizedPrompt.includes(word),
    );

    if (matched) {
      return reciter.identifier;
    }
  }

  return null;
}
function normalizeArabicText(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْٰـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function estimateExportDurationSeconds(
  videoDurationSeconds: number,
  ayahsCount: number,
  backgroundType: "video" | "image",
) {
  const baseSeconds = 10;
  const renderMultiplier = backgroundType === "video" ? 1.15 : 0.85;
  const ayahProcessingSeconds = Math.max(ayahsCount * 1.5, 3);

  return Math.ceil(
    Math.max(
      baseSeconds +
        videoDurationSeconds * renderMultiplier +
        ayahProcessingSeconds,
      15,
    ),
  );
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(Math.floor(seconds || 0), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 MB";

  const megabytes = bytes / (1024 * 1024);

  if (megabytes < 1) {
    return `${Math.max(bytes / 1024, 1).toFixed(1)} KB`;
  }

  return `${megabytes.toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(Math.floor(seconds || 0), 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} ثانية`;
  }

  return `${minutes} دقيقة و ${remainingSeconds} ثانية`;
}

function buildDownloadFileName({
  reciter,
  surahName,
  fromAyah,
  toAyah,
}: {
  reciter: string;
  surahName: string;
  fromAyah: number | string;
  toAyah: number | string;
}) {
  const safeReciter = sanitizeDownloadPart(reciter || "reciter");
  const safeSurah = sanitizeDownloadPart(surahName || "surah");

  return `${safeReciter}-${safeSurah}-ayah-${fromAyah}-to-${toAyah}.mp4`;
}

function sanitizeDownloadPart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function playExportDoneSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1175, audioContext.currentTime + 0.12);

    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.18,
      audioContext.currentTime + 0.02,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.35,
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.38);
  } catch (error) {
    console.log(error);
  }
}

function shortText(text = "") {
  return text.length > 55 ? text.slice(0, 55) + "..." : text;
}

function highlightMatchedWords(text: string, matchedWords: string[] = []) {
  if (!matchedWords.length) {
    return text;
  }

  let highlighted = text;

  matchedWords.forEach((word) => {
    if (!word || word.length < 2) return;

    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(`(${escaped})`, "gi");

    highlighted = highlighted.replace(
      regex,
      `<span class="text-emerald-300 font-black">$1</span>`,
    );
  });

  return highlighted;
}

function getMoodEmoji(topics: string[] = []) {
  if (topics.includes("الحزن") || topics.includes("الضيق")) return "🤍";
  if (topics.includes("الدعاء") || topics.includes("دعاء")) return "🤲";
  if (topics.includes("الرزق")) return "🌿";
  if (topics.includes("التوبة") || topics.includes("الذنوب")) return "🕊️";
  if (topics.includes("الصيام") || topics.includes("رمضان")) return "🌙";
  if (topics.includes("الجنة")) return "✨";
  if (topics.includes("النار")) return "⚠️";
  if (
    topics.includes("الطمأنينة") ||
    topics.includes("الراحة") ||
    topics.includes("الراحة النفسية")
  ) {
    return "🌊";
  }
  return "🎬";
}

function getViralScore(score: number, topics: string[] = [], text = "") {
  const topicBoost = Math.min(topics.length * 4, 14);
  const shortTextBoost = text.length > 40 && text.length < 180 ? 8 : 2;
  const base = Math.round(score * 6.8 + topicBoost + shortTextBoost + 38);

  return Math.min(98, Math.max(64, base));
}

function predictReelDurationSeconds(text = "", topics: string[] = []) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const base = Math.ceil(words * 0.62);
  const moodExtra =
    topics.includes("الحزن") ||
    topics.includes("الطمأنينة") ||
    topics.includes("الراحة")
      ? 4
      : 2;

  return clampNumber(base + moodExtra, 8, 42);
}

function getTopicBackgroundClass(topics: string[] = []) {
  if (topics.includes("الحزن") || topics.includes("الضيق")) {
    return "bg-gradient-to-br from-slate-950 via-slate-800 to-slate-700";
  }

  if (topics.includes("الدعاء") || topics.includes("دعاء")) {
    return "bg-gradient-to-br from-indigo-950 via-sky-900 to-black";
  }

  if (topics.includes("الجنة")) {
    return "bg-gradient-to-br from-emerald-900 via-green-700 to-lime-500";
  }

  if (topics.includes("النار")) {
    return "bg-gradient-to-br from-red-950 via-orange-800 to-black";
  }

  if (topics.includes("الرزق")) {
    return "bg-gradient-to-br from-yellow-700 via-amber-500 to-orange-300";
  }

  if (
    topics.includes("الطمأنينة") ||
    topics.includes("الراحة") ||
    topics.includes("الراحة النفسية")
  ) {
    return "bg-gradient-to-br from-cyan-900 via-emerald-700 to-teal-400";
  }

  if (
    topics.includes("الصيام") ||
    topics.includes("صيام") ||
    topics.includes("رمضان")
  ) {
    return "bg-gradient-to-br from-amber-950 via-emerald-950 to-black";
  }

  if (topics.includes("التوبة") || topics.includes("الذنوب")) {
    return "bg-gradient-to-br from-orange-950 via-slate-950 to-emerald-950";
  }

  return "bg-gradient-to-br from-emerald-950 via-black to-emerald-800";
}

function buildSmartManualTimings(words: string[], duration: number) {
  if (!words.length) return [];

  const weights = words.map((word) => {
    const clean = word.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "");
    const letters = clean.length;
    const madd = (word.match(/[اويىآ]/g) || []).length;
    const pause = /[،؛.؟!ۚۖۗۙۛۜ]/.test(word) ? 0.9 : 0;

    return clampNumber(0.85 + letters * 0.28 + madd * 0.22 + pause, 0.8, 4.5);
  });

  const total = weights.reduce((sum, item) => sum + item, 0);
  let cursor = 0;

  return words.map((_, index) => {
    const time = Number(cursor.toFixed(2));
    cursor += (weights[index] / Math.max(total, 0.001)) * duration;

    return time;
  });
}

function fillManualTimingGaps(
  words: string[],
  timings: Array<number | null>,
  duration: number,
) {
  if (!words.length) return [];

  const auto = buildSmartManualTimings(words, duration);
  const next = [...auto];

  timings.forEach((time, index) => {
    if (typeof time === "number") {
      next[index] = time;
    }
  });

  const anchors = next
    .map((time, index) => ({
      time: typeof timings[index] === "number" ? Number(timings[index]) : null,
      index,
    }))
    .filter((item) => typeof item.time === "number") as Array<{
    time: number;
    index: number;
  }>;

  if (anchors.length < 2) return next;

  for (
    let anchorIndex = 0;
    anchorIndex < anchors.length - 1;
    anchorIndex += 1
  ) {
    const start = anchors[anchorIndex];
    const end = anchors[anchorIndex + 1];
    const steps = end.index - start.index;

    if (steps <= 1) continue;

    for (let index = start.index + 1; index < end.index; index += 1) {
      const ratio = (index - start.index) / steps;
      next[index] = Number(
        (start.time + (end.time - start.time) * ratio).toFixed(2),
      );
    }
  }

  return next;
}

function splitTextWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function getAyahSyncKey(ayah?: Ayah, index = 0) {
  if (!ayah) return `fallback-${index}`;

  const safeText = ayah.text || "";

  return ayah.numberInSurah
    ? `ayah-${ayah.numberInSurah}`
    : `text-${index}-${safeText.slice(0, 24)}`;
}

function getCurrentPreviewSyncItem(ayahs: ReelAyah[], currentSeconds: number) {
  let cursor = 0;

  for (let index = 0; index < ayahs.length; index += 1) {
    const ayah = ayahs[index];
    const duration = Math.max(ayah.duration || 5, 0.1);
    const start = cursor;
    const end = cursor + duration;

    if (currentSeconds >= start && currentSeconds < end) {
      return {
        ayah,
        index,
        startSeconds: start,
        durationSeconds: duration,
        localSeconds: currentSeconds - start,
      };
    }

    cursor = end;
  }

  const fallback = ayahs[ayahs.length - 1] || {
    text: "",
    audio: "",
    duration: 5,
    numberInSurah: 1,
  };

  return {
    ayah: fallback,
    index: Math.max(ayahs.length - 1, 0),
    startSeconds: Math.max(cursor - (fallback.duration || 5), 0),
    durationSeconds: fallback.duration || 5,
    localSeconds: Math.max((fallback.duration || 5) - 0.01, 0),
  };
}

function getNearestManualWordIndex(
  wordsCount: number,
  timings: Array<number | null>,
  localSeconds: number,
) {
  if (wordsCount <= 0) return 0;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < wordsCount; index += 1) {
    const value = timings[index];

    if (typeof value !== "number") continue;

    const distance = Math.abs(value - localSeconds);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  if (nearestDistance !== Number.POSITIVE_INFINITY) {
    return nearestIndex;
  }

  return clampNumber(
    Math.round((localSeconds / 5) * wordsCount),
    0,
    wordsCount - 1,
  );
}

function buildReelCaption(topics: string[] = [], surahName = "") {
  const title = buildReelTitle(topics, surahName);

  if (title.includes("طمأنينة") || title.includes("الحزن")) {
    return "احفظها وارجع لها وقت ما تحتاج سكينة.";
  }

  if (title.includes("الرزق")) {
    return "توكّل على الله، فالفرج يأتي من حيث لا تحتسب.";
  }

  if (title.includes("رحمة")) {
    return "لا تجعل الذنب يمنعك من الرجوع إلى الله.";
  }

  return "مقطع قصير يصلح لريل قرآني مؤثر.";
}

function getAudioDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(5);
      return;
    }

    const audio = new Audio(src);

    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration || 5);
    });

    audio.addEventListener("error", () => {
      resolve(5);
    });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getRenderStatusMessage(status: string) {
  if (status === "queued") return "في قائمة الانتظار";
  if (status === "validating") return "جاري فحص الخلفية وملفات الصوت";
  if (status === "bundling") return "جاري تجهيز Remotion";
  if (status === "rendering") return "جاري تصدير الفيديو";
  if (status === "completed") return "تم التصدير بنجاح";
  if (status === "failed") return "فشل التصدير";
  return "جاري معالجة الفيديو";
}

function getDurationSecondsWithBismillahIntroForPreview(ayahs: Array<{ text?: string; duration?: number }>) {
  const rawDurationSeconds = ayahs.reduce((total, ayah) => {
    return total + Math.max(Number(ayah.duration || 5), 0.1);
  }, 0);

  const introDuration = Math.max(DEFAULT_BISMILLAH_DURATION_SECONDS, 1.8);
  const firstText = ayahs[0]?.text || "";

  if (!firstText) {
    return introDuration;
  }

  if (isBismillahOnlyForPreview(firstText)) {
    const restDuration = ayahs.slice(1).reduce((total, ayah) => {
      return total + Math.max(Number(ayah.duration || 5), 0.1);
    }, 0);

    return introDuration + restDuration;
  }

  if (startsWithBismillahForPreview(firstText)) {
    return rawDurationSeconds;
  }

  return rawDurationSeconds + introDuration;
}

function isBismillahOnlyForPreview(text: string) {
  return normalizeArabicForBismillahForPreview(text) === normalizeArabicForBismillahForPreview(BISMILLAH_TEXT);
}

function startsWithBismillahForPreview(text: string) {
  return normalizeArabicForBismillahForPreview(text).startsWith(
    normalizeArabicForBismillahForPreview(BISMILLAH_TEXT),
  );
}

function normalizeArabicForBismillahForPreview(value: string) {
  return String(value || "")
    .replace(/﷽/g, "بسم الله الرحمن الرحيم")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u06D6-\u06ED۝۞]/g, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF]/g, "")
    .trim();
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
function buildReelHook(topics: string[] = [], ayahText = "") {
  if (topics.includes("الحزن") || topics.includes("الضيق")) {
    return "حين يضيق صدرك… اسمع هذه الآية 🤍";
  }

  if (
    topics.includes("الطمأنينة") ||
    topics.includes("الراحة") ||
    topics.includes("الراحة النفسية")
  ) {
    return "آية تهدئ قلبك وتعيد لك السكينة";
  }

  if (topics.includes("الدعاء") || topics.includes("دعاء")) {
    return "لما تحتاج تطمئن إن ربنا قريب منك";
  }

  if (topics.includes("الرزق")) {
    return "رسالة طمأنينة لكل من ينتظر الرزق";
  }

  if (topics.includes("التوبة") || topics.includes("الذنوب")) {
    return "مهما كانت ذنوبك… باب الرحمة مفتوح";
  }

  if (topics.includes("الصيام") || topics.includes("رمضان")) {
    return "آيات الصيام التي تذكرك بحكمة رمضان";
  }

  if (topics.includes("الجنة")) {
    return "وصف يملأ القلب شوقًا للجنة";
  }

  if (topics.includes("النار")) {
    return "تذكرة تهز القلب وتوقظه";
  }

  if (ayahText.length > 120) {
    return "مقطع قرآني مؤثر يستحق أن تسمعه للنهاية";
  }

  return "آية قصيرة… لكن معناها عظيم";
}

function buildReelTitle(topics: string[] = [], surahName = "") {
  const cleanName = surahName ? `سورة ${surahName}` : "آية من القرآن";

  if (topics.includes("الحزن") || topics.includes("الضيق")) {
    return `${cleanName} | رسالة لمن يشعر بالحزن`;
  }

  if (
    topics.includes("الطمأنينة") ||
    topics.includes("الراحة") ||
    topics.includes("الراحة النفسية")
  ) {
    return `${cleanName} | طمأنينة القلب`;
  }

  if (topics.includes("الدعاء") || topics.includes("دعاء")) {
    return `${cleanName} | إن الله قريب`;
  }

  if (topics.includes("الرزق")) {
    return `${cleanName} | الرزق والتوكل`;
  }

  if (topics.includes("التوبة") || topics.includes("الذنوب")) {
    return `${cleanName} | لا تقنط من رحمة الله`;
  }

  return `${cleanName} | مقطع قرآني مؤثر`;
}
