import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "L’Atelier Quiz — Fabrique à quiz vidéo",
  description:
    "Imaginez et préparez vos quiz vidéo YouTube, dans un atelier simple et local.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
