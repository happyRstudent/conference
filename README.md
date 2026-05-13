# conference-mvp

本项目是一个可本地部署的学术会议策划 MVP 网站，用于：

- 根据会议大主题生成分论坛议题
- 为每个议题推荐候选演讲人
- 导出推荐结果 PDF

## 运行方式

在当前目录执行：

```bash
npm install
cp example.env .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

也可以使用：

```bash
cp .env.example .env.local
```

## 推荐环境变量

如果希望启用高质量 AI 生成与候选人复核，请在 `.env.local` 中填写：

```env
OPENALEX_MAILTO=your-email@example.com
OPENALEX_API_KEY=
OPENAI_API_KEY=
TOPIC_LLM_MODEL=gpt-5.4-mini
CANDIDATE_LLM_MODEL=gpt-5.4-mini
```

说明：

- 不填写 `OPENAI_API_KEY` 也能运行，但会退回非 AI 生成链路。
- `OPENALEX_MAILTO` 建议填写，以提升学术检索稳定性。
- `OPENALEX_API_KEY` 可选；如果需要更稳定的高频 OpenAlex 请求，可以申请免费 key 后填写。

## 生产构建

```bash
npm run build
npm run start
```

## 部署提示

- 推荐 Node.js 20 或更高版本。
- 首次部署时，先复制环境变量模板：

```bash
cp example.env .env.local
```

- 然后按需填写：
  - `OPENALEX_MAILTO`
  - `OPENAI_API_KEY`
  - `TOPIC_LLM_MODEL`
  - `CANDIDATE_LLM_MODEL`
- 不填写 `OPENAI_API_KEY` 也可以运行，但会退回非 AI 生成链路。
