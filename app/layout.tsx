import type { Metadata, Viewport } from "next";
import {
  Inter,
  Lora,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
} from "next/font/google";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getDict, localeTag } from "@/lib/i18n/dictionaries";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

// Hindi and Assamese are offered at onboarding, so their scripts are
// loaded rather than left to fall back to whatever the device has.
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-deva",
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-noto-beng",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cognisaarthi",
  description:
    "A warm companion for everyday memory and brain activities, made for older adults in the North East of India.",
};

export const viewport: Viewport = {
  themeColor: "#f7f2ea",
  // Elderly users pinch to zoom; never disable it.
  maximumScale: 5,
  initialScale: 1,
  width: "device-width",
};

const TEXT_SIZE_ATTR = {
  COMFORTABLE: "comfortable",
  LARGE: "large",
  EXTRA_LARGE: "xlarge",
} as const;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Preferences are applied on the server so the page never flashes
  // at the wrong size before a client effect corrects it.
  const user = await getCurrentUser();
  const language = user?.preference?.language ?? user?.language ?? "EN";
  const textSize = TEXT_SIZE_ATTR[user?.preference?.fontScale ?? "COMFORTABLE"];
  const dict = getDict(language);

  return (
    <html
      lang={localeTag(language)}
      data-text-size={textSize}
      data-reduce-motion={user?.preference?.reduceMotion ? "true" : undefined}
      className={`${inter.variable} ${lora.variable} ${notoDevanagari.variable} ${notoBengali.variable}`}
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:text-lg focus:font-semibold focus:shadow-lift"
        >
          {dict.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
