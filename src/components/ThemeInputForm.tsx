"use client";

import { useState } from "react";
import { conferenceInputSchema } from "@/lib/utils/validation";
import { ErrorAlert } from "@/components/ErrorAlert";

interface Props {
  initialTheme: string;
  initialTopicCount: number;
  onSubmit: (theme: string, topicCount: number) => Promise<void> | void;
}

export function ThemeInputForm({ initialTheme, initialTopicCount, onSubmit }: Props) {
  const [theme, setTheme] = useState(initialTheme);
  const [topicCount, setTopicCount] = useState(initialTopicCount);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const parsed = conferenceInputSchema.safeParse({
      conferenceTheme: theme,
      topicCount,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "输入参数不合法。");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(theme.trim(), topicCount);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "生成议题失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">会议大主题</label>
        <input
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
          placeholder="人工智能赋能医学研究"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">议题数量（1-10）</label>
        <input
          value={topicCount}
          onChange={(event) => setTopicCount(Number(event.target.value))}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
          type="number"
          min={1}
          max={10}
        />
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      <button
        disabled={loading}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
        type="submit"
      >
        {loading ? "正在生成议题，请稍候" : "生成议题"}
      </button>
    </form>
  );
}
