import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BJJ Log",
  description: "Track your Brazilian Jiu-Jitsu journey",
};

export const viewport: Viewport = { themeColor: "#07080d" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
