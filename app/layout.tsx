import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BJJ Log",
  description: "A private journal for Brazilian jiu-jitsu training",
};

export const viewport: Viewport = { themeColor: "#0d1017" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
