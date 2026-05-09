"use client";

import type { RecommendationResult } from "@/lib/models/types";

export async function downloadRecommendationPdf(result: RecommendationResult): Promise<void> {
  const response = await fetch("/api/report/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "导出 PDF 失败，请稍后重试。");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "学术会议候选人推荐报告.pdf";
  link.click();
  window.URL.revokeObjectURL(url);
}
