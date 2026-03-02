import fs from "node:fs";
import path from "node:path";
import { runSimulation } from "../src/engine/engine";
import presets from "../src/engine/presets.json";
import { roundTo, toCsv } from "../src/engine/utils";

interface RawRow {
  config_id: string;
  profile: string;
  seed: number;
  ai_cooperativeness: number;
  ai_competitiveness: number;
  supply_variance: number;
  student_position: number;
  rainfall_variability: number;
  outcome: string;
  collapsed: number;
  total_yield: number;
  gini_yield: number;
  student_final_wealth: number;
  final_downstream_stress: number;
  final_canal_condition: number;
  final_group_trust: number;
  community_wealth: number;
  n_failures: number;
  drought_events: number;
}

interface SummaryRow {
  config_id: string;
  profile: string;
  ai_cooperativeness: number;
  ai_competitiveness: number;
  supply_variance: number;
  student_position: number;
  rainfall_variability: number;
  runs: number;
  collapse_rate: number;
  total_yield_mean: number;
  total_yield_sd: number;
  gini_mean: number;
  student_wealth_mean: number;
  community_wealth_mean: number;
  downstream_stress_mean: number;
  canal_condition_mean: number;
  trust_mean: number;
}

interface SweepOptions {
  profiles: string[];
  seedsPerConfig: number;
  seedStart: number;
  coopValues: number[];
  compValues: number[];
  varianceValues: number[];
  positionValues: number[];
  rainfallValues: boolean[];
  outDir: string;
}

const DEFAULT_OPTIONS: SweepOptions = {
  profiles: ["balanced_profile"],
  seedsPerConfig: 100,
  seedStart: 1,
  coopValues: [0.2, 0.5, 0.8],
  compValues: [0.2, 0.5, 0.8],
  varianceValues: [10, 20, 30],
  positionValues: [0, 2, 5],
  rainfallValues: [true],
  outDir: "sweep-output"
};

const RAW_HEADERS = [
  "config_id",
  "profile",
  "seed",
  "ai_cooperativeness",
  "ai_competitiveness",
  "supply_variance",
  "student_position",
  "rainfall_variability",
  "outcome",
  "collapsed",
  "total_yield",
  "gini_yield",
  "student_final_wealth",
  "final_downstream_stress",
  "final_canal_condition",
  "final_group_trust",
  "community_wealth",
  "n_failures",
  "drought_events"
];

const SUMMARY_HEADERS = [
  "config_id",
  "profile",
  "ai_cooperativeness",
  "ai_competitiveness",
  "supply_variance",
  "student_position",
  "rainfall_variability",
  "runs",
  "collapse_rate",
  "total_yield_mean",
  "total_yield_sd",
  "gini_mean",
  "student_wealth_mean",
  "community_wealth_mean",
  "downstream_stress_mean",
  "canal_condition_mean",
  "trust_mean"
];

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const presetMap = presets as Record<string, Record<string, unknown>>;
  const rawRows: RawRow[] = [];

  let configCounter = 0;
  for (const profile of options.profiles) {
    const basePreset = presetMap[profile];
    if (!basePreset) {
      throw new Error(`Unknown preset profile: ${profile}`);
    }
    for (const coop of options.coopValues) {
      for (const comp of options.compValues) {
        for (const variance of options.varianceValues) {
          for (const position of options.positionValues) {
            for (const rainfall of options.rainfallValues) {
              configCounter += 1;
              const configId = `cfg_${configCounter.toString().padStart(4, "0")}`;
              for (let i = 0; i < options.seedsPerConfig; i += 1) {
                const seed = options.seedStart + i;
                const preset = {
                  ...basePreset,
                  aiCooperativeness: coop,
                  aiCompetitiveness: comp,
                  supplyVariance: variance,
                  studentPosition: position,
                  rainfallVariabilityEnabled: rainfall
                };

                const run = runSimulation(preset, seed, {
                  runId: `${configId}-seed-${seed}`,
                  scenarioName: `${profile}-${configId}`,
                  studentPosition: position
                });

                const finalState = run.finalState;
                const communityWealth = roundTo(
                  finalState.agents.reduce((sum, agent) => sum + agent.wealth, 0),
                  4
                );

                rawRows.push({
                  config_id: configId,
                  profile,
                  seed,
                  ai_cooperativeness: coop,
                  ai_competitiveness: comp,
                  supply_variance: variance,
                  student_position: position,
                  rainfall_variability: rainfall ? 1 : 0,
                  outcome: finalState.outcome,
                  collapsed: finalState.outcome === "loss" ? 1 : 0,
                  total_yield: run.summary.total_yield,
                  gini_yield: run.summary.gini_yield,
                  student_final_wealth: run.summary.student_final_wealth,
                  final_downstream_stress: finalState.status.downstreamStress,
                  final_canal_condition: finalState.status.canalCondition,
                  final_group_trust: finalState.status.groupTrust,
                  community_wealth: communityWealth,
                  n_failures: run.summary.n_failures,
                  drought_events: run.summary.drought_events
                });
              }
            }
          }
        }
      }
    }
  }

  const summaryRows = summarize(rawRows);
  fs.mkdirSync(options.outDir, { recursive: true });

  const rawCsv = toCsv(
    RAW_HEADERS,
    rawRows.map((row) => asCsvRecord(row))
  );
  const summaryCsv = toCsv(
    SUMMARY_HEADERS,
    summaryRows.map((row) => asCsvRecord(row))
  );

  const rawPath = path.join(options.outDir, "sweep_raw.csv");
  const summaryPath = path.join(options.outDir, "sweep_summary.csv");
  fs.writeFileSync(rawPath, rawCsv, "utf8");
  fs.writeFileSync(summaryPath, summaryCsv, "utf8");

  const topConfigs = [...summaryRows]
    .sort((a, b) => scoreConfig(b) - scoreConfig(a))
    .slice(0, 5);

  console.log(`[sweep] profiles=${options.profiles.join(",")} configs=${summaryRows.length} runs=${rawRows.length}`);
  console.log(`[sweep] wrote ${rawPath}`);
  console.log(`[sweep] wrote ${summaryPath}`);
  console.log("[sweep] top configurations (by weighted score):");
  for (const row of topConfigs) {
    console.log(
      `  ${row.config_id} score=${scoreConfig(row).toFixed(3)} collapse=${row.collapse_rate.toFixed(
        3
      )} community_wealth=${row.community_wealth_mean.toFixed(2)} gini=${row.gini_mean.toFixed(3)}`
    );
  }
}

