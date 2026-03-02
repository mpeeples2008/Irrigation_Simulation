import canonicalSpecJson from "../../spec/spec.json";
import {
  AgentDecision,
  AgentState,
  CanonicalSpec,
  MaintenanceChoice,
  PlayerDecision,
  RunOptions,
  RunResult,
  RunSummaryRecord,
  SeasonRecord,
  SeasonResult,
  SimulationPreset,
  SimulationState,
  StrategyName,
  TopologyType,
  WithdrawalChoice
} from "./types";
import { calculateGini, clamp, nextRandom, roundTo, toCsv } from "./utils";

const canonicalSpec = canonicalSpecJson as CanonicalSpec;

export const AGENT_SEASON_COLUMNS = [...canonicalSpec.outputs.csv_schema.agent_season];
export const RUN_SUMMARY_COLUMNS = [...canonicalSpec.outputs.csv_schema.run_summary];

const DEFAULT_PLAYER_DECISION: PlayerDecision = {
  withdrawalChoice: "medium",
  maintenanceChoice: "contribute"
};

/**
 * Builds a normalized simulation preset from canonical spec defaults and runtime overrides.
 */
export function normalizePreset(presetInput: object = {}): SimulationPreset {
  const base = buildDefaultPreset(canonicalSpec);
  const input = presetInput as Record<string, unknown>;
  const fullPresetCandidate = input as Partial<SimulationPreset>;
  const snakeCase = input as Record<string, unknown>;
  const nested = input as {
    mechanics?: Record<string, unknown>;
    simulation?: Record<string, unknown>;
    canal?: Record<string, unknown>;
  };

  const withdrawalChoices = {
    low: pickNumber(
      fullPresetCandidate.withdrawalChoices?.low,
      (snakeCase.withdrawals as Record<string, number> | undefined)?.low,
      base.withdrawalChoices.low
    ),
    medium: pickNumber(
      fullPresetCandidate.withdrawalChoices?.medium,
      (snakeCase.withdrawals as Record<string, number> | undefined)?.medium,
      base.withdrawalChoices.medium
    ),
    high: pickNumber(
      fullPresetCandidate.withdrawalChoices?.high,
      (snakeCase.withdrawals as Record<string, number> | undefined)?.high,
      base.withdrawalChoices.high
    )
  };

  const nAgents = Math.max(
    3,
    Math.floor(
      pickNumber(
        fullPresetCandidate.nAgents,
        (snakeCase.n_agents as number | undefined) ?? undefined,
        base.nAgents
      )
    )
  );
  const strategyMix = normalizeStrategyMix(
    fullPresetCandidate.strategyMix ??
      ((snakeCase.strategy_mix as StrategyName[] | undefined) ?? undefined),
    nAgents - 1,
    base.strategyMix
  );

  return {
    scenario: pickString(fullPresetCandidate.scenario, snakeCase.scenario, base.scenario),
    seasonsPerRun: pickNumber(
      fullPresetCandidate.seasonsPerRun,
      (nested.simulation as Record<string, number> | undefined)?.seasons_per_run,
      base.seasonsPerRun
    ),
    nAgents,
    topology: normalizeTopology(
      fullPresetCandidate.topology,
      (snakeCase.topology as TopologyType | undefined) ?? undefined,
      (nested.canal as Record<string, TopologyType> | undefined)?.topology,
      base.topology
    ),
    branchSplitIndex: Math.max(
      1,
      Math.floor(
        pickNumber(
          fullPresetCandidate.branchSplitIndex,
          snakeCase.branch_split_index,
          base.branchSplitIndex
        )
      )
    ),
    branchRatio: clamp(
      pickNumber(fullPresetCandidate.branchRatio, snakeCase.branch_ratio, base.branchRatio),
      0.1,
      0.9
    ),
    conveyanceLoss: clamp(
      pickNumber(
        fullPresetCandidate.conveyanceLoss,
        snakeCase.conveyance_loss,
        (nested.canal as Record<string, number> | undefined)?.conveyance_loss,
        base.conveyanceLoss
      ),
      0.0,
      0.95
    ),
    sanctionAmount: Math.max(
      0,
      pickNumber(fullPresetCandidate.sanctionAmount, snakeCase.sanction_amount, base.sanctionAmount)
    ),
    studentPosition: Math.max(
      0,
      Math.floor(
        pickNumber(
          fullPresetCandidate.studentPosition,
          snakeCase.student_position,
          Math.floor((base.nAgents - 1) / 2)
        )
      )
    ),
    strategyMix,
    withdrawalChoices,
    withdrawalMaxValue: pickNumber(
      fullPresetCandidate.withdrawalMaxValue,
      ((nested.mechanics?.withdrawals as Record<string, number> | undefined)?.max_value as
        | number
        | undefined) ?? undefined,
      base.withdrawalMaxValue
    ),
    maintenanceCost: pickNumber(
      fullPresetCandidate.maintenanceCost,
      snakeCase.maintenance_cost,
      ((nested.mechanics?.maintenance as Record<string, number> | undefined)?.cost_person_days as
        | number
        | undefined) ?? undefined,
      base.maintenanceCost
    ),
    maintenanceThresholdForSuccess: clamp(
      pickNumber(
        fullPresetCandidate.maintenanceThresholdForSuccess,
        snakeCase.maintenance_threshold_for_success,
        ((nested.mechanics?.maintenance as Record<string, number> | undefined)?.threshold_for_success as
          | number
          | undefined) ?? undefined,
        base.maintenanceThresholdForSuccess
      ),
      0,
      1
    ),
    contributionThresholdSeasons: Math.max(
      1,
      Math.floor(
        pickNumber(
          fullPresetCandidate.contributionThresholdSeasons,
          ((nested.mechanics?.maintenance as Record<string, number> | undefined)?.contribution_threshold_seasons as
            | number
            | undefined) ?? undefined,
          base.contributionThresholdSeasons
        )
      )
    ),
    reputationBase: pickNumber(
      fullPresetCandidate.reputationBase,
      ((nested.mechanics?.reputation as Record<string, number> | undefined)?.base as
        | number
        | undefined) ?? undefined,
      base.reputationBase
    ),
    reputationAlpha: pickNumber(
      fullPresetCandidate.reputationAlpha,
      ((nested.mechanics?.reputation as Record<string, number> | undefined)?.alpha as
        | number
        | undefined) ?? undefined,
      base.reputationAlpha
    ),
    reputationBeta: pickNumber(
      fullPresetCandidate.reputationBeta,
      ((nested.mechanics?.reputation as Record<string, number> | undefined)?.beta as
        | number
        | undefined) ?? undefined,
      base.reputationBeta
    ),
    detectionProbability: clamp(
      pickNumber(
        fullPresetCandidate.detectionProbability,
        (nested.mechanics as Record<string, number> | undefined)?.detection_probability,
        base.detectionProbability
      ),
      0,
      1
    ),
    failureProbabilityIncreasePerSeason: clamp(
      pickNumber(
        fullPresetCandidate.failureProbabilityIncreasePerSeason,
        ((nested.mechanics?.failure as Record<string, number> | undefined)?.failure_probability_increase_per_season as
          | number
          | undefined) ?? undefined,
        base.failureProbabilityIncreasePerSeason
      ),
      0,
      1
    ),
    rebuildCostPersonSeasons: pickNumber(
      fullPresetCandidate.rebuildCostPersonSeasons,
      ((nested.mechanics?.failure as Record<string, number> | undefined)?.rebuild_cost_person_seasons as
        | number
        | undefined) ?? undefined,
      base.rebuildCostPersonSeasons
    ),
    fullAllotmentYield: pickNumber(
      fullPresetCandidate.fullAllotmentYield,
      ((nested.mechanics?.yield as Record<string, number> | undefined)?.full_allotment_yield as
        | number
        | undefined) ?? undefined,
      base.fullAllotmentYield
    ),
    diminishingReturnsAboveAllotment: pickBoolean(
      fullPresetCandidate.diminishingReturnsAboveAllotment,
      ((nested.mechanics?.yield as Record<string, boolean> | undefined)
        ?.diminishing_returns_above_allotment as boolean | undefined) ?? undefined,
      base.diminishingReturnsAboveAllotment
    ),
    waterSupply: {
      normal: pickNumber(
        fullPresetCandidate.waterSupply?.normal,
        (nested.simulation?.water_supply as Record<string, number> | undefined)?.normal,
        base.waterSupply.normal
      ),
      droughtMin: pickNumber(
        fullPresetCandidate.waterSupply?.droughtMin,
        snakeCase.drought_min,
        (nested.simulation?.water_supply as Record<string, number> | undefined)?.drought_min,
        base.waterSupply.droughtMin
      ),
      droughtMax: pickNumber(
        fullPresetCandidate.waterSupply?.droughtMax,
        snakeCase.drought_max,
        (nested.simulation?.water_supply as Record<string, number> | undefined)?.drought_max,
        base.waterSupply.droughtMax
      ),
      droughtProbability: clamp(
        pickNumber(
          fullPresetCandidate.waterSupply?.droughtProbability,
          snakeCase.drought_probability,
          (nested.simulation?.water_supply as Record<string, number> | undefined)?.drought_probability,
          base.waterSupply.droughtProbability
        ),
        0,
        1
      )
    }
  };
}

