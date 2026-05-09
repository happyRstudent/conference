# conference-mvp

本项目是一个可本地部署的学术会议策划 MVP 网站，用于：

- 根据会议大主题生成分论坛议题
- 为每个议题推荐候选演讲人
- 导出推荐结果 PDF

## 运行方式

在当前目录执行：

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 推荐环境变量

如果希望启用高质量 AI 生成与候选人复核，请在 `.env.local` 中填写：

```env
OPENALEX_MAILTO=your-email@example.com
OPENAI_API_KEY=
TOPIC_LLM_MODEL=gpt-5.4-mini
CANDIDATE_LLM_MODEL=gpt-5.4-mini
```

说明：

- 不填写 `OPENAI_API_KEY` 也能运行，但会退回非 AI 生成链路。
- `OPENALEX_MAILTO` 建议填写，以提升学术检索稳定性。

## 生产构建

```bash
npm run build
npm run start
```