function summarize(rows: RawRow[]): SummaryRow[] {
  const grouped = new Map<string, RawRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.config_id) ?? [];
    current.push(row);
    grouped.set(row.config_id, current);
  }
  const summaries: SummaryRow[] = [];
  for (const [configId, group] of grouped.entries()) {
    const first = group[0];
    summaries.push({
      config_id: configId,
      profile: first.profile,
      ai_cooperativeness: first.ai_cooperativeness,
      ai_competitiveness: first.ai_competitiveness,
      supply_variance: first.supply_variance,
      student_position: first.student_position,
      rainfall_variability: first.rainfall_variability,
      runs: group.length,
      collapse_rate: roundTo(mean(group.map((row) => row.collapsed)), 4),
      total_yield_mean: roundTo(mean(group.map((row) => row.total_yield)), 4),
      total_yield_sd: roundTo(stdDev(group.map((row) => row.total_yield)), 4),
      gini_mean: roundTo(mean(group.map((row) => row.gini_yield)), 4),
      student_wealth_mean: roundTo(mean(group.map((row) => row.student_final_wealth)), 4),
      community_wealth_mean: roundTo(mean(group.map((row) => row.community_wealth)), 4),
      downstream_stress_mean: roundTo(mean(group.map((row) => row.final_downstream_stress)), 4),
      canal_condition_mean: roundTo(mean(group.map((row) => row.final_canal_condition)), 4),
      trust_mean: roundTo(mean(group.map((row) => row.final_group_trust)), 4)
    });
  }
  return summaries;
}

function scoreConfig(row: SummaryRow): number {
  return (
    row.community_wealth_mean * 0.01 -
    row.collapse_rate * 1.5 -
    row.gini_mean * 0.8 -
    row.downstream_stress_mean * 0.002 +
    row.canal_condition_mean * 0.0015 +
    row.trust_mean * 0.001
  );
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function asCsvRecord<T extends object>(obj: T): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" || typeof value === "number") {
      out[key] = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function parseOptions(argv: string[]): SweepOptions {
  const argMap = new Map<string, string>();
  for (const rawArg of argv) {
    if (!rawArg.startsWith("--")) {
      continue;
    }
    const [key, value] = rawArg.slice(2).split("=");
    if (key && value !== undefined) {
      argMap.set(key, value);
    }
  }

  const profiles = parseStringList(argMap.get("profiles")) ?? DEFAULT_OPTIONS.profiles;
  const seedsPerConfig = parseIntSafe(argMap.get("seeds"), DEFAULT_OPTIONS.seedsPerConfig);
  const seedStart = parseIntSafe(argMap.get("seedStart"), DEFAULT_OPTIONS.seedStart);
  const coopValues = parseNumberList(argMap.get("coop")) ?? DEFAULT_OPTIONS.coopValues;
  const compValues = parseNumberList(argMap.get("comp")) ?? DEFAULT_OPTIONS.compValues;
  const varianceValues = parseNumberList(argMap.get("variance")) ?? DEFAULT_OPTIONS.varianceValues;
  const positionValues = (parseNumberList(argMap.get("position")) ?? DEFAULT_OPTIONS.positionValues).map((v) =>
    Math.max(0, Math.floor(v))
  );
  const rainfallValues = parseBooleanList(argMap.get("rainfall")) ?? DEFAULT_OPTIONS.rainfallValues;
  const outDir = argMap.get("outDir") ?? DEFAULT_OPTIONS.outDir;

  if (seedsPerConfig < 1) {
    throw new Error("--seeds must be >= 1");
  }
  if (profiles.length === 0) {
    throw new Error("At least one profile must be provided.");
  }

  return {
    profiles,
    seedsPerConfig,
    seedStart,
    coopValues,
    compValues,
    varianceValues,
    positionValues,
    rainfallValues,
    outDir
  };
}

function parseStringList(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseNumberList(value: string | undefined): number[] | undefined {
  const parts = parseStringList(value);
  if (!parts) {
    return undefined;
  }
  return parts.map((part) => {
    const parsed = Number(part);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid numeric list value: ${part}`);
    }
    return parsed;
  });
}

function parseBooleanList(value: string | undefined): boolean[] | undefined {
  const parts = parseStringList(value);
  if (!parts) {
    return undefined;
  }
  return parts.map((part) => {
    const normalized = part.toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "t" || normalized === "yes") {
      return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "f" || normalized === "no") {
      return false;
    }
    throw new Error(`Invalid boolean list value: ${part}`);
  });
}

function parseIntSafe(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }
  return parsed;
}

main();