/**
 * Creates an initial simulation state for step-by-step play.
 */
export function createInitialState(presetInput: object = {}, seed = canonicalSpec.simulation.seed_default, options: RunOptions = {}): SimulationState {
  const preset = normalizePreset(presetInput);
  const nAgents = preset.nAgents;
  const studentPosition = Math.floor(clamp(preset.studentPosition, 0, nAgents - 1));
  const agents: AgentState[] = [];
  let aiIndex = 0;

  for (let position = 0; position < nAgents; position += 1) {
    if (position === studentPosition) {
      agents.push({
        agentId: "student",
        role: "student",
        position,
        strategy: "student_controlled",
        reputation: preset.reputationBase,
        wealth: 0,
        cumulativeYield: 0
      });
      continue;
    }
    agents.push({
      agentId: `ai_${aiIndex + 1}`,
      role: "ai",
      position,
      strategy: preset.strategyMix[aiIndex % preset.strategyMix.length],
      reputation: preset.reputationBase,
      wealth: 0,
      cumulativeYield: 0
    });
    aiIndex += 1;
  }

  const runId = options.runId ?? `run-${seed}`;
  const rngSeed = (Math.floor(seed) >>> 0) || 1;
  return {
    runId,
    scenario: options.scenarioName ?? preset.scenario,
    seed,
    preset,
    currentSeason: 0,
    rngState: rngSeed,
    agents,
    history: [],
    lastContributorFraction: 1,
    consecutiveDeficitSeasons: 0,
    nFailures: 0,
    droughtEvents: 0,
    contributorCountSum: 0,
    notes: options.notes ?? ""
  };
}

