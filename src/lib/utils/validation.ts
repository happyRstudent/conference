import { z } from "zod";

export const conferenceInputSchema = z.object({
  conferenceTheme: z.string().trim().min(1, "请输入会议大主题。"),
  topicCount: z
    .number({ error: "议题数量必须为数字。" })
    .int("议题数量必须为整数。")
    .min(1, "议题数量最少为 1。")
    .max(10, "议题数量最多为 10。"),
});

export const regenerateTopicSchema = z.object({
  conferenceTheme: z.string().trim().min(1, "会议主题不能为空。"),
  index: z
    .number({ error: "议题序号不合法。" })
    .int("议题序号不合法。")
    .min(0, "议题序号不合法。"),
  existingTopics: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().trim().min(1),
      }),
    )
    .optional(),
});

export const candidateSettingsSchema = z.object({
  candidateCountPerTopic: z
    .number({ error: "每个议题候选人数必须为数字。" })
    .int("每个议题候选人数必须为整数。")
    .min(1, "每个议题候选人数最少为 1。")
    .max(5, "每个议题候选人数最多为 5。"),
  scope: z.enum(["domestic", "international"], {
    error: "候选人范围仅支持国内或国际。",
  }),
  preferYoungScholar: z.boolean(),
});

export const recommendCandidatesSchema = z.object({
  conferenceTheme: z.string().trim().min(1, "会议主题不能为空。"),
  topics: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1, "议题标题不能为空。"),
        description: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        basis: z.string().optional(),
      }),
    )
    .min(1, "请至少保留一个议题。")
    .max(10, "议题数量不能超过 10。"),
  candidateCountPerTopic: candidateSettingsSchema.shape.candidateCountPerTopic,
  scope: candidateSettingsSchema.shape.scope,
  preferYoungScholar: candidateSettingsSchema.shape.preferYoungScholar,
});
