import { Composition, registerRoot } from "remotion";
import Video from "./Video";

const FPS = 30;

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
        const ayahs = props.ayahs || [];

        const durationInFrames =
          ayahs.length > 0
            ? Math.max(
                Math.ceil(
                  ayahs.reduce(
                    (total: number, ayah: { duration?: number }) =>
                      total + (ayah.duration || 5),
                    0,
                  ) * FPS,
                ),
                150,
              )
            : 300;

        return {
          durationInFrames,
          fps: FPS,
          width: 1080,
          height: 1920,
          props: {
            ...props,
            isRemotionRender: true,
          },
        };
      }}
      defaultProps={{
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
      }}
    />
  );
}

registerRoot(RemotionRoot);
