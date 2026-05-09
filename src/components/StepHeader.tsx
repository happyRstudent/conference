const steps = ["生成议题", "确认议题", "推荐候选人"];

export function StepHeader({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((step, index) => {
          const active = index + 1 === currentStep;
          return (
            <div key={step} className="flex items-center gap-2">
              <span
                className={[
                  "rounded px-2 py-1",
                  active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600",
                ].join(" ")}
              >
                {index + 1} {step}
              </span>
              {index !== steps.length - 1 ? <span className="text-slate-400">→</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
