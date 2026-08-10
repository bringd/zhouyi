const LABELS = ["第一灵数", "第二灵数", "第三灵数"] as const;

export function buildNumberError(
  numbers: [number | null, number | null, number | null],
): string | null {
  const missing: string[] = [];
  numbers.forEach((n, i) => {
    if (n === null || n < 100 || n > 999) missing.push(LABELS[i]);
  });
  if (missing.length === 0) return null;
  if (missing.length === 3) return "请填写三个灵数（可手动输入或随机生成）";
  return `请填写：${missing.join("、")}`;
}
