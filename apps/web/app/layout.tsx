import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/lib/i18n";
import { I18nInit } from "@/components/i18n-init";
import { CsrfProvider } from "@/components/csrf-provider";

// Polices auto-hébergées (app/fonts) : build déterministe, sans dépendance
// réseau vers Google Fonts, et aucune requête tierce côté visiteur.
const inter = localFont({
  src: [
    { path: "./fonts/InterVariable.woff2", style: "normal" },
    { path: "./fonts/InterVariable-Italic.woff2", style: "italic" },
  ],
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

const playfair = localFont({
  src: [
    { path: "./fonts/PlayfairDisplay-Variable.ttf", style: "normal" },
    { path: "./fonts/PlayfairDisplay-Italic-Variable.ttf", style: "italic" },
  ],
  weight: "400 900",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cabinet - Gestion des dossiers",
  description: "Plateforme de gestion multidisciplinaire avocats / huissiers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr-SN" dir="ltr">
      <body className={`${inter.variable} ${playfair.variable} bg-cabinet-50 font-sans text-cabinet-900 antialiased`}>
        <I18nInit />
        <CsrfProvider />
        {children}
      </body>
    </html>
  );
}
