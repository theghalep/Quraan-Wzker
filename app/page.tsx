"use client";

import Video from "@/remotion/Video";
import { useEffect, useMemo, useState } from "react";
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
  jobId: string;
  status: string;
  progress?: number;
  fileName?: string;
  url?: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
  metadata?: {
    reciter?: string;
    surahName?: string;
    firstAyah?: number | string;
    lastAyah?: number | string;
    durationInSeconds?: number;
  };
};

export default function Home() {
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
  const [textSize, setTextSize] = useState("34");
  const [fontFamily, setFontFamily] = useState("Amiri");

  const [backgroundStyle, setBackgroundStyle] = useState("emerald");
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState("");
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

  const [showSurahName, setShowSurahName] = useState(true);
  const [surahNameColor, setSurahNameColor] = useState("#ffffff");
  const [surahNameSize, setSurahNameSize] = useState("38");
  const [surahNamePosition, setSurahNamePosition] = useState("top");

  const [showReciterName, setShowReciterName] = useState(true);
  const [reciterNameColor, setReciterNameColor] = useState("#34d399");
  const [reciterNameSize, setReciterNameSize] = useState("28");
  const [reciterNamePosition, setReciterNamePosition] = useState("bottom");

  const [showBrandName, setShowBrandName] = useState(true);
  const [brandName, setBrandName] = useState("وذكر | wzkerq");
  const [brandNameColor, setBrandNameColor] = useState("#ffffff");
  const [brandNameSize, setBrandNameSize] = useState("28");
  const [brandNamePosition, setBrandNamePosition] = useState("bottom");
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

  const [activeTab, setActiveTab] = useState<
    "quran" | "background" | "design" | "labels" | "timing" | "export"
  >("quran");

  const [labelsSection, setLabelsSection] = useState<
    "surah" | "reciter" | "brand"
  >("surah");

  const selectedSurah = surahs.find(
    (surah) => String(surah.number) === chapter,
  );
  const selectedReciter = reciters.find((item) => item.identifier === reciter);
  const selectedReciterName =
    selectedReciter?.name || selectedReciter?.englishName || reciter;

  const displaySurahName = cleanSurahName(selectedSurah?.name || "الفاتحة");
  const previewAyahs =
    selectedAyahs.length > 0
      ? selectedAyahs
      : [
          {
            text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
            audio: "",
            duration: 5,
            numberInSurah: 1,
          },
        ];

  const previewDurationSeconds = useMemo(() => {
    return Math.max(
      previewAyahs.reduce((total, ayah) => total + (ayah.duration || 5), 0),
      5,
    );
  }, [previewAyahs]);

  const durationInFrames = Math.ceil(previewDurationSeconds * 30);

  const PreviewVideo = Video as any;

  const previewInputProps = {
    ayahs: previewAyahs,
    textColor,
    textSize: Number(textSize),
    fontFamily,
    backgroundStyle,
    backgroundVideoUrl,
    backgroundType,
    textPosition,
    animationStyle,
    wordSpeed,
    showSurahName,
    surahName: displaySurahName,
    surahNameColor,
    surahNameSize: Number(surahNameSize),
    surahNamePosition,
    showReciterName,
    reciter: selectedReciterName,
    reciterNameColor,
    reciterNameSize: Number(reciterNameSize),
    reciterNamePosition,
    showBrandName,
    brandName,
    brandNameColor,
    brandNameSize: Number(brandNameSize),
    brandNamePosition,
    brandNameStyle,

    showProgressBar,
    showCountdownTimer,
    progressColor,
    timerColor,
    progressPosition,
    timerPosition,
    progressHeight: Number(progressHeight),
    timerSize: Number(timerSize),
  };

  useEffect(() => {
    setPreviewSeekSeconds(0);
    setPreviewPlaying(true);
  }, [selectedAyahs]);

  useEffect(() => {
    loadRecentExports();
  }, []);

  async function loadRecentExports() {
    try {
      setLoadingRecentExports(true);

      const response = await fetch(`/api/render?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = await response.json();
      setRecentExports(Array.isArray(data.jobs) ? data.jobs : []);
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

      setExportElapsedSeconds(elapsedSeconds);
      setExportEstimatedRemainingSeconds(
        Math.max(exportEstimatedTotalSeconds - elapsedSeconds, 0),
      );

      setRealRenderProgress((current) => {
        const estimatedProgress = Math.min(
          Math.round(
            (elapsedSeconds / Math.max(exportEstimatedTotalSeconds, 1)) * 95,
          ),
          95,
        );

        return Math.max(current, estimatedProgress);
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [exporting, exportStartedAt, exportEstimatedTotalSeconds]);

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

  async function generateAiReel() {
    try {
      const prompt = aiPrompt.trim();

      if (!prompt) {
        alert("اكتب كلمة للبحث، مثال: الصيام");
        return;
      }

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

      setAiSuggestionTitle(
        suggestion.title ||
          `سورة ${suggestion.surahName || nextChapter} — آية ${nextFromAyah}`,
      );

      setAiSuggestionReason(
        suggestion.reason || "تم اختيار هذا المقطع بناءً على بحثك.",
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
          const duration = await getAudioDuration(ayah.audio || "");

          return {
            text: ayah.text,
            audio: ayah.audio || "",
            duration,
            numberInSurah: ayah.numberInSurah,
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
          const duration = await getAudioDuration(ayah.audio || "");

          return {
            text: ayah.text,
            audio: ayah.audio || "",
            duration,
            numberInSurah: ayah.numberInSurah,
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
        `الوقت المتوقع للتصدير: ${formatDuration(estimatedSeconds)}`,
        "جاري إرسال بيانات الفيديو للسيرفر...",
      ]);

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

      const response = await fetch("/api/render", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ayahs: selectedAyahs,
          textColor,
          textSize: Number(textSize),
          fontFamily,
          backgroundStyle,
          backgroundVideoUrl,
          backgroundType,
          textPosition,
          animationStyle,
          wordSpeed,
          showSurahName,
          surahName: displaySurahName,
          surahNameColor,
          surahNameSize: Number(surahNameSize),
          surahNamePosition,
          showReciterName,
          reciter: selectedReciterName,
          reciterNameColor,
          reciterNameSize: Number(reciterNameSize),
          reciterNamePosition,
          showBrandName,
          brandName,
          brandNameColor,
          brandNameSize: Number(brandNameSize),
          brandNamePosition,
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

      const data = await response.json();

      if (!response.ok || !data.url) {
        setExportStatus("فشل التصدير");
        setExportLogs((logs) => [
          ...logs,
          data.message || "فشل التصدير أثناء المعالجة",
        ]);
        alert(data.message || "فشل التصدير");
        return;
      }

      const finalElapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const finalUrl = data.url + "?t=" + Date.now();

      setDownloadUrl(finalUrl);
      setExportFileName(
        data.fileName ||
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
    } catch (error) {
      console.log(error);
      setExportStatus("حدث خطأ أثناء التصدير");
      setRealRenderProgress(0);
      setExportLogs((logs) => [...logs, "حدث خطأ أثناء التصدير"]);
      alert("حدث خطأ أثناء التصدير");
    } finally {
      setExporting(false);
      setExportStartedAt(null);
      setExportEstimatedRemainingSeconds(0);
    }
  }

  const backgroundCards = [
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

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden px-4 py-4 text-white md:px-6 md:py-6"
    >
      <div className="mx-auto flex min-h-[calc(100vh-32px)] max-w-[1800px] flex-col gap-5 lg:min-h-[calc(100vh-48px)]">
        <header className="glass-card flex flex-col gap-4 rounded-[32px] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs font-bold text-emerald-300">
              {brandName}
            </p>

            <h1 className="text-2xl font-black tracking-tight md:text-4xl">
              Quran Reels Generator
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-neutral-300 md:text-base">
              اصنع فيديوهات قرآنية احترافية بتصميم سينمائي، خلفيات متحركة، وتحكم
              كامل في المعاينة والتصدير.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs md:min-w-[360px]">
            <StatCard label="السورة" value={displaySurahName || "-"} />
            <StatCard
              label="المدة"
              value={formatTime(previewDurationSeconds)}
            />
            <StatCard label="الآيات" value={`${fromAyah} - ${toAyah}`} />
          </div>
        </header>

        <div
          dir="ltr"
          className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_430px]"
        >
          <section
            dir="rtl"
            className="order-2 flex min-h-[720px] flex-col items-center justify-center rounded-[36px] border border-white/10 bg-black/20 p-4 shadow-2xl lg:order-1 lg:p-6"
          >
            <div className="relative flex w-full flex-1 items-center justify-center">
              <div className="absolute h-[520px] w-[520px] rounded-full bg-emerald-400/20 blur-[110px]" />
              <div className="absolute h-[360px] w-[360px] translate-x-24 translate-y-20 rounded-full bg-cyan-400/10 blur-[110px]" />

              <div className="relative rounded-[44px] border border-white/15 bg-black p-3 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
                <div className="pointer-events-none absolute -inset-1 rounded-[48px] border border-emerald-400/20" />
                <div
                  style={{
                    width: 390,
                    height: 694,
                    overflow: "hidden",
                    borderRadius: 32,
                  }}
                  className="bg-black"
                >
                  <PreviewVideo
                    ayahs={previewAyahs}
                    textColor={textColor}
                    textSize={Number(textSize)}
                    fontFamily={fontFamily}
                    textPosition={textPosition}
                    brandNameStyle={brandNameStyle}
                    backgroundVideoUrl={backgroundVideoUrl}
                    backgroundType={backgroundType}
                    showSurahName={showSurahName}
                    surahName={displaySurahName || "الفاتحة"}
                    surahNameColor={surahNameColor}
                    surahNameSize={Number(surahNameSize)}
                    surahNamePosition={surahNamePosition}
                    showReciterName={showReciterName}
                    reciter={selectedReciterName}
                    reciterNameColor={reciterNameColor}
                    reciterNameSize={Number(reciterNameSize)}
                    reciterNamePosition={reciterNamePosition}
                    showBrandName={showBrandName}
                    brandName={brandName}
                    brandNameColor={brandNameColor}
                    brandNameSize={Number(brandNameSize)}
                    brandNamePosition={brandNamePosition}
                    showProgressBar={showProgressBar}
                    showCountdownTimer={showCountdownTimer}
                    progressColor={progressColor}
                    timerColor={timerColor}
                    progressPosition={progressPosition}
                    timerPosition={timerPosition}
                    progressHeight={Number(progressHeight)}
                    timerSize={Number(timerSize)}
                    previewPlaying={previewPlaying}
                    previewSeekSeconds={previewSeekSeconds}
                    isRemotionRender={false}
                  />
                </div>
              </div>
            </div>

            <div className="glass-card-strong cinematic-frame preview-glow mt-5 w-full max-w-3xl overflow-hidden rounded-[32px] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">
                    المعاينة المباشرة
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    تحكم كامل أثناء تشغيل الفيديو
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
            className="order-1 flex min-h-[720px] flex-col gap-4 lg:order-2"
          >
            <div className="glass-card-strong rounded-[34px] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">لوحة التحكم</h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    اختر التبويب وعدّل الفيديو بسهولة
                  </p>
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
                  active={activeTab === "export"}
                  onClick={() => setActiveTab("export")}
                  label="التصدير"
                  icon="⬇️"
                />
              </div>
            </div>

            <div className="glass-card flex-1 overflow-hidden rounded-[34px]">
              <div className="h-full overflow-y-auto p-5">
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
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="مثال: الصيام، الرزق، الدعاء، الصبر"
                        className="modern-input min-h-[96px] resize-none leading-7"
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

                          {aiSuggestions.map(
                            (suggestion: any, index: number) => {
                              const suggestionId =
                                suggestion.id ||
                                `${suggestion.chapter}-${suggestion.numberInSurah || suggestion.fromAyah}`;

                              const topics: string[] =
                                suggestion.detectedTopics || [];

                              const previewBackgroundClass = topics.includes(
                                "الحزن",
                              )
                                ? "bg-gradient-to-br from-slate-950 via-slate-800 to-slate-700"
                                : topics.includes("الدعاء")
                                  ? "bg-gradient-to-br from-indigo-950 via-sky-900 to-black"
                                  : topics.includes("الجنة")
                                    ? "bg-gradient-to-br from-emerald-900 via-green-700 to-lime-500"
                                    : topics.includes("النار")
                                      ? "bg-gradient-to-br from-red-950 via-orange-800 to-black"
                                      : topics.includes("الرزق")
                                        ? "bg-gradient-to-br from-yellow-700 via-amber-500 to-orange-300"
                                        : topics.includes("الطمأنينة") ||
                                            topics.includes("الراحة") ||
                                            topics.includes("الراحة النفسية")
                                          ? "bg-gradient-to-br from-cyan-900 via-emerald-700 to-teal-400"
                                          : topics.includes("الصيام") ||
                                              topics.includes("صيام") ||
                                              topics.includes("رمضان")
                                            ? "bg-gradient-to-br from-amber-950 via-emerald-950 to-black"
                                            : topics.includes("التوبة") ||
                                                topics.includes("الذنوب")
                                              ? "bg-gradient-to-br from-orange-950 via-slate-950 to-emerald-950"
                                              : "bg-gradient-to-br from-emerald-950 via-black to-emerald-800";

                              return (
                                <div
                                  key={`${suggestionId}-${index}`}
                                  className={`overflow-hidden rounded-3xl border transition ${
                                    selectedAiSuggestionId === suggestionId
                                      ? "border-emerald-400 bg-emerald-400/10"
                                      : "border-white/10 bg-black/20"
                                  }`}
                                >
                                  <div className="relative h-40 overflow-hidden">
                                    <div
                                      className={`absolute inset-0 ${previewBackgroundClass}`}
                                    />
                                    <div className="absolute inset-0 bg-black/35" />
                                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />
                                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />

                                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                                      <p
                                        className="max-h-28 overflow-hidden text-lg font-black leading-9 text-white drop-shadow-2xl"
                                        dangerouslySetInnerHTML={{
                                          __html: highlightMatchedWords(
                                            suggestion.text,
                                            suggestion.matchedWords || [],
                                          ),
                                        }}
                                      />
                                    </div>

                                    <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
                                      Preview
                                    </div>

                                    {topics[0] && (
                                      <div className="absolute right-3 top-3 rounded-full bg-emerald-400/90 px-3 py-1 text-[10px] font-black text-black">
                                        #{topics[0]}
                                      </div>
                                    )}
                                  </div>

                                  <div className="p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-black text-white">
                                          سورة {suggestion.surahName} — آية{" "}
                                          {suggestion.numberInSurah}
                                        </p>

                                        <p className="mt-1 text-xs text-neutral-400">
                                          Score: {suggestion.score}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          applyAiSuggestion(suggestion)
                                        }
                                        disabled={preparingPreview}
                                        className="rounded-2xl bg-emerald-400 px-4 py-2 text-xs font-black text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {preparingPreview
                                          ? "جاري..."
                                          : "معاينة"}
                                      </button>
                                    </div>

                                    <p
                                      className="text-sm leading-8 text-neutral-200"
                                      dangerouslySetInnerHTML={{
                                        __html: highlightMatchedWords(
                                          suggestion.text,
                                          suggestion.matchedWords || [],
                                        ),
                                      }}
                                    />

                                    {suggestion.matchedWords?.length > 0 && (
                                      <div className="mt-4 flex flex-wrap gap-2">
                                        {suggestion.matchedWords.map(
                                          (word: string) => (
                                            <span
                                              key={word}
                                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-emerald-300"
                                            >
                                              {word}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}

                                    {topics.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {topics.map((topic: string) => (
                                          <span
                                            key={topic}
                                            className="rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-bold text-cyan-300"
                                          >
                                            #{topic}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {suggestion.scoreBreakdown && (
                                      <ScoreBreakdownBox
                                        scoreBreakdown={
                                          suggestion.scoreBreakdown
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            },
                          )}
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
                          min="42"
                          max="110"
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
                      <option value="Amiri">Amiri</option>
                      <option value="Cairo">Cairo</option>
                      <option value="Reem Kufi">Reem Kufi</option>
                      <option value="Noto Naskh Arabic">
                        Noto Naskh Arabic
                      </option>
                      <option value="Lateef">Lateef</option>
                      <option value="Scheherazade New">Scheherazade New</option>
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
                          label="المكان"
                          value={surahNamePosition}
                          onChange={setSurahNamePosition}
                        >
                          <option value="top">أعلى</option>
                          <option value="center">منتصف</option>
                          <option value="bottom">أسفل</option>
                        </SelectBox>
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
                          label="المكان"
                          value={reciterNamePosition}
                          onChange={setReciterNamePosition}
                        >
                          <option value="top">أعلى</option>
                          <option value="center">منتصف</option>
                          <option value="bottom">أسفل</option>
                        </SelectBox>
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
                            label="المكان"
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
                      </CompactSection>
                    )}
                  </Panel>
                )}

                {activeTab === "timing" && (
                  <Panel
                    title="إعدادات التوقيت"
                    description="تحكم في شريط التقدم والعداد العكسي."
                  >
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

                {activeTab === "export" && (
                  <Panel
                    title="التصدير"
                    description="راجع معلومات الفيديو وابدأ التصدير بصيغة MP4."
                  >
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
                      {exporting ? "جاري التصدير..." : "تصدير MP4"}
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
                          {recentExports.slice(0, 5).map((job) => (
                            <ExportJobCard key={job.jobId} job={job} />
                          ))}
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
  suggestion: AiSuggestion;
  index: number;
  active: boolean;
  disabled: boolean;
  onPreview: () => void;
}) {
  const ayahRange =
    suggestion.fromAyah === suggestion.toAyah
      ? `آية ${suggestion.fromAyah}`
      : `آيات ${suggestion.fromAyah} - ${suggestion.toAyah}`;

  return (
    <div
      className={`rounded-[24px] border p-4 transition ${
        active
          ? "border-emerald-400/70 bg-emerald-400/15 shadow-[0_0_35px_rgba(52,211,153,0.16)]"
          : "border-white/10 bg-black/25 hover:border-emerald-400/30"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">
            {index + 1}. {suggestion.surahName || `سورة ${suggestion.chapter}`}{" "}
            - {ayahRange}
          </p>
          <p className="mt-1 text-[11px] font-bold text-emerald-300">
            الآية المطابقة: {suggestion.matchedAyahNumber}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-neutral-200">
          score {Math.round(suggestion.score || 0)}
        </span>
      </div>

      <p className="line-clamp-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm leading-8 text-neutral-100">
        {suggestion.matchedAyahText}
      </p>

      {suggestion.matchedWords?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.matchedWords.slice(0, 6).map((word) => (
            <span
              key={word}
              className="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-200"
            >
              {word}
            </span>
          ))}
        </div>
      )}

      {(suggestion.detectedTopics?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(suggestion.detectedTopics || []).map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold text-emerald-200"
            >
              #{topic}
            </span>
          ))}
        </div>
      )}

      {suggestion.scoreBreakdown && (
        <ScoreBreakdownBox scoreBreakdown={suggestion.scoreBreakdown} />
      )}

      {suggestion.reason && (
        <p className="mt-3 text-xs leading-6 text-neutral-400">
          {suggestion.reason}
        </p>
      )}

      <button
        type="button"
        onClick={onPreview}
        disabled={disabled}
        className="primary-button mt-4 w-full px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {active && disabled
          ? "جاري تجهيز هذا الاقتراح..."
          : "استخدام هذا الاقتراح"}
      </button>
    </div>
  );
}

function ScoreBreakdownBox({
  scoreBreakdown,
}: {
  scoreBreakdown: NonNullable<AiSuggestion["scoreBreakdown"]>;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-neutral-300">
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

function ExportJobCard({ job }: { job: ExportJob }) {
  const status = getExportStatusLabel(job.status);
  const title = job.fileName || `تصدير ${job.jobId.slice(0, 8)}`;
  const meta = job.metadata;
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
      className={`group flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-extrabold transition ${
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
  children: React.ReactNode;
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
  children: React.ReactNode;
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
  children: React.ReactNode;
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
  children: React.ReactNode;
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
  children: React.ReactNode;
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

function formatExportDate(value?: number) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return "-";
  }
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

function shortText(text: string) {
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
