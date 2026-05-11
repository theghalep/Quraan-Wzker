import { NextResponse } from "next/server";
import { loadQuranAyahs, searchQuranText } from "@/lib/quran-search-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body.query || body.prompt || "").trim();
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);

    if (!query) {
      return NextResponse.json(
        { message: "اكتب كلمة أو موضوع للبحث في القرآن" },
        { status: 400 },
      );
    }

    const ayahs = await loadQuranAyahs();
    const search = searchQuranText(ayahs, query, limit);

    if (search.results.length === 0) {
      return NextResponse.json(
        {
          message: "لم أجد آيات مطابقة. جرب كلمة أوضح أو جزء من الآية نفسها.",
          query: search.query,
          searchWords: search.searchWords,
          results: [],
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: `تم العثور على ${search.results.length} نتيجة`,
      query: search.query,
      searchWords: search.searchWords,
      results: search.results,
    });
  } catch (error: any) {
    console.error("QURAN_SEARCH_ERROR:", error);

    return NextResponse.json(
      {
        message: "حدث خطأ أثناء البحث في القرآن",
        error: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim();
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 10, 1),
    25,
  );

  if (!query) {
    return NextResponse.json(
      { message: "استخدم ?q=كلمة للبحث" },
      { status: 400 },
    );
  }

  try {
    const ayahs = await loadQuranAyahs();
    const search = searchQuranText(ayahs, query, limit);

    return NextResponse.json({
      message: `تم العثور على ${search.results.length} نتيجة`,
      query: search.query,
      searchWords: search.searchWords,
      results: search.results,
    });
  } catch (error: any) {
    console.error("QURAN_SEARCH_GET_ERROR:", error);

    return NextResponse.json(
      {
        message: "حدث خطأ أثناء البحث في القرآن",
        error: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
