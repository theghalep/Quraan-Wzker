"use client";

import { Player } from "@remotion/player";
import Video from "@/remotion/Video";

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-6">
      <Player
        component={Video}
        durationInFrames={180}
        compositionWidth={1080}
        compositionHeight={1920}
        fps={30}
        controls
        inputProps={{
          text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
          textColor: "#ffffff",
          textSize: 72,
        }}
        style={{
          width: 320,
          borderRadius: 24,
          overflow: "hidden",
        }}
      />
    </main>
  );
}