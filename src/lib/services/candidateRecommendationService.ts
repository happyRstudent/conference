import type {
  Candidate,
  CandidateSource,
  DataCompleteness,
  RecommendationResult,
  Scope,
  ScholarRawData,
  Topic,
} from "@/lib/models/types";
import { validateCandidateLinks } from "@/lib/services/linkValidationService";
import {
  hasOpenAiApiKey,
  requestOpenAiStructuredOutput,
} from "@/lib/services/openaiService";
import {
  applyLlmReviewToCandidate,
  buildTopicKeywords,
  computeCandidateScore,
  isYoungScholar,
  type LlmCandidateReview,
} from "@/lib/services/candidateScoringService";
import { enrichScholarProfile } from "@/lib/services/scholarProfileService";
import { searchScholarsByTopic } from "@/lib/services/scholarSearchService";
import { buildId } from "@/lib/utils/common";

interface RecommendOptions {
  conferenceTheme: string;
  topics: Topic[];
  candidateCountPerTopic: number;
  scope: Scope;
  preferYoungScholar: boolean;
}

type CandidateReview = LlmCandidateReview;

interface CandidateReviewsPayload {
  candidates: CandidateReview[];
}

function normalizeRegion(countryCode?: string): string | undefined {
  if (!countryCode) return undefined;
  if (countryCode === "CN") return "中国";
  return countryCode;
}

function collectMissingFields(candidate: Candidate): string[] {
  const missing: string[] = [];
  if (!candidate.institution) missing.push("单位");
  if (!candidate.region) missing.push("国籍/地区");
  if (!candidate.researchAreas) missing.push("研究方向");
  if (!candidate.homepageUrl) missing.push("学者主页链接");
  if (!candidate.databaseUrl) missing.push("学术数据库链接");
  return missing;
}

function classifyCompleteness(missingCount: number): DataCompleteness {
  if (missingCount <= 1) return "high";
  if (missingCount <= 3) return "medium";
  return "low";
}

function buildReason(
  scholar: ScholarRawData,
  matchedKeywords: string[],
  topicTitle: string,
  preferYoungScholar: boolean,
): string {
  const parts: string[] = [];
  if (matchedKeywords.length > 0) {
    parts.push(`研究方向与议题“${topicTitle}”在${matchedKeywords.join("、")}等关键词上具有直接匹配`);
  }
  if (scholar.recentWorkTitles?.length) {
    parts.push("近五年公开论文主题显示其在该方向持续活跃");
  }
  if (typeof scholar.hIndex === "number" && typeof scholar.citedByCount === "number") {
    parts.push(`公开数据中 H-index ${scholar.hIndex}、被引 ${scholar.citedByCount} 次`);
  }
  if (preferYoungScholar && isYoungScholar(scholar)) {
    parts.push("符合青年教师优先条件");
  }
  if (parts.length === 0) {
    parts.push("已检索到与议题相关的公开学术记录，但可用于解释的字段有限");
  }
  return `${parts.join("；")}。`;
}

function buildResearchAreaText(scholar: ScholarRawData): string | undefined {
  if (scholar.topicNames && scholar.topicNames.length > 0) {
    return scholar.topicNames.slice(0, 5).join("、");
  }
  if (scholar.concepts && scholar.concepts.length > 0) {
    return scholar.concepts.slice(0, 5).join("、");
  }
  return undefined;
}

function buildAchievements(scholar: ScholarRawData): string[] {
  const lines: string[] = [];
  if (typeof scholar.worksCount === "number") {
    lines.push(`公开论文数量（OpenAlex）：${scholar.worksCount}`);
  }
  if (typeof scholar.citedByCount === "number") {
    lines.push(`公开被引次数（OpenAlex）：${scholar.citedByCount}`);
  }
  if (typeof scholar.hIndex === "number") {
    lines.push(`H-index（OpenAlex）：${scholar.hIndex}`);
  }
  if (scholar.recentWorkTitles?.length) {
    lines.push(`近期论文示例：${scholar.recentWorkTitles.slice(0, 2).join("；")}`);
  }
  return lines;
}

function toCandidate(
  scholar: ScholarRawData,
  scoreResult: ReturnType<typeof computeCandidateScore>,
  matchedKeywords: string[],
  reason: string,
): Candidate {
  const candidate: Candidate = {
    id: buildId("cand"),
    externalId: scholar.id,
    name: scholar.displayName,
    institution: scholar.institution,
    region: normalizeRegion(scholar.countryCode),
    researchAreas: buildResearchAreaText(scholar),
    score: scoreResult.score,
    reason,
    homepageUrl: scholar.homepageUrl,
    databaseUrl: scholar.databaseUrl,
    detailSummary: scholar.recentWorkTitles?.length
      ? `近五年代表论文主题：${scholar.recentWorkTitles.slice(0, 3).join("；")}`
      : "暂未检索到足够的近期论文摘要信息。",
    achievements: buildAchievements(scholar),
    isYoungScholar: isYoungScholar(scholar),
    matchedKeywords,
    scoreBreakdown: scoreResult.scoreBreakdown,
    evidenceSummary: scoreResult.evidenceSummary,
    sourceTags: [scholar.source],
    dataCompleteness: "low",
    missingFields: [],
  };

  const missingFields = collectMissingFields(candidate);
  candidate.missingFields = missingFields;
  candidate.dataCompleteness = classifyCompleteness(missingFields.length);
  return candidate;
}