/**
 * Advances simulation by one season using the pending student decision on state.
 */
export function stepSeason(state: SimulationState): SeasonResult {
  if (state.currentSeason >= state.preset.seasonsPerRun) {
    throw new Error("All seasons have already been completed.");
  }
  if (!state.pendingStudentDecision) {
    throw new Error("pendingStudentDecision must be set before calling stepSeason.");
  }

  const seasonNumber = state.currentSeason + 1;
  const agents = [...state.agents].sort((a, b) => a.position - b.position);
  let rngState = state.rngState;

  const droughtRoll = nextRandom(rngState);
  rngState = droughtRoll.nextState;
  const drought = droughtRoll.value < state.preset.waterSupply.droughtProbability;
  let supply = state.preset.waterSupply.normal;
  if (drought) {
    const droughtSupplyRoll = nextRandom(rngState);
    rngState = droughtSupplyRoll.nextState;
    supply =
      state.preset.waterSupply.droughtMin +
      droughtSupplyRoll.value * (state.preset.waterSupply.droughtMax - state.preset.waterSupply.droughtMin);
  }
  supply = roundTo(supply, 4);

  const meanReputation =
    agents.reduce((sum, agent) => sum + agent.reputation, 0) / Math.max(1, agents.length);

  const decisions: Record<string, AgentDecision> = {};
  for (const agent of agents) {
    const baseDecision =
      agent.role === "student"
        ? state.pendingStudentDecision
        : decideAiDecision(agent, {
            drought,
            lastContributorFraction: state.lastContributorFraction,
            meanReputation,
            threshold: state.preset.maintenanceThresholdForSuccess
          });
    decisions[agent.agentId] = withDecisionAmounts(baseDecision, state.preset);
  }

  const contributorCount = Object.values(decisions).filter((d) => d.maintenanceContributed).length;
  const contributorFraction = contributorCount / agents.length;

  const failureEval = evaluateFailure(
    contributorFraction,
    state.consecutiveDeficitSeasons,
    state.preset,
    rngState
  );
  rngState = failureEval.nextRngState;

  const receivedMap = routeWater(
    agents,
    decisions,
    supply,
    state.preset,
    failureEval.failureThisSeason
  );

  const rebuildShare = failureEval.failureThisSeason
    ? state.preset.rebuildCostPersonSeasons / agents.length
    : 0;

  const records: SeasonRecord[] = [];
  const updatedAgents: AgentState[] = [];
  const seasonYields: number[] = [];

  for (const agent of agents) {
    const decision = decisions[agent.agentId];
    const detection = detectDefection(
      decision,
      agent.position,
      agents.length,
      state.preset,
      rngState
    );
    rngState = detection.nextRngState;

    const waterReceived = roundTo(receivedMap[agent.agentId] ?? 0, 4);
    const seasonYield = calculateYield(waterReceived, state.preset);
    const reputation = updateReputation(
      agent.reputation,
      decision.maintenanceContributed,
      detection.detectedDefection,
      state.preset.reputationAlpha,
      state.preset.reputationBeta
    );
    const maintenanceCost = decision.maintenanceContributed ? state.preset.maintenanceCost : 0;
    const wealth = roundTo(
      agent.wealth + seasonYield - maintenanceCost - detection.sanction - rebuildShare,
      4
    );

    seasonYields.push(seasonYield);
    updatedAgents.push({
      ...agent,
      reputation,
      wealth,
      cumulativeYield: roundTo(agent.cumulativeYield + seasonYield, 4)
    });
    records.push({
      run_id: state.runId,
      season: seasonNumber,
      agent_id: agent.agentId,
      role: agent.role,
      position: agent.position,
      strategy: agent.strategy,
      water_received: waterReceived,
      withdrawal: decision.withdrawalAmount,
      maintenance_contributed: decision.maintenanceContributed ? 1 : 0,
      yield: seasonYield,
      reputation,
      wealth,
      detected_defection: detection.detectedDefection ? 1 : 0,
      sanction: roundTo(detection.sanction, 4),
      canal_failure_flag: failureEval.failureThisSeason ? 1 : 0
    });
  }

  const totalYield = roundTo(seasonYields.reduce((sum, y) => sum + y, 0), 4);
  const giniYield = calculateGini(seasonYields);

  const nextState: SimulationState = {
    ...state,
    currentSeason: seasonNumber,
    rngState,
    agents: updatedAgents,
    history: [...state.history, ...records],
    pendingStudentDecision: undefined,
    lastContributorFraction: contributorFraction,
    consecutiveDeficitSeasons: failureEval.updatedDeficitStreak,
    nFailures: state.nFailures + (failureEval.failureThisSeason ? 1 : 0),
    droughtEvents: state.droughtEvents + (drought ? 1 : 0),
    contributorCountSum: state.contributorCountSum + contributorCount
  };

  return {
    season: seasonNumber,
    supply,
    drought,
    canalFailure: failureEval.failureThisSeason,
    contributorCount,
    contributorFraction: roundTo(contributorFraction, 4),
    totalYield,
    giniYield,
    records,
    state: nextState
  };
}

