import type { Topic } from "@/lib/models/types";
import {
  hasOpenAiApiKey,
  requestOpenAiStructuredOutput,
} from "@/lib/services/openaiService";
import { researchTopic } from "@/lib/services/topicResearchService";
import { buildId } from "@/lib/utils/common";

interface GeneratedTopicDraft {
  title: string;
  description?: string;
  keywords: string[];
  basis?: string;
}

interface TopicGenerationResult {
  topics: Topic[];
  source: "llm" | "algorithmic";
  usedFallback: boolean;
}

interface TopicDescriptionEnhancement {
  title: string;
  description: string;
  keywords: string[];
  basis: string;
}

interface GeneratedTopicsPayload {
  topics: GeneratedTopicDraft[];
}

interface TopicDescriptionEnhancementsPayload {
  topics: TopicDescriptionEnhancement[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((item) => setB.has(item)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function deduplicateTopics(topics: GeneratedTopicDraft[]): GeneratedTopicDraft[] {
  const deduped: GeneratedTopicDraft[] = [];
  topics.forEach((topic) => {
    const duplicated = deduped.some(
      (existing) => jaccardSimilarity(existing.title, topic.title) > 0.65,
    );
    if (!duplicated) deduped.push(topic);
  });
  return deduped;
}

const termAlias: Record<string, string> = {
  "artificial intelligence": "人工智能",
  "machine learning": "机器学习",
  "deep learning": "深度学习",
  "natural language processing": "自然语言处理",
  "computer vision": "计算机视觉",
  "medical image": "医学影像",
  "clinical decision support": "临床决策支持",
  "precision medicine": "精准医学",
  "covid-19 diagnosis using ai": "AI 辅助传染病诊断",
  "artificial intelligence in healthcare and education": "医疗与教育场景中的人工智能",
};

function localizeTerm(term: string): string {
  const normalized = term.toLowerCase().trim();
  if (termAlias[normalized]) return termAlias[normalized];
  let localized = term;
  Object.entries(termAlias).forEach(([key, value]) => {
    localized = localized.replace(new RegExp(key, "ig"), value);
  });
  const phraseReplacements: Array<[RegExp, string]> = [
    [/topic modeling/gi, "主题建模"],
    [/anomaly detection/gi, "异常检测"],
    [/advanced neural network applications/gi, "先进神经网络应用"],
    [/techniques/gi, "技术"],
    [/applications/gi, "应用"],
    [/in healthcare/gi, "在医疗场景"],
    [/in medicine/gi, "在医学场景"],
    [/\band\b/gi, "与"],
  ];
  phraseReplacements.forEach(([pattern, replacement]) => {
    localized = localized.replace(pattern, replacement);
  });
  return localized.replace(/\s+/g, " ").trim();
}

function buildAlgorithmicTopics(
  theme: string,
  topicCount: number,
  keywords: string[],
  evidence: string[],
): GeneratedTopicDraft[] {
  const uniqueKeywords = Array.from(new Set(keywords)).filter((item) => item.length >= 2);
  const keyPool = uniqueKeywords.length > 0 ? uniqueKeywords : [theme];
  const drafts: GeneratedTopicDraft[] = [];
  const titleStyles = [
    (a: string) => `${a}在“${theme}”中的关键科学问题与方法边界`,
    (a: string, b: string) => `面向“${theme}”的${a}与${b}协同研究`,
    (a: string) => `${a}驱动的“${theme}”数据治理与可解释性评估`,
    (a: string) => `围绕“${theme}”的${a}应用转化与临床/行业验证`,
    (a: string, b: string) => `${a}与${b}在“${theme}”中的跨学科融合路径`,
    (a: string) => `“${theme}”中${a}相关伦理、标准与可信体系建设`,
  ];

  for (let i = 0; i < keyPool.length && drafts.length < topicCount + 8; i += 1) {
    const raw1 = keyPool[i];
    const raw2 = keyPool[(i + 1) % keyPool.length];
    const raw3 = keyPool[(i + 3) % keyPool.length];
    const kw1 = localizeTerm(raw1);
    const kw2 = localizeTerm(raw2);
    const kw3 = localizeTerm(raw3);
    const style = titleStyles[i % titleStyles.length];
    const title = style(kw1, kw2);
    const evidenceLine = evidence.find((line) =>
      [raw1, raw2, raw3].some((kw) =>
        line.toLowerCase().includes(kw.toLowerCase().slice(0, 8)),
      ),
    );
    drafts.push({
      title,
      description: `围绕${kw1}、${kw2}${kw3 ? `及${kw3}` : ""}的关键方法、真实场景验证与交叉融合展开讨论。`,
      keywords: Array.from(new Set([kw1, kw2, kw3])).filter(Boolean),
      basis: evidenceLine || `关键词依据：${[kw1, kw2, kw3].filter(Boolean).join("、")}`,
    });
  }

  return deduplicateTopics(drafts).slice(0, topicCount);
}

function buildFallbackTopic(theme: string, index: number): GeneratedTopicDraft {
  return {
    title: `${theme}相关专题 ${index + 1}`,
    description: "当前公开学术数据不足，建议人工补充具体学科子方向。",
    keywords: [theme],
    basis: "当前仅基于主题关键词进行生成。",
  };
}

function normalizeGeneratedDraft(item: GeneratedTopicDraft): GeneratedTopicDraft {
  return {
    title: item.title.trim(),
    description: item.description?.trim(),
    keywords: (item.keywords || [])
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .slice(0, 6),
    basis: item.basis?.trim(),
  };
}

function isWeakDescription(text?: string): boolean {
  if (!text) return true;
  const normalized = text.trim();
  if (normalized.length < 20) return true;
  return [
    "当前公开学术数据不足",
    "建议人工补充",
    "相关专题",
    "基于主题关键词",
    "研究连续性",
    "学术影响",
  ].some((phrase) => normalized.includes(phrase));
}

function isWeakTitle(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < 8) return true;
  return /相关专题\s*\d+/u.test(normalized);
}

function isHighQualityTopicDraft(draft: GeneratedTopicDraft): boolean {
  if (!draft.title?.trim() || isWeakTitle(draft.title)) return false;
  if (isWeakDescription(draft.description)) return false;
  if (!draft.basis?.trim() || draft.basis.trim().length < 12) return false;
  return (draft.keywords || []).length >= 2;
}

async function generateTopicsByLlm(
  theme: string,
  topicCount: number,
  keywords: string[],
  evidence: string[],
): Promise<GeneratedTopicDraft[]> {
  if (!hasOpenAiApiKey()) return [];

  const prompt = `请根据会议主题生成${topicCount}个高质量中文学术会议议题。
要求：
1) 议题必须和主题高度相关，避免套话；
2) 议题之间要有区分度；
3) title 应像正式分论坛名称，禁止“相关专题”“研究进展”“若干思考”等空泛表述；
4) description 是面向组委会的副标题/说明，25-60字，明确研究对象、方法或应用场景；
5) basis 需要说明该议题来自哪些研究热点或论文线索；
6) 每个议题返回 title、description、keywords(2-6个)、basis；
7) 仅输出 JSON 数组，不要输出其他文字。

会议主题：${theme}
可参考关键词：${keywords.slice(0, 20).join("、")}
可参考近年研究线索：${evidence.slice(0, 6).join("；")}`;

  const parsed = await requestOpenAiStructuredOutput<GeneratedTopicsPayload>({
    model: process.env.TOPIC_LLM_MODEL || "gpt-4.1-mini",
    schemaName: "conference_topics",
    schema: {
      type: "object",
      properties: {
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              keywords: {
                type: "array",
                items: { type: "string" },
              },
              basis: { type: "string" },
            },
            required: ["title", "description", "keywords", "basis"],
            additionalProperties: false,
          },
        },
      },
      required: ["topics"],
      additionalProperties: false,
    },
    prompt,
  });

  return (parsed?.topics || [])
    .map(normalizeGeneratedDraft)
    .filter(isHighQualityTopicDraft);
}

