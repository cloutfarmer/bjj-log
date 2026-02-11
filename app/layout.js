import "./globals.css";

export const metadata = {
  title: "BJJ Log",
  description: "Track your Brazilian Jiu-Jitsu journey",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
