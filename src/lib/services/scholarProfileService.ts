import type { ScholarRawData } from "@/lib/models/types";

interface OpenAlexWork {
  id?: string;
  display_name?: string;
  publication_year?: number;
}

interface OpenAlexWorksResponse {
  results?: OpenAlexWork[];
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

function isOpenAlexAuthorId(value: string): boolean {
  return value.startsWith("https://openalex.org/A");
}

async function fetchOpenAlexRecentWorks(authorId: string): Promise<string[]> {
  const nowYear = new Date().getFullYear();
  const fromYear = nowYear - 5;
  const encodedAuthorId = encodeURIComponent(authorId);
  const mailto = process.env.OPENALEX_MAILTO;
  const apiKey = process.env.OPENALEX_API_KEY;
  const mailtoQuery = mailto ? `&mailto=${encodeURIComponent(mailto)}` : "";
  const apiKeyQuery = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
  const url = `https://api.openalex.org/works?filter=authorships.author.id:${encodedAuthorId},from_publication_date:${fromYear}-01-01&sort=publication_year:desc&per-page=10${mailtoQuery}${apiKeyQuery}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];
  const payload = (await response.json()) as OpenAlexWorksResponse;
  return (payload.results || [])
    .map((item) => item.display_name?.trim())
    .filter((title): title is string => Boolean(title))
    .slice(0, 6);
}

export async function enrichScholarProfile(scholar: ScholarRawData): Promise<ScholarRawData> {
  if (!isOpenAlexAuthorId(scholar.id)) {
    return scholar;
  }

  try {
    const recentWorks = await fetchOpenAlexRecentWorks(scholar.id);
    if (recentWorks.length === 0) return scholar;
    return {
      ...scholar,
      recentWorkTitles: recentWorks,
    };
  } catch {
    return scholar;
  }
}