async function enhanceTopicDescriptionsByLlm(
  theme: string,
  topics: GeneratedTopicDraft[],
  evidence: string[],
): Promise<GeneratedTopicDraft[]> {
  if (!hasOpenAiApiKey() || topics.length === 0) return topics;
  if (!topics.some((topic) => isWeakDescription(topic.description))) return topics;

  const prompt = `你是一名学术会议策划顾问，请为以下议题补写高质量中文副标题/说明。
要求：
1) 保留原题目核心含义，不要大幅改题；
2) description 为 25-60 字，明确研究对象、关键方法、应用场景或争议焦点；
3) basis 用一句话概括该议题与近年研究线索的关联；
4) keywords 保留或精炼为 2-6 个；
5) 禁止输出模板句、空话或“建议人工补充”。

会议主题：${theme}
研究线索：${evidence.slice(0, 8).join("；")}
议题列表：${JSON.stringify(
    topics.map((topic) => ({
      title: topic.title,
      description: topic.description || "",
      keywords: topic.keywords || [],
      basis: topic.basis || "",
    })),
  )}`;

  const enhanced = await requestOpenAiStructuredOutput<TopicDescriptionEnhancementsPayload>({
    model: process.env.TOPIC_LLM_MODEL || "gpt-4.1-mini",
    schemaName: "topic_description_enhancements",
    schema: {
      type: "object",
      properties: {
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              keywords: {
                type: "array",
                items: { type: "string" },
              },
              basis: { type: "string" },
            },
            required: ["title", "description", "keywords", "basis"],
            additionalProperties: false,
          },
        },
      },
      required: ["topics"],
      additionalProperties: false,
    },
    prompt,
  });

  if (!enhanced?.topics || enhanced.topics.length === 0) return topics;

  const byTitle = new Map<string, TopicDescriptionEnhancement>(
    enhanced.topics
      .filter((item) => item.title.trim())
      .map((item) => [item.title.trim(), item] as const),
  );

  return topics.map((topic) => {
    const improved = byTitle.get(topic.title.trim());
    if (!improved) return topic;

    const nextDraft = normalizeGeneratedDraft({
      title: topic.title,
      description: improved.description,
      keywords: improved.keywords,
      basis: improved.basis,
    });

    return isHighQualityTopicDraft(nextDraft) ? nextDraft : topic;
  });
}