/**
 * Runs all seasons and returns full run output.
 */
export function runSimulation(preset: object, seed: number, options: RunOptions = {}): RunResult {
  let state = createInitialState(preset, seed, options);
  const seasonResults: SeasonResult[] = [];
  const scriptedDecisions = options.playerDecisions ?? [];

  for (let i = 0; i < state.preset.seasonsPerRun; i += 1) {
    const decision = scriptedDecisions[i] ?? DEFAULT_PLAYER_DECISION;
    const result = stepSeason({
      ...state,
      pendingStudentDecision: decision
    });
    seasonResults.push(result);
    state = result.state;
  }

  const summary = buildRunSummary(state);
  return {
    runId: state.runId,
    scenario: state.scenario,
    seed: state.seed,
    records: state.history,
    summary,
    seasons: seasonResults,
    finalState: state
  };
}

/**
 * Creates a RunResult from current state history (useful for incremental UI play).
 */
export function buildRunResultFromState(state: SimulationState): RunResult {
  return {
    runId: state.runId,
    scenario: state.scenario,
    seed: state.seed,
    records: state.history,
    summary: buildRunSummary(state),
    seasons: [],
    finalState: state
  };
}

/**
 * Exports per-agent seasonal output as CSV with canonical schema.
 */
export function exportAgentsCSV(runResult: RunResult): string {
  const rows = runResult.records.map((record) => ({
    run_id: record.run_id,
    season: record.season,
    agent_id: record.agent_id,
    role: record.role,
    position: record.position,
    strategy: record.strategy,
    water_received: record.water_received,
    withdrawal: record.withdrawal,
    maintenance_contributed: record.maintenance_contributed,
    yield: record.yield,
    reputation: record.reputation,
    wealth: record.wealth,
    detected_defection: record.detected_defection,
    sanction: record.sanction,
    canal_failure_flag: record.canal_failure_flag
  }));
  return toCsv(AGENT_SEASON_COLUMNS, rows);
}

