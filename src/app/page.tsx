"use client";

import { useRouter } from "next/navigation";
import { ThemeInputForm } from "@/components/ThemeInputForm";
import { useConferencePlanner } from "@/context/ConferencePlannerContext";
import type { Topic } from "@/lib/models/types";

export default function HomePage() {
  const router = useRouter();
  const {
    conferenceTheme,
    topicCount,
    setConferenceInput,
    setTopics,
    setTopicGenerationMeta,
  } = useConferencePlanner();

  const handleGenerateTopics = async (theme: string, count: number) => {
    const response = await fetch("/api/topics/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conferenceTheme: theme,
        topicCount: count,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "生成议题失败。");
    }
    setConferenceInput(theme, count);
    setTopics(payload.topics as Topic[]);
    if (payload.source) {
      setTopicGenerationMeta(
        payload.source as "llm" | "algorithmic",
        Boolean(payload.usedFallback),
      );
    }
    router.push("/topics");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-16">
      <section className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-wide text-slate-900">
          学术会议议题与演讲候选人推荐系统
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          用于辅助生成会议议题，并按议题推荐候选演讲人。
        </p>
        <p className="mt-2 text-xs text-slate-500">
          示例主题：人工智能赋能医学研究 / 数字经济与治理现代化 / 新材料前沿进展
        </p>
      </section>

      <ThemeInputForm
        initialTheme={conferenceTheme}
        initialTopicCount={topicCount}
        onSubmit={handleGenerateTopics}
      />
    </main>
  );
}
