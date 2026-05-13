import type {
  Candidate,
  CandidateScoreBreakdown,
  ScholarRawData,
  Topic,
} from "../models/types.ts";

export interface CandidateScoreResult {
  score: number;
  scoreBreakdown: CandidateScoreBreakdown;
  matchedKeywords: string[];
  evidenceSummary: string[];
}

export interface LlmCandidateReview {
  externalId: string;
  fitVerdict?: "strong" | "medium" | "weak";
  adjustment: number;
  reason: string;
  detailSummary: string;
  matchedKeywords: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

const keywordExpansionMap: Array<{ pattern: RegExp; expansion: string[] }> = [
  {
    pattern: /人工智能|AI|机器学习|深度学习/gi,
    expansion: ["artificial intelligence", "machine learning", "deep learning"],
  },
  { pattern: /自然语言处理/gi, expansion: ["natural language processing"] },
  { pattern: /医学|医疗|临床|健康/gi, expansion: ["medical", "clinical", "healthcare"] },
  { pattern: /主题建模/gi, expansion: ["topic modeling"] },
  { pattern: /影像|医学影像/gi, expansion: ["medical imaging", "computer vision"] },
  { pattern: /治理|数字治理/gi, expansion: ["governance", "digital governance"] },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function phraseMatches(haystack: string, keyword: string): boolean {
  const normalizedHaystack = normalize(haystack);
  const normalizedKeyword = normalize(keyword);
  if (!normalizedKeyword) return false;
  if (normalizedHaystack.includes(normalizedKeyword)) return true;
  const keywordTokens = tokenize(normalizedKeyword);
  if (keywordTokens.length <= 1) return false;
  return keywordTokens.every((token) => normalizedHaystack.includes(token));
}

export function buildTopicKeywords(topic: Topic, theme: string): string[] {
  const baseKeywords = topic.keywords || [];
  const expanded: string[] = [];
  [...baseKeywords, topic.title, topic.description || "", theme].forEach((item) => {
    keywordExpansionMap.forEach(({ pattern, expansion }) => {
      if (pattern.test(item)) {
        expanded.push(...expansion);
      }
    });
  });
  return Array.from(
    new Set([
      ...baseKeywords,
      ...expanded,
      ...tokenize(topic.title),
      ...tokenize(topic.description || ""),
      ...tokenize(theme),
    ].map(normalize).filter(Boolean)),
  );
}

function collectMatchedKeywords(topicKeywords: string[], scholar: ScholarRawData): string[] {
  const evidenceTexts = [
    ...(scholar.topicNames || []),
    ...(scholar.concepts || []),
    ...(scholar.recentWorkTitles || []),
    ...(scholar.recentRelevantWorks || []).flatMap((work) => [
      work.title,
      ...(work.topicNames || []),
    ]),
  ];
  return topicKeywords
    .filter((keyword) => evidenceTexts.some((text) => phraseMatches(text, keyword)))
    .slice(0, 5);
}

function computeTopicFit(topicKeywords: string[], scholar: ScholarRawData): number {
  const matched = collectMatchedKeywords(topicKeywords, scholar);
  const keywordScore = Math.min(18, matched.length * 4);
  const relevantWorkScore = Math.min(14, (scholar.recentRelevantWorks?.length || 0) * 7);
  const titleHitScore = (scholar.recentRelevantWorks || []).some((work) =>
    topicKeywords.some((keyword) => phraseMatches(work.title, keyword)),
  )
    ? 8
    : 0;
  return clamp(keywordScore + relevantWorkScore + titleHitScore, 0, 40);
}

function computeRecency(scholar: ScholarRawData): number {
  const currentYear = new Date().getFullYear();
  const works = scholar.recentRelevantWorks || [];
  const workCountScore = Math.min(12, works.length * 4);
  const freshnessScore = Math.min(
    8,
    works.reduce((total, work) => {
      if (!work.publicationYear) return total;
      const age = currentYear - work.publicationYear;
      if (age <= 1) return total + 3;
      if (age <= 3) return total + 2;
      if (age <= 5) return total + 1;
      return total;
    }, 0),
  );
  return clamp(workCountScore + freshnessScore, 0, 20);
}

function computeImpact(scholar: ScholarRawData): number {
  const citationScore = Math.min(10, Math.log10((scholar.citedByCount || 0) + 1) * 2);
  const hIndexScore = Math.min(7, (scholar.hIndex || 0) / 8);
  const relevantCitationScore = Math.min(
    3,
    Math.log10(
      (scholar.recentRelevantWorks || []).reduce(
        (total, work) => total + (work.citedByCount || 0),
        0,
      ) + 1,
    ),
  );
  return Math.round(clamp(citationScore + hIndexScore + relevantCitationScore, 0, 20));
}

function computeDataConfidence(scholar: ScholarRawData): number {
  let score = 0;
  if (scholar.institution) score += 2;
  if (scholar.countryCode) score += 2;
  if (scholar.databaseUrl) score += 2;
  if (scholar.homepageUrl || scholar.orcid) score += 1;
  if ((scholar.topicNames?.length || 0) > 0 || (scholar.concepts?.length || 0) > 0) score += 1;
  if ((scholar.recentRelevantWorks?.length || 0) > 0) score += 2;
  return clamp(score, 0, 10);
}

function isYoungScholarCandidate(scholar: ScholarRawData): boolean {
  const hIndex = scholar.hIndex ?? 999;
  const works = scholar.worksCount ?? 999;
  return hIndex <= 25 || works <= 100;
}

export function computeCandidateScore(
  scholar: ScholarRawData,
  topicKeywords: string[],
  preferYoungScholar: boolean,
): CandidateScoreResult {
  const matchedKeywords = collectMatchedKeywords(topicKeywords, scholar);
  const scoreBreakdown: CandidateScoreBreakdown = {
    topicFit: computeTopicFit(topicKeywords, scholar),
    recency: computeRecency(scholar),
    impact: computeImpact(scholar),
    dataConfidence: computeDataConfidence(scholar),
    youngBonus: preferYoungScholar && isYoungScholarCandidate(scholar) ? 5 : 0,
    llmAdjustment: 0,
  };
  const score = sumBreakdown(scoreBreakdown);
  const evidenceSummary = buildEvidenceSummary(scholar, matchedKeywords);
  return { score, scoreBreakdown, matchedKeywords, evidenceSummary };
}

function sumBreakdown(breakdown: CandidateScoreBreakdown): number {
  return Math.round(
    breakdown.topicFit +
      breakdown.recency +
      breakdown.impact +
      breakdown.dataConfidence +
      breakdown.youngBonus +
      breakdown.llmAdjustment,
  );
}

function buildEvidenceSummary(scholar: ScholarRawData, matchedKeywords: string[]): string[] {
  const evidence: string[] = [];
  if (matchedKeywords.length > 0) {
    evidence.push(`匹配关键词：${matchedKeywords.join("、")}`);
  }
  (scholar.recentRelevantWorks || []).slice(0, 3).forEach((work) => {
    const year = work.publicationYear ? `${work.publicationYear}，` : "";
    evidence.push(`${year}${work.title}`);
  });
  if (typeof scholar.hIndex === "number" || typeof scholar.citedByCount === "number") {
    evidence.push(
      `影响力指标：H-index ${scholar.hIndex ?? "未知"}，被引 ${scholar.citedByCount ?? "未知"}`,
    );
  }
  return evidence.slice(0, 5);
}

export function applyLlmReviewToCandidate(
  candidate: Candidate,
  review: LlmCandidateReview,
): Candidate {
  const currentBreakdown = candidate.scoreBreakdown || {
    topicFit: 0,
    recency: 0,
    impact: 0,
    dataConfidence: 0,
    youngBonus: 0,
    llmAdjustment: 0,
  };
  const adjustment = clamp(Math.round(review.adjustment || 0), -5, 5);
  const nextBreakdown = {
    ...currentBreakdown,
    llmAdjustment: adjustment,
  };
  return {
    ...candidate,
    score: sumBreakdown(nextBreakdown),
    scoreBreakdown: nextBreakdown,
    reason: review.reason.trim() || candidate.reason,
    detailSummary: review.detailSummary.trim() || candidate.detailSummary,
    matchedKeywords: review.matchedKeywords.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 4),
    llmReviewNote: review.reason.trim() || candidate.llmReviewNote,
  };
}

export function isYoungScholar(scholar: ScholarRawData): boolean {
  return isYoungScholarCandidate(scholar);
}
