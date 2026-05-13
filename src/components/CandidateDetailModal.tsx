import type { Candidate } from "@/lib/models/types";

interface Props {
  candidate: Candidate | null;
  onClose: () => void;
}

export function CandidateDetailModal({ candidate, onClose }: Props) {
  if (!candidate) return null;
  const breakdown = candidate.scoreBreakdown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{candidate.name}</h3>
          <button className="text-sm text-slate-600 hover:text-slate-900" onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <div className="space-y-2 text-sm text-slate-700">
          <p>单位：{candidate.institution || "暂未获取"}</p>
          <p>国籍/地区：{candidate.region || "暂未获取"}</p>
          <p>研究方向：{candidate.researchAreas || "暂未获取"}</p>
          <p>综合评分：{candidate.score}</p>
          {breakdown ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 font-medium text-slate-900">评分拆解</p>
              <div className="grid gap-1 sm:grid-cols-2">
                <p>主题贴合度：{breakdown.topicFit}/40</p>
                <p>近期活跃度：{breakdown.recency}/20</p>
                <p>学术影响力：{breakdown.impact}/20</p>
                <p>数据可信度：{breakdown.dataConfidence}/10</p>
                <p>青年优先：{breakdown.youngBonus}/5</p>
                <p>LLM 复核：{breakdown.llmAdjustment > 0 ? "+" : ""}{breakdown.llmAdjustment}</p>
              </div>
            </div>
          ) : null}
          <p>推荐理由：{candidate.reason}</p>
          {candidate.llmReviewNote ? (
            <p>LLM 复核说明：{candidate.llmReviewNote}</p>
          ) : null}
          <p>
            数据完整度：
            {candidate.dataCompleteness === "high"
              ? "数据较完整"
              : candidate.dataCompleteness === "medium"
                ? "部分字段缺失"
                : "仅检索到基础公开信息"}
          </p>
          <p>数据来源：{candidate.sourceTags.join(" / ") || "暂未标注"}</p>
          <p>详细说明：{candidate.detailSummary || "暂无详细说明。"}</p>
          <div>
            <p className="mb-1">代表成果/关键词摘要：</p>
            <ul className="list-disc space-y-1 pl-5">
              {(candidate.achievements || ["暂无代表成果摘要。"]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {candidate.evidenceSummary?.length ? (
            <div>
              <p className="mb-1">评分证据：</p>
              <ul className="list-disc space-y-1 pl-5">
                {candidate.evidenceSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {candidate.homepageUrl ? (
            <a
              className="block text-blue-700 hover:underline"
              href={candidate.homepageUrl}
              target="_blank"
              rel="noreferrer"
            >
              学者主页链接
            </a>
          ) : (
            <p>学者主页链接：暂未获取</p>
          )}
          {candidate.databaseUrl ? (
            <a
              className="block text-blue-700 hover:underline"
              href={candidate.databaseUrl}
              target="_blank"
              rel="noreferrer"
            >
              学术数据库页面链接
            </a>
          ) : (
            <p>学术数据库页面链接：暂未获取</p>
          )}
        </div>
      </div>
    </div>
  );
}
