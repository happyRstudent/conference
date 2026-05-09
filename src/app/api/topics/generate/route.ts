import { NextResponse } from "next/server";
import { generateTopics } from "@/lib/services/topicGenerationService";
import { conferenceInputSchema } from "@/lib/utils/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = conferenceInputSchema.safeParse({
      conferenceTheme: body.conferenceTheme,
      topicCount: Number(body.topicCount),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "参数不合法。" },
        { status: 400 },
      );
    }

    const generated = await generateTopics(
      parsed.data.conferenceTheme,
      parsed.data.topicCount,
    );
    return NextResponse.json(generated);
  } catch {
    return NextResponse.json({ error: "生成议题失败，请稍后重试。" }, { status: 500 });
  }
}
