export type Scope = "domestic" | "international";
export type DataCompleteness = "high" | "medium" | "low";
export type CandidateSource = "openalex" | "semanticscholar" | "orcid" | "mock";

export interface Topic {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  basis?: string;
}

export interface Candidate {
  id: string;
  externalId?: string;
  name: string;
  institution?: string;
  region?: string;
  researchAreas?: string;
  score: number;
  reason: string;
  homepageUrl?: string;
  databaseUrl?: string;
  detailSummary?: string;
  achievements?: string[];
  isYoungScholar?: boolean;
  matchedKeywords?: string[];
  sourceTags: CandidateSource[];
  dataCompleteness: DataCompleteness;
  missingFields: string[];
  duplicateNote?: string;
}

export interface RecommendationResult {
  conferenceTheme: string;
  generatedAt: string;
  topics: Topic[];
  candidatesByTopic: Record<string, Candidate[]>;
  scope: Scope;
  preferYoungScholar: boolean;
  warnings: string[];
  sourceSummary: {
    usedMockData: boolean;
    sources: CandidateSource[];
    note: string;
  };
}

export interface CandidateSettings {
  candidateCountPerTopic: number;
  scope: Scope;
  preferYoungScholar: boolean;
}

export interface ScholarRawData {
  id: string;
  displayName: string;
  institution?: string;
  countryCode?: string;
  worksCount?: number;
  citedByCount?: number;
  hIndex?: number;
  homepageUrl?: string;
  databaseUrl?: string;
  concepts?: string[];
  recentWorkTitles?: string[];
  source: CandidateSource;
  orcid?: string;
}
