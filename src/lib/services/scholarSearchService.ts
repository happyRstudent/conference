import type { CandidateSource, Scope, ScholarRawData } from "@/lib/models/types";

const OPENALEX_BASE_URL = "https://api.openalex.org";
const SEMANTIC_SCHOLAR_BASE_URL = "https://api.semanticscholar.org/graph/v1";
const queryExpansionMap: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /人工智能|AI|机器学习|深度学习/gi, replacement: "artificial intelligence machine learning" },
  { pattern: /医学|医疗|临床|健康/gi, replacement: "medical clinical healthcare" },
  { pattern: /自然语言处理/gi, replacement: "natural language processing" },
  { pattern: /主题建模/gi, replacement: "topic modeling" },
  { pattern: /计算机视觉|医学影像/gi, replacement: "computer vision medical imaging" },
  { pattern: /新材料|材料/gi, replacement: "advanced materials" },
  { pattern: /数字经济|治理/gi, replacement: "digital governance" },
];

interface OpenAlexAuthor {
  id?: string;
  display_name?: string;
  orcid?: string;
  works_count?: number;
  cited_by_count?: number;
  summary_stats?: { h_index?: number };
  last_known_institutions?: Array<{
    display_name?: string;
    country_code?: string;
  }>;
  x_concepts?: Array<{ display_name?: string }>;
  concepts?: Array<{ display_name?: string }>;
  topics?: Array<{ id?: string; display_name?: string }>;
}

interface OpenAlexAuthorResponse {
  results?: OpenAlexAuthor[];
}

interface OpenAlexWorkAuthor {
  id?: string;
  display_name?: string;
  orcid?: string;
}

interface OpenAlexWorkInstitution {
  display_name?: string;
  country_code?: string;
}

interface OpenAlexWorkAuthorship {
  author?: OpenAlexWorkAuthor;
  institutions?: OpenAlexWorkInstitution[];
}

interface OpenAlexWorkResult {
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  authorships?: OpenAlexWorkAuthorship[];
  primary_topic?: { id?: string; display_name?: string };
  topics?: Array<{ id?: string; display_name?: string }>;
  concepts?: Array<{ display_name?: string }>;
}

interface OpenAlexWorkSearchResponse {
  results?: OpenAlexWorkResult[];
}

interface SemanticScholarPaperAuthor {
  authorId?: string;
  name?: string;
  affiliations?: string[];
  url?: string;
}

interface SemanticScholarPaper {
  title?: string;
  year?: number;
  authors?: SemanticScholarPaperAuthor[];
}

interface SemanticScholarPaperSearchResponse {
  data?: SemanticScholarPaper[];
}

export interface ScholarSearchResult {
  scholars: ScholarRawData[];
  usedMockData: boolean;
  sources: CandidateSource[];
  warnings: string[];
}

const mockScholars: ScholarRawData[] = [
  {
    id: "mock_demo_1",
    displayName: "示例学者（演示数据）",
    institution: "暂未获取",
    source: "mock",
    databaseUrl: "",
    concepts: ["示例数据"],
  },
];

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function matchesScope(countryCode: string | undefined, scope: Scope): boolean {
  if (scope === "domestic") {
    return countryCode === "CN";
  }
  return countryCode !== "CN";
}