/**
 * Exports run summary output as CSV with canonical schema.
 */
export function exportRunSummaryCSV(runResult: RunResult): string {
  return toCsv(RUN_SUMMARY_COLUMNS, [runResult.summary]);
}

/**
 * Calculates per-agent water receipt for current season.
 */
export function routeWater(
  agents: AgentState[],
  decisions: Record<string, AgentDecision>,
  supply: number,
  preset: SimulationPreset,
  canalFailure: boolean
): Record<string, number> {
  const sorted = [...agents].sort((a, b) => a.position - b.position);
  const effectiveLoss = clamp(preset.conveyanceLoss * (canalFailure ? 1.5 : 1), 0, 0.95);
  if (preset.topology === "branch") {
    return routeWaterBranch(sorted, decisions, supply, effectiveLoss, preset.branchSplitIndex, preset.branchRatio);
  }
  return routeWaterLinear(sorted, decisions, supply, effectiveLoss);
}

export function routeWaterLinear(
  agents: AgentState[],
  decisions: Record<string, AgentDecision>,
  supply: number,
  lossRate: number
): Record<string, number> {
  const received: Record<string, number> = {};
  let flow = Math.max(0, supply);
  for (let i = 0; i < agents.length; i += 1) {
    if (i > 0) {
      flow *= 1 - lossRate;
    }
    const request = decisions[agents[i].agentId]?.withdrawalAmount ?? 0;
    const got = Math.min(flow, Math.max(0, request));
    received[agents[i].agentId] = roundTo(got, 4);
    flow = Math.max(0, flow - got);
  }
  return received;
}

export function routeWaterBranch(
  agents: AgentState[],
  decisions: Record<string, AgentDecision>,
  supply: number,
  lossRate: number,
  splitIndex: number,
  branchRatio: number
): Record<string, number> {
  const received: Record<string, number> = {};
  const safeSplit = clamp(Math.floor(splitIndex), 1, Math.max(1, agents.length - 2));
  const trunk = agents.filter((a) => a.position <= safeSplit);
  const remainder = agents.filter((a) => a.position > safeSplit);
  const branchA: AgentState[] = [];
  const branchB: AgentState[] = [];
  for (let i = 0; i < remainder.length; i += 1) {
    if (i % 2 === 0) {
      branchA.push(remainder[i]);
    } else {
      branchB.push(remainder[i]);
    }
  }

  const trunkResult = processChain(trunk, decisions, supply, lossRate, false);
  Object.assign(received, trunkResult.received);

  const ratio = clamp(branchRatio, 0.1, 0.9);
  const flowA = trunkResult.remainingFlow * ratio;
  const flowB = trunkResult.remainingFlow * (1 - ratio);
  const aResult = processChain(branchA, decisions, flowA, lossRate, true);
  const bResult = processChain(branchB, decisions, flowB, lossRate, true);
  Object.assign(received, aResult.received, bResult.received);
  return received;
}

/**
 * Piecewise linear yield function with optional diminishing returns.
 */
export function calculateYield(waterReceived: number, preset: SimulationPreset): number {
  const allotment = preset.withdrawalChoices.medium;
  const baseSlope = preset.fullAllotmentYield / Math.max(1, allotment);
  if (waterReceived <= allotment) {
    return roundTo(Math.max(0, waterReceived) * baseSlope, 4);
  }
  if (!preset.diminishingReturnsAboveAllotment) {
    return roundTo(Math.max(0, waterReceived) * baseSlope, 4);
  }
  const above = waterReceived - allotment;
  return roundTo(preset.fullAllotmentYield + above * baseSlope * 0.5, 4);
}

