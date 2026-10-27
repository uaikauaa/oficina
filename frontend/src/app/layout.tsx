import type { Metadata, Viewport } from "next";
import PwaInstallProvider from "@/components/PwaInstallProvider";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Oficina Gestão | Oficina Técnica de Máquinas de Solda e Geradores",
  description: "Plataforma WebApp especializada na gestão e manutenção de máquinas de solda e geradores de energia.",
  applicationName: "Oficina Gestão",
  appleWebApp: { capable: true, title: "Oficina Gestão", statusBarStyle: "black-translucent" },
  icons: { apple: [{ url: "/pwa/icon-192.png", sizes: "192x192" }] },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
        <PwaInstallProvider>{children}</PwaInstallProvider>
      </body>
    </html>
  );
}
