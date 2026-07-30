import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GFOA AI Voice Interviewer",
  description: "MVP foundation for the GFOA AI Voice Interviewer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