function identityKey(candidate: Candidate): string {
  return `${candidate.name.toLowerCase()}::${candidate.institution || ""}`;
}

function mergeSourceTags(...sourceLists: CandidateSource[][]): CandidateSource[] {
  return Array.from(new Set(sourceLists.flat()));
}

function hasCandidateEvidence(candidate: Candidate): boolean {
  return Boolean(
    candidate.databaseUrl &&
      ((candidate.matchedKeywords?.length || 0) > 0 ||
        candidate.researchAreas ||
        candidate.detailSummary !== "暂未检索到足够的近期论文摘要信息。" ||
        (candidate.achievements?.length || 0) > 0),
  );
}

function summarizeCandidateForPrompt(candidate: Candidate): Record<string, unknown> {
  return {
    externalId: candidate.externalId,
    name: candidate.name,
    institution: candidate.institution || "",
    region: candidate.region || "",
    researchAreas: candidate.researchAreas || "",
    score: candidate.score,
    matchedKeywords: candidate.matchedKeywords || [],
    detailSummary: candidate.detailSummary || "",
    achievements: candidate.achievements || [],
    isYoungScholar: Boolean(candidate.isYoungScholar),
  };
}

async function rerankCandidatesWithLlm(
  conferenceTheme: string,
  topic: Topic,
  candidates: Candidate[],
  candidateCount: number,
  preferYoungScholar: boolean,
): Promise<Candidate[] | null> {
  if (!hasOpenAiApiKey() || candidates.length === 0) return null;

  const prompt = `你是一名学术会议组委会顾问。请从给定候选人中，为单个议题选出最适合的${candidateCount}位演讲嘉宾候选人。
要求：
1) 必须只从提供的候选人中选择，禁止编造新人物；
2) 优先判断“研究主题是否直接贴合议题”，其次再看学术影响力；
3) 如果候选人与议题只是泛相关，不要优先入选；
4) fitVerdict 只能是 strong、medium 或 weak，用于表达你对议题贴合度的主观判断；
5) adjustment 是 -5 到 5 的整数。直接贴合且证据强可加分，泛相关或证据弱应扣分；
6) reason 需要说明其与议题的具体贴合点、持续研究证据和邀请价值，35-90字；
7) detailSummary 需要概括其与议题最相关的研究方向或近期工作，25-70字；
8) matchedKeywords 只保留与议题最直接相关的1-4个关键词；
9) 若 preferYoungScholar 为 true，可在同等相关性下适度优先青年学者，但不能牺牲主题匹配度。

会议总主题：${conferenceTheme}
当前议题标题：${topic.title}
当前议题说明：${topic.description || ""}
当前议题关键词：${(topic.keywords || []).join("、")}
preferYoungScholar：${preferYoungScholar ? "true" : "false"}
候选人列表：${JSON.stringify(candidates.map(summarizeCandidateForPrompt))}`;

  const reviewed = await requestOpenAiStructuredOutput<CandidateReviewsPayload>({
    model: process.env.CANDIDATE_LLM_MODEL || process.env.TOPIC_LLM_MODEL || "gpt-4.1-mini",
    schemaName: "candidate_reviews",
    schema: {
      type: "object",
      properties: {
        candidates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              externalId: { type: "string" },
              fitVerdict: { type: "string", enum: ["strong", "medium", "weak"] },
              adjustment: { type: "number" },
              reason: { type: "string" },
              detailSummary: { type: "string" },
              matchedKeywords: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "externalId",
              "fitVerdict",
              "adjustment",
              "reason",
              "detailSummary",
              "matchedKeywords",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["candidates"],
      additionalProperties: false,
    },
    prompt,
  });

  if (!reviewed?.candidates || reviewed.candidates.length === 0) return null;

  const candidateMap = new Map(
    candidates
      .filter((candidate) => candidate.externalId)
      .map((candidate) => [candidate.externalId as string, candidate]),
  );

  const selected: Candidate[] = [];
  reviewed.candidates.forEach((item) => {
    const existing = candidateMap.get(item.externalId);
    if (!existing || selected.some((candidate) => candidate.externalId === item.externalId)) return;

    selected.push(applyLlmReviewToCandidate(existing, item));
  });

  return selected.sort((a, b) => b.score - a.score).slice(0, candidateCount);
}

function finalizeCandidate(candidate: Candidate): Candidate {
  const missingFields = collectMissingFields(candidate);
  return {
    ...candidate,
    sourceTags: mergeSourceTags(candidate.sourceTags),
    missingFields,
    dataCompleteness: classifyCompleteness(missingFields.length),
  };
}

export async function recommendCandidatesByTopics(
  options: RecommendOptions,
): Promise<RecommendationResult> {
  const usedCandidates = new Set<string>();
  const candidatesByTopic: Record<string, Candidate[]> = {};
  const warnings: string[] = [];
  const sourceCollector = new Set<CandidateSource>();
  let usedMockData = false;

  for (const topic of options.topics) {
    const topicKeywords = buildTopicKeywords(topic, options.conferenceTheme);
    const query = Array.from(new Set([topic.title, ...topicKeywords.slice(0, 6)])).join(" ");
    const searchResult = await searchScholarsByTopic(
      query,
      options.scope,
      Math.max(options.candidateCountPerTopic * 4, 8),
    );
    searchResult.sources.forEach((source) => sourceCollector.add(source));
    if (searchResult.usedMockData) usedMockData = true;
    warnings.push(...searchResult.warnings);

    const enriched = await Promise.all(
      searchResult.scholars.map((scholar) => enrichScholarProfile(scholar)),
    );

    const scoredCandidates = await Promise.all(
      enriched.map(async (scholar) => {
        const scoreResult = computeCandidateScore(
          scholar,
          topicKeywords,
          options.preferYoungScholar,
        );
        const reason = buildReason(
          scholar,
          scoreResult.matchedKeywords,
          topic.title,
          options.preferYoungScholar,
        );
        const candidate = toCandidate(
          scholar,
          scoreResult,
          scoreResult.matchedKeywords,
          reason,
        );
        return validateCandidateLinks(candidate);
      }),
    );

    const pool = scoredCandidates
      .filter(hasCandidateEvidence)
      .sort((a, b) => b.score - a.score);

    const llmShortlist = await rerankCandidatesWithLlm(
      options.conferenceTheme,
      topic,
      pool.slice(0, 12),
      options.candidateCountPerTopic,
      options.preferYoungScholar,
    );

    const llmSelected = (llmShortlist || []).filter((candidate) => {
      const key = identityKey(candidate);
      if (usedCandidates.has(key)) return false;
      return Boolean(candidate.databaseUrl);
    });

    const fallbackSelected = pool.filter((candidate) => {
      const key = identityKey(candidate);
      if (usedCandidates.has(key)) return false;
      return Boolean(candidate.databaseUrl && (candidate.matchedKeywords?.length || 0) > 0);
    });

    const selected: Candidate[] = [];

    [...llmSelected, ...fallbackSelected].forEach((candidate) => {
      if (selected.length >= options.candidateCountPerTopic) return;
      if (selected.some((item) => identityKey(item) === identityKey(candidate))) return;
      selected.push(candidate);
      usedCandidates.add(identityKey(candidate));
    });

    if (selected.length < options.candidateCountPerTopic) {
      pool
        .filter((candidate) => candidate.databaseUrl)
        .filter((candidate) => !selected.some((item) => identityKey(item) === identityKey(candidate)))
        .forEach((candidate) => {
          if (selected.length >= options.candidateCountPerTopic) return;
          selected.push({
            ...candidate,
            duplicateNote: "候选池有限，因议题高度相关而重复入选。",
          });
        });
    }

    if (selected.length < options.candidateCountPerTopic) {
      warnings.push(
        `议题“${topic.title}”的可验证候选人不足，当前仅展示已检索到的公开数据结果。`,
      );
    }

    candidatesByTopic[topic.id] = selected.map(finalizeCandidate);
  }

  const sourceList = Array.from(sourceCollector);
  const dedupedWarnings = Array.from(new Set(warnings));
  return {
    conferenceTheme: options.conferenceTheme,
    generatedAt: new Date().toISOString(),
    topics: options.topics,
    candidatesByTopic,
    scope: options.scope,
    preferYoungScholar: options.preferYoungScholar,
    warnings: dedupedWarnings,
    sourceSummary: {
      usedMockData,
      sources: sourceList.length > 0 ? sourceList : usedMockData ? ["mock"] : [],
      note: usedMockData
        ? "当前结果部分基于示例数据，仅供演示。"
        : hasOpenAiApiKey()
          ? "当前结果基于公开学术数据检索、来源校验与 LLM 相关性复核。"
          : "当前结果基于公开学术数据检索与归并（未启用 LLM 复核）。",
    },
  };
}
