"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateDetailModal } from "@/components/CandidateDetailModal";
import { ExportPdfButton } from "@/components/ExportPdfButton";
import { StepHeader } from "@/components/StepHeader";
import { useConferencePlanner } from "@/context/ConferencePlannerContext";
import type { Candidate } from "@/lib/models/types";
import { scopeLabelMap, toReadableDate } from "@/lib/utils/common";

export default function ResultsPage() {
  const router = useRouter();
  const { recommendationResult, candidateCountPerTopic } = useConferencePlanner();
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    if (!recommendationResult) {
      router.replace("/topics");
    }
  }, [recommendationResult, router]);

  if (!recommendationResult) return null;

  const hasInsufficient = recommendationResult.topics.some(
    (topic) =>
      (recommendationResult.candidatesByTopic[topic.id]?.length || 0) < candidateCountPerTopic,
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <StepHeader currentStep={3} />
      <header className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">候选人推荐结果</h1>
          <div className="flex gap-2">
            <ExportPdfButton result={recommendationResult} />
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => router.push("/topics")}
              type="button"
            >
              返回修改议题
            </button>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p>会议主题：{recommendationResult.conferenceTheme}</p>
          <p>生成日期：{toReadableDate(recommendationResult.generatedAt)}</p>
          <p>候选人范围：{scopeLabelMap[recommendationResult.scope]}</p>
          <p>青年教师优先：{recommendationResult.preferYoungScholar ? "是" : "否"}</p>
        </div>
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">数据来源说明</p>
          <p className="mt-1">
            来源类型：
            {recommendationResult.sourceSummary.sources.length > 0
              ? recommendationResult.sourceSummary.sources.join(" / ")
              : "暂未标注"}
          </p>
          <p className="mt-1">{recommendationResult.sourceSummary.note}</p>
        </div>
        {recommendationResult.sourceSummary.usedMockData ? (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            当前结果部分基于示例数据，仅供演示。
          </p>
        ) : null}
        {hasInsufficient ? (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            当前可获取的相关候选人较少，以下为基于现有数据推荐的结果。
          </p>
        ) : null}
        {recommendationResult.warnings.length > 0 ? (
          <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2">
            <p className="text-sm font-medium text-slate-900">检索提示</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {recommendationResult.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      <section className="space-y-5">
        {recommendationResult.topics.map((topic, index) => {
          const candidates = recommendationResult.candidatesByTopic[topic.id] || [];
          return (
            <article key={topic.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h2 className="mb-2 text-lg font-semibold text-slate-900">
                议题 {index + 1}：{topic.title}
              </h2>
              {topic.description ? (
                <p className="mb-4 text-sm text-slate-600">{topic.description}</p>
              ) : null}
              {topic.keywords && topic.keywords.length > 0 ? (
                <p className="mb-2 text-xs text-slate-500">
                  关键词：{topic.keywords.join("、")}
                </p>
              ) : null}
              {topic.basis ? (
                <p className="mb-4 text-xs text-slate-500">生成依据：{topic.basis}</p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                {candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onViewDetail={setSelectedCandidate}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <CandidateDetailModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </main>
  );
}
