export function LoadingState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <div className="mb-2 h-1.5 w-24 animate-pulse rounded bg-slate-300" />
      {text}
    </div>
  );
}
