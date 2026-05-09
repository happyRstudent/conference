const OPENALEX_BASE_URL = "https://api.openalex.org";

interface OpenAlexConcept {
  display_name?: string;
  score?: number;
  level?: number;
}

interface OpenAlexTopic {
  display_name?: string;
  score?: number;
  field?: { display_name?: string };
}

interface OpenAlexKeyword {
  display_name?: string;
  score?: number;
}

interface OpenAlexWork {
  id?: string;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  concepts?: OpenAlexConcept[];
  topics?: OpenAlexTopic[];
  keywords?: OpenAlexKeyword[];
}

interface OpenAlexWorksResponse {
  results?: OpenAlexWork[];
}

export interface TopicResearchSignal {
  source: "openalex" | "heuristic";
  keywords: string[];
  hotspotDirections: string[];
  evidence: string[];
  usedFallback: boolean;
}

const genericWords = new Set([
  "study",
  "research",
  "analysis",
  "approach",
  "method",
  "review",
  "framework",
  "computer science",
  "physical sciences",
  "social sciences",
  "health sciences",
  "life sciences",
  "engineering",
  "medicine",
  "mathematics",
  "field (mathematics)",
  "point (geometry)",
  "work (physics)",
  "identification (biology)",
  "key (lock)",
  "research direction",
  "future trends",
  "中国",
  "研究",
  "分析",
  "方法",
  "应用",
  "模型",
  "数据",
  "系统",
]);

function normalizeKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function isKeywordUsable(word: string): boolean {
  const cleaned = normalizeKeyword(word).toLowerCase();
  if (!cleaned) return false;
  if (genericWords.has(cleaned)) return false;
  if (cleaned.length < 2) return false;
  if (cleaned.length > 80) return false;
  return true;
}

const topicExpansionMap: Array<{ pattern: RegExp; expansions: string[] }> = [
  {
    pattern: /人工智能|AI|机器学习|深度学习/i,
    expansions: ["artificial intelligence", "machine learning"],
  },
  {
    pattern: /医学|医疗|临床|健康/i,
    expansions: ["medical", "clinical", "healthcare"],
  },
  {
    pattern: /数字经济|数字治理|治理/i,
    expansions: ["digital economy", "digital governance", "public policy"],
  },
  {
    pattern: /新材料|材料|纳米/i,
    expansions: ["advanced materials", "nanomaterials", "materials science"],
  },
  {
    pattern: /能源|碳中和|低碳/i,
    expansions: ["energy transition", "carbon neutrality", "renewable energy"],
  },
];

function buildSearchQueries(theme: string): string[] {
  const expansions = topicExpansionMap
    .filter((item) => item.pattern.test(theme))
    .flatMap((item) => item.expansions);
  const queries = new Set<string>([theme]);
  if (expansions.length > 0) {
    queries.add(`${theme} ${expansions.slice(0, 2).join(" ")}`);
    queries.add(expansions.slice(0, 2).join(" "));
  }
  return Array.from(queries).slice(0, 3);
}

function extractHeuristicKeywords(theme: string): string[] {
  const candidates = Array.from(
    new Set(
      theme
        .replace(/[，。；：、,.!?]/g, " ")
        .split(/\s+/)
        .flatMap((item) => item.split(/[-/]/))
        .map((item) => item.trim())
        .filter((item) => item.length >= 2),
    ),
  );

  if (candidates.length >= 3) {
    return candidates.slice(0, 8);
  }

  const chineseChunks = theme.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  const englishChunks = theme.match(/[A-Za-z][A-Za-z0-9-]{2,}/g) || [];
  return Array.from(new Set([...candidates, ...chineseChunks, ...englishChunks])).slice(0, 8);
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildOpenAlexUrl(query: string): string {
  const nowYear = new Date().getFullYear();
  const fromYear = nowYear - 5;
  const encodedQuery = encodeURIComponent(query);
  const mailto = process.env.OPENALEX_MAILTO;
  const mailtoQuery = mailto ? `&mailto=${encodeURIComponent(mailto)}` : "";
  return `${OPENALEX_BASE_URL}/works?search=${encodedQuery}&filter=from_publication_date:${fromYear}-01-01&sort=cited_by_count:desc&per-page=30${mailtoQuery}`;
}

function aggregateSignals(results: OpenAlexWork[]): TopicResearchSignal {
  const conceptCounter = new Map<string, number>();
  const topicCounter = new Map<string, number>();
  const evidence: string[] = [];

  results.forEach((work) => {
    const title = work.display_name?.trim();
    if (title && evidence.length < 8) {
      evidence.push(`《${title}》(${work.publication_year || "年份未知"})`);
    }
    (work.topics || []).forEach((topic) => {
      const name = topic.display_name?.trim();
      if (!name || !isKeywordUsable(name)) return;
      const prev = topicCounter.get(name) || 0;
      topicCounter.set(name, prev + (topic.score || 0.1));
      const fieldName = topic.field?.display_name?.trim();
      if (fieldName && isKeywordUsable(fieldName)) {
        const fieldPrev = conceptCounter.get(fieldName) || 0;
        conceptCounter.set(fieldName, fieldPrev + 0.08);
      }
    });

    (work.keywords || []).forEach((keyword) => {
      const name = keyword.display_name?.trim();
      if (!name || !isKeywordUsable(name)) return;
      const prev = conceptCounter.get(name) || 0;
      conceptCounter.set(name, prev + (keyword.score || 0.08));
    });

    (work.concepts || []).forEach((concept) => {
      const name = concept.display_name?.trim();
      if (!name || !isKeywordUsable(name)) return;
      if (typeof concept.level === "number" && concept.level === 0) return;
      const prev = conceptCounter.get(name) || 0;
      conceptCounter.set(name, prev + (concept.score || 0.05));
    });
  });

  const sortedTopics = Array.from(topicCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const sortedConcepts = Array.from(conceptCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const keywords = Array.from(new Set([...sortedTopics, ...sortedConcepts])).slice(0, 18);
  const hotspotDirections = sortedTopics.length > 0 ? sortedTopics.slice(0, 10) : sortedConcepts.slice(0, 10);

  return {
    source: "openalex",
    keywords,
    hotspotDirections,
    evidence,
    usedFallback: false,
  };
}

export async function researchTopic(theme: string): Promise<TopicResearchSignal> {
  const queryList = buildSearchQueries(theme);
  try {
    const mergedWorks: OpenAlexWork[] = [];
    for (const query of queryList) {
      const url = buildOpenAlexUrl(query);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
          if (attempt === 1) throw new Error(`OpenAlex works 请求失败: ${response.status}`);
          continue;
        }
        const payload = (await response.json()) as OpenAlexWorksResponse;
        const works = payload.results || [];
        mergedWorks.push(...works);
        break;
      }
    }
    if (mergedWorks.length > 0) {
      const signals = aggregateSignals(mergedWorks);
      if (signals.keywords.length > 0) {
        return signals;
      }
    }
  } catch {
    // use fallback below
  }

  const heuristicKeywords = extractHeuristicKeywords(theme);
  return {
    source: "heuristic",
    keywords: heuristicKeywords,
    hotspotDirections: heuristicKeywords.slice(0, 6),
    evidence: [`主题关键词推断：${heuristicKeywords.join("、") || theme}`],
    usedFallback: true,
  };
}
