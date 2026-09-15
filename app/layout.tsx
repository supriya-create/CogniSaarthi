import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Plus_Jakarta_Sans,
} from "next/font/google";

import { OfflineProvider } from "@/components/offline/OfflineProvider";
import { ReminderNotifier } from "@/components/elderly/ReminderNotifier";
import { ThemeScript } from "@/components/ui/ThemeScript";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDict, localeTag } from "@/lib/i18n/dictionaries";
import "./globals.css";

// Interface face: a humanist grotesque with open apertures and tall
// x-height, which is what keeps 18px legible for an older reader.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Display face, headings only. Optical sizing gives the large sizes
// real contrast and the small ones enough weight to stay readable.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "opsz"],
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
  // Phase 5: installable, so the app opens on a patchy connection.
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Cognisaarthi" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#121614" },
  ],
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
      data-contrast={user?.preference?.highContrast ? "high" : undefined}
      className={`${jakarta.variable} ${fraunces.variable} ${notoDevanagari.variable} ${notoBengali.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a saved light/dark choice before first paint, so the
            page never flashes the other theme on the way in. */}
        <ThemeScript />
      </head>
      <body className="app-canvas antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:border focus:border-border focus:bg-surface focus:px-5 focus:py-3.5 focus:text-lg focus:font-semibold focus:shadow-float"
        >
          {dict.skipToContent}
        </a>
        {/* Registers the offline shell, scopes the local store to this
            elder, and shows the calm connection notice when it matters. */}
        <OfflineProvider userId={user?.id ?? null} language={language} />
        {/* Shows a device notification when a reminder comes due.
            Reads the local replica, so it works offline; renders
            nothing, and does nothing at all until the person has
            turned alerts on from their profile. */}
        <ReminderNotifier userId={user?.id ?? null} language={language} />
        {children}
      </body>
    </html>
  );
}
