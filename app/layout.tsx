import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moobie Clurb",
  description: "Private movie club tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
