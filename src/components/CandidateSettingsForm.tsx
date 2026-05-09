import type { Scope } from "@/lib/models/types";

interface Props {
  candidateCountPerTopic: number;
  scope: Scope;
  preferYoungScholar: boolean;
  onChange: (value: {
    candidateCountPerTopic: number;
    scope: Scope;
    preferYoungScholar: boolean;
  }) => void;
}

export function CandidateSettingsForm({
  candidateCountPerTopic,
  scope,
  preferYoungScholar,
  onChange,
}: Props) {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">候选人推荐参数</h2>
      <div>
        <label className="mb-2 block text-sm text-slate-700">每个议题候选人数（1-5）</label>
        <input
          type="number"
          min={1}
          max={5}
          value={candidateCountPerTopic}
          onChange={(event) =>
            onChange({
              candidateCountPerTopic: Number(event.target.value),
              scope,
              preferYoungScholar,
            })
          }
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-slate-700">候选人范围</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={scope === "domestic"}
              onChange={() =>
                onChange({ candidateCountPerTopic, scope: "domestic", preferYoungScholar })
              }
            />
            国内
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={scope === "international"}
              onChange={() =>
                onChange({ candidateCountPerTopic, scope: "international", preferYoungScholar })
              }
            />
            国际
          </label>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
        <input
          type="checkbox"
          checked={preferYoungScholar}
          onChange={(event) =>
            onChange({
              candidateCountPerTopic,
              scope,
              preferYoungScholar: event.target.checked,
            })
          }
        />
        <span className="text-sm text-slate-700">在议题匹配度接近时，优先推荐青年教师</span>
      </label>
    </section>
  );
}
