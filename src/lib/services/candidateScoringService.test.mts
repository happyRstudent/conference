import assert from "node:assert/strict";
import test from "node:test";
import type { Candidate, ScholarRawData, Topic } from "../models/types.ts";

const servicePath = "./candidateScoringService.ts";

test("scores topic fit ahead of broad academic impact", async () => {
  const { buildTopicKeywords, computeCandidateScore } = await import(servicePath);
  const topic: Topic = {
    id: "topic_ai_medical",
    title: "医学影像大模型的临床评估",
    keywords: ["medical imaging", "clinical evaluation", "large language model"],
  };
  const topicKeywords = buildTopicKeywords(topic, "人工智能医学创新大会");

  const focusedScholar: ScholarRawData = {
    id: "https://openalex.org/A1",
    displayName: "Focused Scholar",
    institution: "Example University",
    countryCode: "US",
    worksCount: 30,
    citedByCount: 500,
    hIndex: 12,
    databaseUrl: "https://openalex.org/A1",
    source: "openalex",
    topicNames: ["Medical Imaging", "Clinical Evaluation"],
    recentRelevantWorks: [
      {
        title: "Clinical evaluation of medical imaging foundation models",
        publicationYear: new Date().getFullYear(),
        citedByCount: 30,
        topicNames: ["Medical Imaging", "Clinical Evaluation"],
      },
    ],
  };
  const broadScholar: ScholarRawData = {
    id: "https://openalex.org/A2",
    displayName: "Broad Scholar",
    institution: "Example Institute",
    countryCode: "US",
    worksCount: 900,
    citedByCount: 100000,
    hIndex: 120,
    databaseUrl: "https://openalex.org/A2",
    source: "openalex",
    topicNames: ["Artificial Intelligence"],
    recentRelevantWorks: [],
  };

  const focused = computeCandidateScore(focusedScholar, topicKeywords, false);
  const broad = computeCandidateScore(broadScholar, topicKeywords, false);

  assert.ok(focused.matchedKeywords.includes("medical imaging"));
  assert.ok(focused.scoreBreakdown.topicFit >= 28);
  assert.ok(focused.score > broad.score);
  assert.ok(broad.scoreBreakdown.impact >= focused.scoreBreakdown.impact);
});

test("caps LLM subjective adjustment and recomputes total score", async () => {
  const { applyLlmReviewToCandidate } = await import(servicePath);
  const candidate: Candidate = {
    id: "cand_1",
    externalId: "https://openalex.org/A1",
    name: "Focused Scholar",
    score: 69,
    reason: "规则推荐理由。",
    sourceTags: ["openalex"],
    dataCompleteness: "high",
    missingFields: [],
    scoreBreakdown: {
      topicFit: 34,
      recency: 14,
      impact: 12,
      dataConfidence: 9,
      youngBonus: 0,
      llmAdjustment: 0,
    },
  };

  const reviewed = applyLlmReviewToCandidate(candidate, {
    externalId: "https://openalex.org/A1",
    fitVerdict: "strong",
    adjustment: 12,
    reason: "LLM 认为其近期工作与议题直接贴合。",
    detailSummary: "近期围绕医学影像模型临床评估持续发表。",
    matchedKeywords: ["medical imaging"],
  });

  assert.equal(reviewed.scoreBreakdown?.llmAdjustment, 5);
  assert.equal(reviewed.score, 74);
  assert.match(reviewed.llmReviewNote || "", /直接贴合/);
});
