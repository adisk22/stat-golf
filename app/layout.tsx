import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { GAME_NAME } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** Pencil handwriting for scores on the card. */
const hand = Caveat({ variable: "--font-hand-src", subsets: ["latin"], weight: ["500", "700"] });
/** Condensed caps for scorecard labels and tee signs. */
const card = Oswald({ variable: "--font-card-src", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: GAME_NAME,
  description: "A daily football trivia game: guess the entity at the target rank.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${hand.variable} ${card.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <nav className="border-b-4 border-fairway-900/30 bg-fairway-800 text-white shadow-md">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg shadow-inner">⛳</span>
              <span className="font-card text-xl font-semibold uppercase tracking-[0.12em]">{GAME_NAME}</span>
            </Link>
            <span className="hidden font-card text-xs uppercase tracking-[0.25em] text-fairway-200 sm:block">Daily football ranking golf</span>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
