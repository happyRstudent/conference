import assert from "node:assert/strict";
import test from "node:test";
import type { ScholarRawData } from "../models/types.ts";

const servicePath = "./scholarSearchService.ts";
type ScholarSearchModule = {
  mergeScholarsByIdentity: (
    openAlexScholars: ScholarRawData[],
    semanticScholars: ScholarRawData[],
  ) => ScholarRawData[];
};

test("merges scholars by OpenAlex id before falling back to name and institution", async () => {
  const { mergeScholarsByIdentity } = (await import(servicePath)) as ScholarSearchModule;
  const openAlex: ScholarRawData[] = [
    {
      id: "https://openalex.org/A1",
      displayName: "Alex Chen",
      institution: "University A",
      databaseUrl: "https://openalex.org/A1",
      source: "openalex",
      topicNames: ["Medical Imaging"],
      recentRelevantWorks: [{ title: "Medical imaging AI", publicationYear: 2026 }],
    },
    {
      id: "https://openalex.org/A2",
      displayName: "Alex Chen",
      institution: "University B",
      databaseUrl: "https://openalex.org/A2",
      source: "openalex",
      topicNames: ["Digital Governance"],
    },
  ];
  const semantic: ScholarRawData[] = [
    {
      id: "https://www.semanticscholar.org/author/123",
      displayName: "Alex Chen",
      institution: "University A",
      homepageUrl: "https://example.edu/alex",
      source: "semanticscholar",
      worksCount: 22,
    },
  ];

  const merged = mergeScholarsByIdentity(openAlex, semantic);

  assert.equal(merged.length, 2);
  const universityA = merged.find((scholar) => scholar.institution === "University A");
  const universityB = merged.find((scholar) => scholar.institution === "University B");
  assert.equal(universityA?.homepageUrl, "https://example.edu/alex");
  assert.equal(universityA?.recentRelevantWorks?.length, 1);
  assert.equal(universityB?.id, "https://openalex.org/A2");
});
