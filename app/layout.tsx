import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Altrack - Alternance Sport",
  description:
    "Suivi des offres d'alternance en communication et événementiel sportif"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
