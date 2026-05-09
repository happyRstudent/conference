"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateSettingsForm } from "@/components/CandidateSettingsForm";
import { ErrorAlert } from "@/components/ErrorAlert";
import { LoadingState } from "@/components/LoadingState";
import { StepHeader } from "@/components/StepHeader";
import { TopicListEditor } from "@/components/TopicListEditor";
import { useConferencePlanner } from "@/context/ConferencePlannerContext";
import type { RecommendationResult, Scope, Topic } from "@/lib/models/types";
import { candidateSettingsSchema } from "@/lib/utils/validation";

export default function TopicsPage() {
  const router = useRouter();
  const {
    conferenceTheme,
    topics,
    topicGenerationSource,
    topicGenerationUsedFallback,
    candidateCountPerTopic,
    scope,
    preferYoungScholar,
    setTopics,
    setCandidateSettings,
    setRecommendationResult,
  } = useConferencePlanner();
  const [error, setError] = useState("");
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [loadingRecommend, setLoadingRecommend] = useState(false);

  useEffect(() => {
    if (!conferenceTheme || topics.length === 0) {
      router.replace("/");
    }
  }, [conferenceTheme, topics, router]);

  const handleTopicTitleChange = (id: string, title: string) => {
    const next = topics.map((topic) => (topic.id === id ? { ...topic, title } : topic));
    setTopics(next);
  };

  const handleRegenerate = async (index: number) => {
    setError("");
    setRegeneratingIndex(index);
    try {
      const response = await fetch("/api/topics/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conferenceTheme,
          index,
          existingTopics: topics.filter((item) => item.title.trim()),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "重新生成失败。");
      }
      const nextTopics = [...topics];
      nextTopics[index] = payload.topic as Topic;
      setTopics(nextTopics);
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "重新生成失败。");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleSettingsChange = (value: {
    candidateCountPerTopic: number;
    scope: Scope;
    preferYoungScholar: boolean;
  }) => {
    setCandidateSettings(value);
  };

  const handleGenerateCandidates = async () => {
    setError("");
    const invalidTopic = topics.find((topic) => !topic.title.trim());
    if (invalidTopic) {
      setError("议题标题不能为空，请先完善议题内容。");
      return;
    }
    const parsed = candidateSettingsSchema.safeParse({
      candidateCountPerTopic,
      scope,
      preferYoungScholar,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "候选参数不合法。");
      return;
    }

    setLoadingRecommend(true);
    try {
      const response = await fetch("/api/candidates/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conferenceTheme,
          topics,
          candidateCountPerTopic,
          scope,
          preferYoungScholar,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "生成候选人失败。");
      }
      setRecommendationResult(payload.result as RecommendationResult);
      router.push("/results");
    } catch (recommendError) {
      setError(
        recommendError instanceof Error
          ? recommendError.message
          : "正在检索候选人并生成推荐结果，请稍后重试。",
      );
    } finally {
      setLoadingRecommend(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <StepHeader currentStep={2} />
      <div className="space-y-6">
        {topicGenerationUsedFallback ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            当前议题生成部分基于本地关键词推断，建议配置 LLM API 以获得更高质量议题。
          </p>
        ) : null}
        {topicGenerationSource ? (
          <p className="text-xs text-slate-500">
            议题生成方式：{topicGenerationSource === "llm" ? "LLM + 学术检索增强" : "学术检索信号驱动算法"}
          </p>
        ) : null}

        <TopicListEditor
          topics={topics}
          onTitleChange={handleTopicTitleChange}
          onRegenerate={handleRegenerate}
          regeneratingIndex={regeneratingIndex}
        />

        <CandidateSettingsForm
          candidateCountPerTopic={candidateCountPerTopic}
          scope={scope}
          preferYoungScholar={preferYoungScholar}
          onChange={handleSettingsChange}
        />

        {loadingRecommend ? (
          <LoadingState text="正在检索候选人并生成推荐结果，请稍候" />
        ) : null}
        {error ? <ErrorAlert message={error} /> : null}

        <div className="flex justify-between">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => router.push("/")}
          >
            返回上一步
          </button>
          <button
            type="button"
            onClick={handleGenerateCandidates}
            disabled={loadingRecommend}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            确认议题并生成候选人
          </button>
        </div>
      </div>
    </main>
  );
}
