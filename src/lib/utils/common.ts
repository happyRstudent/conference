export const scopeLabelMap = {
  domestic: "国内",
  international: "国际",
} as const;

export function buildId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function toReadableDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function safeUrl(value?: string): string {
  if (!value) return "-";
  return value;
}
