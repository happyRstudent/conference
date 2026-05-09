import { NextResponse } from "next/server";
import { recommendCandidatesByTopics } from "@/lib/services/candidateRecommendationService";
import { recommendCandidatesSchema } from "@/lib/utils/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = recommendCandidatesSchema.safeParse({
      conferenceTheme: body.conferenceTheme,
      topics: body.topics,
      candidateCountPerTopic: Number(body.candidateCountPerTopic),
      scope: body.scope,
      preferYoungScholar: Boolean(body.preferYoungScholar),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "参数不合法。" },
        { status: 400 },
      );
    }

    const result = await recommendCandidatesByTopics(parsed.data);
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json(
      { error: "正在检索候选人时发生错误，请稍后重试。" },
      { status: 500 },
    );
  }
}
