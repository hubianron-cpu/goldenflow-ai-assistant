import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoldenFlow AI Assistant",
  description: "AI Lead & Follow-Up Assistant for GoldenFlow-style sales workflows"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