export function updateReputation(
  previous: number,
  contributed: boolean,
  detectedDefection: boolean,
  alpha: number,
  beta: number
): number {
  let reputation = previous;
  if (contributed) {
    reputation += alpha;
  }
  if (detectedDefection) {
    reputation -= beta;
  }
  return roundTo(clamp(reputation, 0, 2), 4);
}

export function detectDefection(
  decision: AgentDecision,
  position: number,
  nAgents: number,
  preset: SimulationPreset,
  rngState: number
): { detectedDefection: boolean; sanction: number; nextRngState: number } {
  const defection = decision.maintenanceChoice === "skip" || decision.withdrawalChoice === "high";
  if (!defection) {
    return { detectedDefection: false, sanction: 0, nextRngState: rngState };
  }
  const visibilityFactor = 1 + (position / Math.max(1, nAgents - 1)) * 0.5;
  const pDetect = clamp(preset.detectionProbability * visibilityFactor, 0, 1);
  const draw = nextRandom(rngState);
  return {
    detectedDefection: draw.value < pDetect,
    sanction: draw.value < pDetect ? preset.sanctionAmount : 0,
    nextRngState: draw.nextState
  };
}

export function evaluateFailure(
  contributorFraction: number,
  currentDeficitStreak: number,
  preset: SimulationPreset,
  rngState: number
): { failureThisSeason: boolean; updatedDeficitStreak: number; nextRngState: number } {
  const isDeficit = contributorFraction < preset.maintenanceThresholdForSuccess;
  const updatedDeficitStreak = isDeficit ? currentDeficitStreak + 1 : 0;

  if (!isDeficit || updatedDeficitStreak < preset.contributionThresholdSeasons) {
    return {
      failureThisSeason: false,
      updatedDeficitStreak,
      nextRngState: rngState
    };
  }

  const scale = updatedDeficitStreak - preset.contributionThresholdSeasons + 1;
  const failureProbability = clamp(scale * preset.failureProbabilityIncreasePerSeason, 0, 1);
  const draw = nextRandom(rngState);
  return {
    failureThisSeason: draw.value < failureProbability,
    updatedDeficitStreak,
    nextRngState: draw.nextState
  };
}

function buildRunSummary(state: SimulationState): RunSummaryRecord {
  const totalYield = roundTo(state.history.reduce((sum, record) => sum + record.yield, 0), 4);
  const giniYield = calculateGini(state.agents.map((agent) => agent.cumulativeYield));
  const student = state.agents.find((agent) => agent.role === "student");
  return {
    run_id: state.runId,
    scenario: state.scenario,
    seed: state.seed,
    n_agents: state.agents.length,
    n_contributors_mean: roundTo(state.contributorCountSum / Math.max(1, state.currentSeason), 4),
    total_yield: totalYield,
    gini_yield: giniYield,
    student_final_wealth: roundTo(student?.wealth ?? 0, 4),
    n_failures: state.nFailures,
    drought_events: state.droughtEvents,
    notes: state.notes
  };
}

function decideAiDecision(
  agent: AgentState,
  context: {
    drought: boolean;
    lastContributorFraction: number;
    meanReputation: number;
    threshold: number;
  }
): PlayerDecision {
  switch (agent.strategy) {
    case "always_cooperate":
      return { withdrawalChoice: "medium", maintenanceChoice: "contribute" };
    case "always_defect":
      return { withdrawalChoice: "high", maintenanceChoice: "skip" };
    case "conditional_coop":
      return context.lastContributorFraction >= context.threshold
        ? { withdrawalChoice: "medium", maintenanceChoice: "contribute" }
        : { withdrawalChoice: "high", maintenanceChoice: "skip" };
    case "reputation_sensitive":
      return agent.reputation >= 1 && context.meanReputation >= 1
        ? { withdrawalChoice: "medium", maintenanceChoice: "contribute" }
        : { withdrawalChoice: "high", maintenanceChoice: "skip" };
    case "drought_defect":
      if (context.drought) {
        return { withdrawalChoice: "high", maintenanceChoice: "skip" };
      }
      return context.lastContributorFraction >= context.threshold
        ? { withdrawalChoice: "medium", maintenanceChoice: "contribute" }
        : { withdrawalChoice: "high", maintenanceChoice: "skip" };
    default:
      return { ...DEFAULT_PLAYER_DECISION };
  }
}