function buildQueryVariants(topicQuery: string): string[] {
  const variants = new Set<string>([topicQuery]);
  let translated = topicQuery;
  queryExpansionMap.forEach(({ pattern, replacement }) => {
    translated = translated.replace(pattern, replacement);
  });
  translated = translated.replace(/\s+/g, " ").trim();
  if (translated && translated !== topicQuery) {
    variants.add(translated);
  }
  const englishOnly = translated
    .replace(/[\u4e00-\u9fa5“”‘’（）【】《》]/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (englishOnly.split(" ").filter(Boolean).length >= 2) {
    variants.add(englishOnly);
  }
  const englishHints = [
    "artificial intelligence",
    "machine learning",
    "medical",
    "governance",
    "materials",
  ];
  const hasChinese = /[\u4e00-\u9fa5]/.test(topicQuery);
  if (hasChinese && !englishHints.some((item) => translated.toLowerCase().includes(item))) {
    variants.add(`${translated} artificial intelligence research`);
  }
  if (hasChinese) {
    variants.add("artificial intelligence medical");
  }
  return Array.from(variants)
    .sort((a, b) => {
      const chineseCountA = (a.match(/[\u4e00-\u9fa5]/g) || []).length;
      const chineseCountB = (b.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (chineseCountA !== chineseCountB) return chineseCountA - chineseCountB;
      return a.length - b.length;
    })
    .slice(0, 3);
}

function normalizeOpenAlexAuthor(item: OpenAlexAuthor): ScholarRawData | null {
  const name = item.display_name?.trim();
  const id = item.id?.trim();
  if (!name || !id) return null;
  const inst = item.last_known_institutions?.[0];
  const concepts = (item.x_concepts || item.concepts || [])
    .map((concept) => concept.display_name?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);
  const topicNames = (item.topics || [])
    .map((topic) => topic.display_name?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);
  const topicIds = (item.topics || [])
    .map((topic) => topic.id?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);
  const orcidId = item.orcid?.trim();
  const normalizedOrcid = orcidId
    ? `https://orcid.org/${orcidId.split("/").pop()}`
    : undefined;

  return {
    id,
    displayName: name,
    institution: inst?.display_name || undefined,
    countryCode: inst?.country_code || undefined,
    worksCount: item.works_count ?? undefined,
    citedByCount: item.cited_by_count ?? undefined,
    hIndex: item.summary_stats?.h_index ?? undefined,
    homepageUrl: normalizedOrcid,
    databaseUrl: id,
    concepts,
    topicNames,
    topicIds,
    source: "openalex",
    orcid: normalizedOrcid,
  };
}

function mergeUnique<T>(first?: T[], second?: T[]): T[] | undefined {
  const merged = Array.from(new Set([...(first || []), ...(second || [])]));
  return merged.length > 0 ? merged : undefined;
}

function mergeScholarData(existing: ScholarRawData, incoming: ScholarRawData): ScholarRawData {
  return {
    ...existing,
    institution: existing.institution || incoming.institution,
    countryCode: existing.countryCode || incoming.countryCode,
    homepageUrl: existing.homepageUrl || incoming.homepageUrl,
    databaseUrl: existing.databaseUrl || incoming.databaseUrl,
    concepts: mergeUnique(existing.concepts, incoming.concepts),
    topicNames: mergeUnique(existing.topicNames, incoming.topicNames),
    topicIds: mergeUnique(existing.topicIds, incoming.topicIds),
    recentWorkTitles: mergeUnique(existing.recentWorkTitles, incoming.recentWorkTitles),
    recentRelevantWorks: mergeUnique(existing.recentRelevantWorks, incoming.recentRelevantWorks),
    worksCount: existing.worksCount ?? incoming.worksCount,
    citedByCount: existing.citedByCount ?? incoming.citedByCount,
    hIndex: existing.hIndex ?? incoming.hIndex,
    orcid: existing.orcid || incoming.orcid,
    source: existing.source === "openalex" ? "openalex" : incoming.source,
  };
}

function addOrMergeScholar(target: Map<string, ScholarRawData>, scholar: ScholarRawData): void {
  const existing = target.get(scholar.id);
  target.set(scholar.id, existing ? mergeScholarData(existing, scholar) : scholar);
}

async function searchOpenAlex(
  topicQuery: string,
  scope: Scope,
  limit: number,
): Promise<ScholarRawData[]> {
  const mailto = process.env.OPENALEX_MAILTO;
  const apiKey = process.env.OPENALEX_API_KEY;
  const mailtoQuery = mailto ? `&mailto=${encodeURIComponent(mailto)}` : "";
  const apiKeyQuery = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
  const openAlexQuerySuffix = `${mailtoQuery}${apiKeyQuery}`;
  const merged = new Map<string, ScholarRawData>();
  const scopeFilter =
    scope === "domestic"
      ? "last_known_institutions.country_code:CN"
      : "last_known_institutions.country_code:!CN";

  for (const variant of buildQueryVariants(topicQuery)) {
    const encoded = encodeURIComponent(variant);
    const workUrl = `${OPENALEX_BASE_URL}/works?search=${encoded}&filter=from_publication_date:${new Date().getFullYear() - 5}-01-01&per-page=${Math.min(
      50,
      Math.max(25, limit * 4),
    )}${openAlexQuerySuffix}`;
    const workResponse = await fetchWithTimeout(workUrl, {
      headers: { Accept: "application/json" },
    });
    if (workResponse.ok) {
      const worksPayload = (await workResponse.json()) as OpenAlexWorkSearchResponse;
      (worksPayload.results || []).forEach((work) => {
        const topicNames = [
          work.primary_topic?.display_name,
          ...(work.topics || []).map((topic) => topic.display_name),
        ]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
          .slice(0, 6);
        const topicIds = [
          work.primary_topic?.id,
          ...(work.topics || []).map((topic) => topic.id),
        ]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
          .slice(0, 6);
        const concepts = (work.concepts || [])
          .map((item) => item.display_name)
          .filter((value): value is string => Boolean(value))
          .slice(0, 6);
        (work.authorships || []).forEach((authorship) => {
          const authorId = authorship.author?.id;
          const authorName = authorship.author?.display_name;
          if (!authorId || !authorName) return;
          const institution = authorship.institutions?.[0];
          const countryCode = institution?.country_code;
          if (!matchesScope(countryCode, scope)) return;
          const orcid = authorship.author?.orcid
            ? `https://orcid.org/${authorship.author.orcid.split("/").pop()}`
            : undefined;
          addOrMergeScholar(merged, {
            id: authorId,
            displayName: authorName,
            institution: institution?.display_name,
            countryCode,
            homepageUrl: orcid,
            databaseUrl: authorId,
            concepts,
            topicNames,
            topicIds,
            recentWorkTitles: work.display_name ? [work.display_name] : undefined,
            recentRelevantWorks: work.display_name
              ? [
                  {
                    title: work.display_name,
                    publicationYear: work.publication_year,
                    citedByCount: work.cited_by_count,
                    topicNames,
                    topicIds,
                  },
                ]
              : undefined,
            source: "openalex",
            orcid,
          });
        });
      });
    }

    const authorUrl = `${OPENALEX_BASE_URL}/authors?search=${encoded}&filter=${scopeFilter}&sort=works_count:desc&per-page=${Math.min(
      50,
      Math.max(20, limit * 4),
    )}${openAlexQuerySuffix}`;
    const response = await fetchWithTimeout(authorUrl, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      continue;
    }
    const payload = (await response.json()) as OpenAlexAuthorResponse;
    (payload.results || [])
      .map(normalizeOpenAlexAuthor)
      .filter((item): item is ScholarRawData => Boolean(item))
      .filter((item) => matchesScope(item.countryCode, scope))
      .forEach((item) => addOrMergeScholar(merged, item));

    if (merged.size < limit * 2) {
      const workUrl = `${OPENALEX_BASE_URL}/works?search=${encoded}&filter=from_publication_date:${new Date().getFullYear() - 5}-01-01&sort=cited_by_count:desc&per-page=25${openAlexQuerySuffix}`;
      const workResponse = await fetchWithTimeout(workUrl, {
        headers: { Accept: "application/json" },
      });
      if (workResponse.ok) {
        const worksPayload = (await workResponse.json()) as OpenAlexWorkSearchResponse;
        (worksPayload.results || []).forEach((work) => {
          const concepts = (work.concepts || [])
            .map((item) => item.display_name)
            .filter((value): value is string => Boolean(value))
            .slice(0, 6);
          (work.authorships || []).forEach((authorship) => {
            const authorId = authorship.author?.id;
            const authorName = authorship.author?.display_name;
            if (!authorId || !authorName) return;
            const institution = authorship.institutions?.[0];
            const countryCode = institution?.country_code;
            if (!matchesScope(countryCode, scope)) return;
            if (merged.has(authorId)) return;
            const orcid = authorship.author?.orcid
              ? `https://orcid.org/${authorship.author.orcid.split("/").pop()}`
              : undefined;
            addOrMergeScholar(merged, {
              id: authorId,
              displayName: authorName,
              institution: institution?.display_name,
              countryCode,
              homepageUrl: orcid,
              databaseUrl: authorId,
              concepts,
              source: "openalex",
            });
          });
        });
      }
    }

    if (merged.size >= limit * 3) break;
  }

  if (merged.size === 0) {
    throw new Error("OpenAlex 检索为空。");
  }
  return Array.from(merged.values());
}

function normalizeSemanticAuthor(author: SemanticScholarPaperAuthor): ScholarRawData | null {
  const name = author.name?.trim();
  if (!name || !author.authorId) return null;
  return {
    id: `https://www.semanticscholar.org/author/${author.authorId}`,
    displayName: name,
    institution: author.affiliations?.[0],
    databaseUrl: `https://www.semanticscholar.org/author/${author.authorId}`,
    homepageUrl: author.url || undefined,
    source: "semanticscholar",
  };
}

async function searchSemanticScholar(
  topicQuery: string,
  limit: number,
): Promise<ScholarRawData[]> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (!apiKey) return [];

  const output = new Map<string, ScholarRawData>();
  const fields = encodeURIComponent("title,year,authors.name,authors.authorId,authors.affiliations,authors.url");

  for (const variant of buildQueryVariants(topicQuery)) {
    const query = encodeURIComponent(variant);
    const url = `${SEMANTIC_SCHOLAR_BASE_URL}/paper/search?query=${query}&limit=${Math.min(
      20,
      Math.max(8, limit * 2),
    )}&fields=${fields}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as SemanticScholarPaperSearchResponse;
    (payload.data || []).forEach((paper) => {
      (paper.authors || []).forEach((author) => {
        const normalized = normalizeSemanticAuthor(author);
        if (!normalized) return;
        if (!output.has(normalized.id)) {
          output.set(normalized.id, normalized);
        }
      });
    });
    if (output.size >= limit * 2) break;
  }
  return Array.from(output.values());
}

export function mergeScholarsByIdentity(
  openAlexScholars: ScholarRawData[],
  semanticScholars: ScholarRawData[],
): ScholarRawData[] {
  const byName = new Map<string, ScholarRawData>();
  [...openAlexScholars, ...semanticScholars].forEach((scholar) => {
    const key = scholar.id.startsWith("https://openalex.org/")
      ? scholar.id
      : `${scholar.displayName.trim().toLowerCase()}::${scholar.institution || ""}`;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, scholar);
      return;
    }
    byName.set(key, mergeScholarData(existing, scholar));
  });
  const output = new Map<string, ScholarRawData>();
  byName.forEach((scholar) => {
    const key = `${scholar.displayName.trim().toLowerCase()}::${scholar.institution || ""}`;
    const existing = output.get(key);
    output.set(key, existing ? mergeScholarData(existing, scholar) : scholar);
  });
  return Array.from(output.values());
}

function shouldEnableMockFallback(): boolean {
  return process.env.ENABLE_MOCK_FALLBACK === "true";
}

function shouldUseOpenAlexOnly(): boolean {
  const provider = (process.env.SCHOLAR_SEARCH_PROVIDER || "openalex").toLowerCase();
  return provider !== "hybrid";
}

export async function searchScholarsByTopic(
  topicQuery: string,
  scope: Scope,
  limit: number,
): Promise<ScholarSearchResult> {
  const warnings: string[] = [];
  const sources: CandidateSource[] = [];
  const openAlexOnly = shouldUseOpenAlexOnly();

  try {
    const openAlex = await searchOpenAlex(topicQuery, scope, limit);
    let semantic: ScholarRawData[] = [];

    if (!openAlexOnly) {
      try {
        semantic = await searchSemanticScholar(topicQuery, limit);
      } catch (semanticError) {
        warnings.push(
          semanticError instanceof Error ? semanticError.message : "Semantic Scholar 检索失败。",
        );
      }
    }

    if (openAlex.length > 0) sources.push("openalex");
    if (semantic.length > 0) sources.push("semanticscholar");

    const merged = mergeScholarsByIdentity(openAlex, semantic);
    if (merged.length > 0) {
      return {
        scholars: merged,
        usedMockData: false,
        sources,
        warnings,
      };
    }

    warnings.push("公开学术数据检索结果为空。");
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "学者检索失败。");
  }

  if (shouldEnableMockFallback()) {
    warnings.push("当前结果部分基于示例数据，仅供演示。");
    return {
      scholars: mockScholars,
      usedMockData: true,
      sources: ["mock"],
      warnings,
    };
  }

  return {
    scholars: [],
    usedMockData: false,
    sources,
    warnings,
  };
}
