import type { Metadata } from "next";
import { ibmPlexSans, newsreader } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "HanapHire — Get hired today. Hire in minutes.",
    template: "%s · HanapHire",
  },
  description:
    "HanapHire connects gig and hourly workers with businesses that need them right now — same-day shifts, verified profiles, and instant applications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-text-primary">
        {children}
      </body>
    </html>
  );
}
