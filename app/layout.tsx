import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BJJ Log",
  description: "A private journal for Brazilian jiu-jitsu training",
};

// viewport-fit=cover lets the bottom tab bar pad itself past the phone's home indicator.
export const viewport: Viewport = { themeColor: "#0d1017", viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
