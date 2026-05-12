import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";

export const metadata: Metadata = {
  title: "وذكر | Quran Reels Generator",
  description: "منصة احترافية لصناعة الريلز القرآنية بالذكاء الاصطناعي",
  keywords: [
    "Quran",
    "Quran Reels",
    "Islamic Videos",
    "Remotion",
    "وذكر",
    "ريلز قرآنية",
  ],

  openGraph: {
    title: "وذكر | Quran Reels Generator",
    description: "أنشئ فيديوهات قرآنية احترافية بسهولة",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "وذكر | Quran Reels Generator",
    description: "أنشئ فيديوهات قرآنية احترافية بسهولة",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning className="overflow-x-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
