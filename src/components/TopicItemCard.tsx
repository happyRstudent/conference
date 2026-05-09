import type { Topic } from "@/lib/models/types";

interface Props {
  index: number;
  topic: Topic;
  onTitleChange: (id: string, title: string) => void;
  onRegenerate: (index: number) => void;
  regenerating: boolean;
}

export function TopicItemCard({
  index,
  topic,
  onTitleChange,
  onRegenerate,
  regenerating,
}: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">议题 {index + 1}</h3>
        <button
          type="button"
          onClick={() => onRegenerate(index)}
          disabled={regenerating}
          className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {regenerating ? "生成中..." : "重新生成"}
        </button>
      </div>
      <input
        className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
        value={topic.title}
        onChange={(event) => onTitleChange(topic.id, event.target.value)}
      />
      {topic.description ? <p className="text-xs leading-5 text-slate-500">{topic.description}</p> : null}
      {topic.keywords && topic.keywords.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {topic.keywords.slice(0, 6).map((keyword) => (
            <span
              key={`${topic.id}_${keyword}`}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}
      {topic.basis ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">生成依据：{topic.basis}</p>
      ) : null}
    </div>
  );
}
