import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { buildRecommendationReportDocument } from "@/lib/pdf/RecommendationReportDocument";

export const runtime = "nodejs";

const reportSchema = z.object({
  conferenceTheme: z.string().min(1),
  generatedAt: z.string().min(1),
  scope: z.enum(["domestic", "international"]),
  preferYoungScholar: z.boolean(),
  topics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      basis: z.string().optional(),
    }),
  ),
  candidatesByTopic: z.record(
    z.string(),
    z.array(
      z.object({
        id: z.string(),
        externalId: z.string().optional(),
        name: z.string(),
        institution: z.string().optional(),
        region: z.string().optional(),
        researchAreas: z.string().optional(),
        score: z.number(),
        reason: z.string(),
        homepageUrl: z.string().optional(),
        databaseUrl: z.string().optional(),
        detailSummary: z.string().optional(),
        achievements: z.array(z.string()).optional(),
        isYoungScholar: z.boolean().optional(),
        matchedKeywords: z.array(z.string()).optional(),
        scoreBreakdown: z
          .object({
            topicFit: z.number(),
            recency: z.number(),
            impact: z.number(),
            dataConfidence: z.number(),
            youngBonus: z.number(),
            llmAdjustment: z.number(),
          })
          .optional(),
        evidenceSummary: z.array(z.string()).optional(),
        llmReviewNote: z.string().optional(),
        sourceTags: z.array(z.enum(["openalex", "semanticscholar", "orcid", "mock"])),
        dataCompleteness: z.enum(["high", "medium", "low"]),
        missingFields: z.array(z.string()),
        duplicateNote: z.string().optional(),
      }),
    ),
  ),
  warnings: z.array(z.string()),
  sourceSummary: z.object({
    usedMockData: z.boolean(),
    sources: z.array(z.enum(["openalex", "semanticscholar", "orcid", "mock"])),
    note: z.string(),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "PDF 报告参数不完整。" }, { status: 400 });
    }

    const buffer = await renderToBuffer(buildRecommendationReportDocument(parsed.data));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename*=UTF-8''conference-report.pdf",
      },
    });
  } catch (error) {
    console.error("PDF report generation failed:", error);
    return NextResponse.json(
      { error: "PDF 生成失败，请稍后重试。" },
      { status: 500 },
    );
  }
}