function finalizeTopicDrafts(drafts: GeneratedTopicDraft[], topicCount: number): Topic[] {
  const deduped = deduplicateTopics(drafts);
  const sliced = deduped.slice(0, topicCount);
  return sliced.map((draft) => ({
    id: buildId("topic"),
    title: draft.title,
    description: draft.description,
    keywords: draft.keywords,
    basis: draft.basis,
  }));
}

export async function generateTopics(
  theme: string,
  topicCount: number,
): Promise<TopicGenerationResult> {
  const research = await researchTopic(theme);
  const llmDrafts = await generateTopicsByLlm(
    theme,
    topicCount,
    research.keywords,
    research.evidence,
  );

  if (llmDrafts.length > 0) {
    const enhancedDrafts = await enhanceTopicDescriptionsByLlm(
      theme,
      llmDrafts,
      research.evidence,
    );
    return {
      topics: finalizeTopicDrafts(enhancedDrafts, topicCount),
      source: "llm",
      usedFallback: research.usedFallback,
    };
  }

  const algorithmicDrafts = buildAlgorithmicTopics(
    theme,
    topicCount,
    research.hotspotDirections,
    research.evidence,
  );
  const polishedAlgorithmicDrafts = await enhanceTopicDescriptionsByLlm(
    theme,
    algorithmicDrafts,
    research.evidence,
  );
  const normalized = finalizeTopicDrafts(polishedAlgorithmicDrafts, topicCount);

  while (normalized.length < topicCount) {
    normalized.push({
      id: buildId("topic"),
      ...buildFallbackTopic(theme, normalized.length),
    });
  }

  return {
    topics: normalized,
    source: "algorithmic",
    usedFallback:
      research.usedFallback ||
      normalized.some((topic) => /相关专题\s*\d+/u.test(topic.title)),
  };
}

export async function regenerateSingleTopic(
  theme: string,
  index: number,
  existingTitles: string[] = [],
): Promise<Topic> {
  const result = await generateTopics(theme, Math.max(6, existingTitles.length + 2));
  const existingSet = new Set(existingTitles.map((title) => title.trim()));
  const candidate = result.topics.find(
    (topic) =>
      !existingSet.has(topic.title) &&
      !existingTitles.some((title) => jaccardSimilarity(title, topic.title) > 0.65),
  );

  if (candidate) return candidate;
  return {
    id: buildId("topic"),
    ...buildFallbackTopic(theme, index),
  };
}
