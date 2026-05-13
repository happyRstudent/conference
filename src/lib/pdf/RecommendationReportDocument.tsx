import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { RecommendationResult } from "@/lib/models/types";
import { scopeLabelMap, toReadableDate } from "@/lib/utils/common";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    color: "#0f172a",
    lineHeight: 1.55,
  },
  title: {
    fontSize: 18,
    marginBottom: 12,
    fontWeight: 700,
  },
  metaBlock: {
    border: "1 solid #cbd5e1",
    padding: 10,
    marginBottom: 16,
    backgroundColor: "#f8fafc",
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
    fontWeight: 700,
  },
  topicCard: {
    border: "1 solid #dbe2ea",
    padding: 10,
    marginBottom: 10,
  },
  candidateCard: {
    borderTop: "1 solid #e2e8f0",
    marginTop: 8,
    paddingTop: 8,
  },
  text: {
    marginBottom: 4,
  },
  link: {
    color: "#1d4ed8",
    textDecoration: "none",
    marginBottom: 3,
  },
});

export function buildRecommendationReportDocument(
  result: RecommendationResult,
): ReactElement<DocumentProps> {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>学术会议议题与演讲候选人推荐报告</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.text}>会议主题：{result.conferenceTheme}</Text>
          <Text style={styles.text}>生成时间：{toReadableDate(result.generatedAt)}</Text>
          <Text style={styles.text}>候选人范围：{scopeLabelMap[result.scope]}</Text>
          <Text style={styles.text}>
            青年教师优先：{result.preferYoungScholar ? "是" : "否"}
          </Text>
          <Text style={styles.text}>
            数据来源：{result.sourceSummary.sources.join(" / ") || "暂未标注"}
          </Text>
          <Text style={styles.text}>来源说明：{result.sourceSummary.note}</Text>
        </View>

        <Text style={styles.sectionTitle}>议题与候选人推荐结果</Text>
        {result.topics.map((topic, index) => {
          const candidates = result.candidatesByTopic[topic.id] || [];
          return (
            <View key={topic.id} style={styles.topicCard}>
              <Text style={styles.text}>
                议题 {index + 1}：{topic.title}
              </Text>
              {topic.description ? (
                <Text style={styles.text}>议题说明：{topic.description}</Text>
              ) : null}
              {topic.keywords?.length ? (
                <Text style={styles.text}>议题关键词：{topic.keywords.join("、")}</Text>
              ) : null}
              {topic.basis ? <Text style={styles.text}>生成依据：{topic.basis}</Text> : null}
              {candidates.map((candidate) => (
                <View key={candidate.id} style={styles.candidateCard}>
                  <Text style={styles.text}>
                    {candidate.name}｜{candidate.institution || "暂未获取"}｜
                    {candidate.region || "暂未获取"}
                  </Text>
                  <Text style={styles.text}>研究方向：{candidate.researchAreas || "暂未获取"}</Text>
                  <Text style={styles.text}>综合评分：{candidate.score}</Text>
                  {candidate.scoreBreakdown ? (
                    <Text style={styles.text}>
                      评分拆解：主题贴合 {candidate.scoreBreakdown.topicFit}/40；近期活跃{" "}
                      {candidate.scoreBreakdown.recency}/20；学术影响{" "}
                      {candidate.scoreBreakdown.impact}/20；数据可信{" "}
                      {candidate.scoreBreakdown.dataConfidence}/10；青年优先{" "}
                      {candidate.scoreBreakdown.youngBonus}/5；LLM 复核{" "}
                      {candidate.scoreBreakdown.llmAdjustment > 0 ? "+" : ""}
                      {candidate.scoreBreakdown.llmAdjustment}
                    </Text>
                  ) : null}
                  <Text style={styles.text}>推荐理由：{candidate.reason}</Text>
                  {candidate.llmReviewNote ? (
                    <Text style={styles.text}>LLM 复核说明：{candidate.llmReviewNote}</Text>
                  ) : null}
                  {candidate.evidenceSummary?.length ? (
                    <Text style={styles.text}>
                      评分证据：{candidate.evidenceSummary.join("；")}
                    </Text>
                  ) : null}
                  <Text style={styles.text}>
                    数据完整度：
                    {candidate.dataCompleteness === "high"
                      ? "数据较完整"
                      : candidate.dataCompleteness === "medium"
                        ? "部分字段缺失"
                        : "仅检索到基础公开信息"}
                  </Text>
                  {candidate.homepageUrl ? (
                    <Link style={styles.link} src={candidate.homepageUrl}>
                      学者主页：{candidate.homepageUrl}
                    </Link>
                  ) : (
                    <Text style={styles.text}>学者主页：暂未获取</Text>
                  )}
                  {candidate.databaseUrl ? (
                    <Link style={styles.link} src={candidate.databaseUrl}>
                      学术数据库：{candidate.databaseUrl}
                    </Link>
                  ) : (
                    <Text style={styles.text}>学术数据库：暂未获取</Text>
                  )}
                </View>
              ))}
            </View>
          );
        })}
        {result.warnings.length > 0 ? (
          <View style={styles.topicCard}>
            <Text style={styles.text}>检索提示：</Text>
            {result.warnings.map((warning) => (
              <Text key={warning} style={styles.text}>
                - {warning}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
