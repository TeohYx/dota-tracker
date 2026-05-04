import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dota 2 MMR Tracker",
  description: "Set an MMR goal and see how many wins per day you need."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
