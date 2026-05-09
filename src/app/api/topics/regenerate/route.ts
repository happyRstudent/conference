import { NextResponse } from "next/server";
import { regenerateSingleTopic } from "@/lib/services/topicGenerationService";
import { regenerateTopicSchema } from "@/lib/utils/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = regenerateTopicSchema.safeParse({
      conferenceTheme: body.conferenceTheme,
      index: Number(body.index),
      existingTopics: body.existingTopics,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "参数不合法。" },
        { status: 400 },
      );
    }

    const topic = await regenerateSingleTopic(
      parsed.data.conferenceTheme,
      parsed.data.index,
      (parsed.data.existingTopics || []).map((item) => item.title),
    );
    return NextResponse.json({ topic });
  } catch {
    return NextResponse.json({ error: "重新生成议题失败，请稍后重试。" }, { status: 500 });
  }
}
