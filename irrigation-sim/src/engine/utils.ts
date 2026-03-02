/**
 * A deterministic linear-congruential RNG step.
 */
export function nextRandom(state: number): { value: number; nextState: number } {
  const nextState = (Math.imul(1664525, state >>> 0) + 1013904223) >>> 0;
  return {
    value: nextState / 0x100000000,
    nextState
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Calculates Gini coefficient for a non-negative array.
 */
export function calculateGini(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const nonNegative = values.map((v) => Math.max(0, v));
  const total = nonNegative.reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    return 0;
  }
  const sorted = [...nonNegative].sort((a, b) => a - b);
  let weighted = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    weighted += (i + 1) * sorted[i];
  }
  const n = sorted.length;
  const gini = (2 * weighted) / (n * total) - (n + 1) / n;
  return roundTo(gini, 4);
}

export function toCsv(headers: string[], rows: Array<Record<string, string | number>>): string {
  const escapeCell = (value: string | number): string => {
    const text = String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const csvRows = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? "")).join(","))
  ];
  return `${csvRows.join("\n")}\n`;
}
