import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

/*
  본문 폰트는 Pretendard 다(`globals.css`). Figma 가 그렇게 그려져 있고,
  Geist 에는 한글이 없어 한글은 어차피 OS 폰트로 떨어지고 있었다.
  Mono 만 남긴다 — 숫자·코드를 줄 맞춰 보여 줄 때 쓴다.
*/
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "메티 · 생각하는 힘을 키우는 학습 친구",
  description: "초등학생이 스스로 생각하는 과정을 함께 짚어보는 학습 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
