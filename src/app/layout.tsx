import type { Metadata } from "next";
import { ConferencePlannerProvider } from "@/context/ConferencePlannerContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "学术会议议题与演讲候选人推荐系统",
  description: "用于辅助生成会议议题，并按议题推荐候选演讲候选人。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-900">
        <ConferencePlannerProvider>{children}</ConferencePlannerProvider>
      </body>
    </html>
  );
}
