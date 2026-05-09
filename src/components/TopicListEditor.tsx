import type { Topic } from "@/lib/models/types";
import { TopicItemCard } from "@/components/TopicItemCard";

interface Props {
  topics: Topic[];
  onTitleChange: (id: string, title: string) => void;
  onRegenerate: (index: number) => void;
  regeneratingIndex: number | null;
}

export function TopicListEditor({
  topics,
  onTitleChange,
  onRegenerate,
  regeneratingIndex,
}: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">请确认并完善议题</h2>
      <div className="space-y-3">
        {topics.map((topic, index) => (
          <TopicItemCard
            key={topic.id}
            topic={topic}
            index={index}
            onTitleChange={onTitleChange}
            onRegenerate={onRegenerate}
            regenerating={regeneratingIndex === index}
          />
        ))}
      </div>
    </section>
  );
}
