import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const queries: Record<string, string> = {
  rain: "rain nature dark",
  clouds: "clouds sky cinematic",
  mosque: "mosque islamic night",
  nature: "nature river forest",
  night: "night stars moon",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const style = searchParams.get("style") || "nature";

    const query = queries[style] || queries.nature;

    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(
        query,
      )}&orientation=portrait&per_page=20`,
      {
        headers: {
          Authorization: process.env.PEXELS_API_KEY || "",
        },
        cache: "no-store",
      },
    );

    const data = await response.json();

    const videos = data.videos || [];

    if (!videos.length) {
      return NextResponse.json(
        {
          message: "لم يتم العثور على فيديوهات",
        },
        { status: 404 },
      );
    }

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];

    const videoFile =
      randomVideo.video_files.find(
        (file: any) => file.width >= 720 && file.link.includes(".mp4"),
      ) || randomVideo.video_files[0];

    return NextResponse.json({
      url: videoFile.link,
      style,
    });
  } catch (error: any) {
    console.error("BACKGROUND_API_ERROR:", error);

    return NextResponse.json(
      {
        message: "حدث خطأ أثناء جلب الخلفية",
        error: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