function withDecisionAmounts(decision: PlayerDecision, preset: SimulationPreset): AgentDecision {
  const maintenanceChoice: MaintenanceChoice =
    decision.maintenanceChoice === "contribute" ? "contribute" : "skip";
  const withdrawalChoice: WithdrawalChoice =
    decision.withdrawalChoice === "low" || decision.withdrawalChoice === "high"
      ? decision.withdrawalChoice
      : "medium";
  const requested = preset.withdrawalChoices[withdrawalChoice];

  return {
    withdrawalChoice,
    maintenanceChoice,
    withdrawalAmount: Math.min(requested, preset.withdrawalMaxValue),
    maintenanceContributed: maintenanceChoice === "contribute"
  };
}

function processChain(
  chain: AgentState[],
  decisions: Record<string, AgentDecision>,
  startingFlow: number,
  lossRate: number,
  applyLossBeforeFirst: boolean
): { received: Record<string, number>; remainingFlow: number } {
  const received: Record<string, number> = {};
  let flow = Math.max(0, startingFlow);
  for (let i = 0; i < chain.length; i += 1) {
    if (i > 0 || applyLossBeforeFirst) {
      flow *= 1 - lossRate;
    }
    const request = decisions[chain[i].agentId]?.withdrawalAmount ?? 0;
    const got = Math.min(flow, Math.max(0, request));
    received[chain[i].agentId] = roundTo(got, 4);
    flow = Math.max(0, flow - got);
  }
  return {
    received,
    remainingFlow: roundTo(flow, 4)
  };
}

function buildDefaultPreset(spec: CanonicalSpec): SimulationPreset {
  const nAgents = spec.agents.ai_agents_count + 1;
  return {
    scenario: "Default Scenario",
    seasonsPerRun: spec.simulation.seasons_per_run,
    nAgents,
    topology: spec.canal.topology,
    branchSplitIndex: 3,
    branchRatio: 0.6,
    conveyanceLoss: spec.canal.conveyance_loss.default,
    sanctionAmount: 2,
    studentPosition: Math.floor((nAgents - 1) / 2),
    strategyMix: normalizeStrategyMix(undefined, nAgents - 1, spec.agents.strategies),
    withdrawalChoices: spec.mechanics.withdrawals.choices,
    withdrawalMaxValue: spec.mechanics.withdrawals.max_value,
    maintenanceCost: spec.mechanics.maintenance.cost_person_days,
    maintenanceThresholdForSuccess: spec.mechanics.maintenance.threshold_for_success,
    contributionThresholdSeasons: spec.mechanics.maintenance.contribution_threshold_seasons,
    reputationBase: spec.mechanics.reputation.base,
    reputationAlpha: spec.mechanics.reputation.alpha,
    reputationBeta: spec.mechanics.reputation.beta,
    detectionProbability: spec.mechanics.detection_probability,
    failureProbabilityIncreasePerSeason: spec.mechanics.failure.failure_probability_increase_per_season,
    rebuildCostPersonSeasons: spec.mechanics.failure.rebuild_cost_person_seasons,
    fullAllotmentYield: spec.mechanics.yield.full_allotment_yield,
    diminishingReturnsAboveAllotment: spec.mechanics.yield.diminishing_returns_above_allotment,
    waterSupply: {
      normal: spec.simulation.water_supply.normal,
      droughtMin: spec.simulation.water_supply.drought_min,
      droughtMax: spec.simulation.water_supply.drought_max,
      droughtProbability: spec.simulation.water_supply.drought_probability
    }
  };
}

function normalizeStrategyMix(
  candidate: StrategyName[] | undefined,
  aiCount: number,
  fallbackPool: StrategyName[]
): StrategyName[] {
  const source = (candidate && candidate.length > 0 ? candidate : fallbackPool).filter(Boolean);
  const output: StrategyName[] = [];
  for (let i = 0; i < aiCount; i += 1) {
    output.push(source[i % source.length]);
  }
  return output;
}

function normalizeTopology(
  ...values: Array<TopologyType | undefined>
): TopologyType {
  for (const value of values) {
    if (value === "linear" || value === "branch") {
      return value;
    }
  }
  return "linear";
}

function pickString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

function pickBoolean(...values: Array<unknown>): boolean {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

function pickNumber(...values: Array<unknown>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}
