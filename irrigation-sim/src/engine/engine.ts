import {
  AgentDecision,
  AgentState,
  OutcomeState,
  PlayerDecision,
  RunOptions,
  RunResult,
  RunSummaryRecord,
  SeasonRecord,
  SeasonResult,
  SimulationPreset,
  SimulationState,
  StatusMetrics
} from "./types";
import { calculateGini, clamp, nextRandom, roundTo, toCsv } from "./utils";

export const AGENT_SEASON_COLUMNS = [
  "run_id",
  "season",
  "agent_id",
  "role",
  "position",
  "strategy",
  "water_received",
  "withdrawal",
  "maintenance_contributed",
  "yield",
  "reputation",
  "wealth",
  "detected_defection",
  "sanction",
  "canal_failure_flag"
];

export const RUN_SUMMARY_COLUMNS = [
  "run_id",
  "scenario",
  "seed",
  "n_agents",
  "n_contributors_mean",
  "total_yield",
  "gini_yield",
  "student_final_wealth",
  "n_failures",
  "drought_events",
  "notes"
];

const DEFAULT_PRESET: SimulationPreset = {
  scenario: "Simple Survival",
  seasonsPerRun: 8,
  nAgents: 6,
  topology: "linear",
  conveyanceLoss: 0.08,
  baseSupply: 90,
  supplyVariance: 24,
  rainfallVariabilityEnabled: true,
  studentPosition: 2,
  fairTake: 12,
  maxTake: 24,
  fairMaintenance: 1,
  maxMaintenance: 3,
  aiCooperativeness: 0.5,
  aiCompetitiveness: 0.5,
  fullAllotmentYield: 16,
  canalDecay: 6,
  criticalStressSeasons: 4
};

const DEFAULT_STATUS: StatusMetrics = {
  canalCondition: 72,
  downstreamStress: 24,
  groupTrust: 68
};

const ZERO_STATUS: StatusMetrics = {
  canalCondition: 0,
  downstreamStress: 0,
  groupTrust: 0
};

const AI_STRATEGIES: Array<AgentState["strategy"]> = [
  "upstream_pressure",
  "upstream_pressure",
  "reciprocal",
  "downstream_retaliation",
  "downstream_retaliation"
];

/**
 * Normalizes runtime preset overrides into a complete simplified preset.
 */
export function normalizePreset(presetInput: object = {}): SimulationPreset {
  const input = presetInput as Record<string, unknown>;
  const fairTake = Math.max(1, pickNumber(input.fairTake, input.fair_take, DEFAULT_PRESET.fairTake));
  const fairMaintenance = Math.max(
    0.1,
    pickNumber(input.fairMaintenance, input.fair_maintenance, DEFAULT_PRESET.fairMaintenance)
  );
  const maxTake = Math.max(fairTake, pickNumber(input.maxTake, input.max_take, DEFAULT_PRESET.maxTake));
  const maxMaintenance = Math.max(
    fairMaintenance,
    pickNumber(input.maxMaintenance, input.max_maintenance, DEFAULT_PRESET.maxMaintenance)
  );
  const aiCooperativeness = clamp(
    pickNumber(input.aiCooperativeness, input.ai_cooperativeness, DEFAULT_PRESET.aiCooperativeness),
    0,
    1
  );
  const aiCompetitiveness = clamp(
    pickNumber(input.aiCompetitiveness, input.ai_competitiveness, DEFAULT_PRESET.aiCompetitiveness),
    0,
    1
  );

  return {
    scenario: pickString(input.scenario, DEFAULT_PRESET.scenario),
    seasonsPerRun: Math.max(
      1,
      Math.floor(pickNumber(input.seasonsPerRun, input.seasons_per_run, DEFAULT_PRESET.seasonsPerRun))
    ),
    nAgents: Math.max(3, Math.floor(pickNumber(input.nAgents, input.n_agents, DEFAULT_PRESET.nAgents))),
    topology: "linear",
    conveyanceLoss: clamp(
      pickNumber(input.conveyanceLoss, input.conveyance_loss, DEFAULT_PRESET.conveyanceLoss),
      0.01,
      0.35
    ),
    baseSupply: Math.max(10, pickNumber(input.baseSupply, input.base_supply, DEFAULT_PRESET.baseSupply)),
    supplyVariance: Math.max(
      0,
      pickNumber(input.supplyVariance, input.supply_variance, DEFAULT_PRESET.supplyVariance)
    ),
    rainfallVariabilityEnabled: pickBoolean(
      input.rainfallVariabilityEnabled,
      input.rainfall_variability_enabled,
      DEFAULT_PRESET.rainfallVariabilityEnabled
    ),
    studentPosition: Math.max(
      0,
      Math.floor(pickNumber(input.studentPosition, input.student_position, DEFAULT_PRESET.studentPosition))
    ),
    fairTake,
    maxTake,
    fairMaintenance,
    maxMaintenance,
    aiCooperativeness,
    aiCompetitiveness,
    fullAllotmentYield: Math.max(
      1,
      pickNumber(input.fullAllotmentYield, input.full_allotment_yield, DEFAULT_PRESET.fullAllotmentYield)
    ),
    canalDecay: Math.max(0, pickNumber(input.canalDecay, input.canal_decay, DEFAULT_PRESET.canalDecay)),
    criticalStressSeasons: Math.max(
      1,
      Math.floor(
        pickNumber(
          input.criticalStressSeasons,
          input.critical_stress_seasons,
          DEFAULT_PRESET.criticalStressSeasons
        )
      )
    )
  };
}

/**
 * Creates a fresh simulation state for step-by-step play.
 */
export function createInitialState(
  presetInput: object = {},
  seed = 42,
  options: RunOptions = {}
): SimulationState {
  const preset = normalizePreset(presetInput);
  const nAgents = preset.nAgents;
  const configuredPosition =
    options.studentPosition !== undefined ? options.studentPosition : preset.studentPosition;
  const studentPosition = Math.floor(clamp(configuredPosition, 0, nAgents - 1));

  const agents: AgentState[] = [];
  let aiCounter = 0;
  for (let position = 0; position < nAgents; position += 1) {
    if (position === studentPosition) {
      agents.push({
        agentId: "student",
        role: "student",
        position,
        strategy: "student_controlled",
        reputation: 1,
        wealth: 0,
        cumulativeYield: 0,
        waterStress: 0
      });
      continue;
    }
    agents.push({
      agentId: `ai_${aiCounter + 1}`,
      role: "ai",
      position,
      strategy: AI_STRATEGIES[aiCounter % AI_STRATEGIES.length],
      reputation: 1,
      wealth: 0,
      cumulativeYield: 0,
      waterStress: 0
    });
    aiCounter += 1;
  }

  return {
    runId: options.runId ?? `run-${seed}`,
    scenario: options.scenarioName ?? preset.scenario,
    seed,
    preset,
    currentSeason: 0,
    rngState: (Math.floor(seed) >>> 0) || 1,
    agents,
    history: [],
    turnPhase: "water",
    pendingSeason: undefined,
    pendingStudentDecision: undefined,
    lastCooperationRate: 0.65,
    criticalStressStreak: 0,
    nFailures: 0,
    lowSupplyEvents: 0,
    contributorCountSum: 0,
    status: { ...DEFAULT_STATUS },
    statusHistory: [
      {
        season: 0,
        ...DEFAULT_STATUS
      }
    ],
    lastStatusDelta: { ...ZERO_STATUS },
    retaliationPressure: 0.2,
    outcome: "in_progress",
    lastNarrative: "Start by balancing your own take with shared maintenance.",
    lastFeedback: "",
    notes: options.notes ?? ""
  };
}

/**
 * Advances simulation by one season.
 */
export function stepSeason(state: SimulationState): SeasonResult {
  if (state.outcome !== "in_progress") {
    throw new Error("Simulation already finished.");
  }
  if (state.currentSeason >= state.preset.seasonsPerRun) {
    throw new Error("All seasons have already been completed.");
  }
  if (!state.pendingStudentDecision) {
    throw new Error("pendingStudentDecision must be set before calling stepSeason.");
  }

  const season = state.currentSeason + 1;
  const sortedAgents = [...state.agents].sort((a, b) => a.position - b.position);

  if (state.turnPhase === "water") {
    if (typeof state.pendingStudentDecision.withdrawal !== "number") {
      throw new Error("Water phase requires a student withdrawal decision.");
    }

    let rngState = state.rngState;
    const supplyDraw = nextRandom(rngState);
    rngState = supplyDraw.nextState;
    const centered = supplyDraw.value - 0.5;
    const supply = state.preset.rainfallVariabilityEnabled
      ? roundTo(state.preset.baseSupply + centered * state.preset.supplyVariance, 4)
      : roundTo(state.preset.baseSupply, 4);
    const lowSupply = state.preset.rainfallVariabilityEnabled
      ? supply < state.preset.baseSupply - state.preset.supplyVariance * 0.2
      : false;

    const withdrawals: Record<string, number> = {};
    for (const agent of sortedAgents) {
      const proposed =
        agent.role === "student"
          ? { withdrawal: state.pendingStudentDecision.withdrawal, maintenance: state.preset.fairMaintenance }
          : decideAiWaterDecision(agent, state);
      const sanitized = sanitizeDecision(proposed, state.preset);
      withdrawals[agent.agentId] = sanitized.withdrawal;
    }

    const revealedWithdrawals = sortedAgents.map((agent) => {
      const withdrawal = roundTo(withdrawals[agent.agentId] ?? 0, 4);
      return {
        agent_id: agent.agentId,
        role: agent.role,
        position: agent.position,
        withdrawal,
        above_fair: roundTo(withdrawal - state.preset.fairTake, 4)
      };
    });

    const nextState: SimulationState = {
      ...state,
      rngState,
      turnPhase: "maintenance",
      pendingSeason: {
        season,
        supply,
        lowSupply,
        withdrawals,
        revealedWithdrawals
      },
      pendingStudentDecision: undefined,
      lastNarrative: "Water choices are revealed. Decide maintenance after seeing who took above fair.",
      lastFeedback: "Phase 1 complete: adjust maintenance to respond to visible extraction this season."
    };

    return {
      season,
      supply,
      drought: lowSupply,
      canalFailure: false,
      contributorCount: 0,
      contributorFraction: 0,
      totalYield: 0,
      giniYield: 0,
      records: [],
      narrative: nextState.lastNarrative,
      feedback: nextState.lastFeedback,
      status: nextState.status,
      statusDelta: { ...ZERO_STATUS },
      outcome: nextState.outcome,
      state: nextState
    };
  }

  if (!state.pendingSeason) {
    throw new Error("Maintenance phase requires pendingSeason data.");
  }
  if (typeof state.pendingStudentDecision.maintenance !== "number") {
    throw new Error("Maintenance phase requires a student maintenance decision.");
  }

  const supply = state.pendingSeason.supply;
  const lowSupply = state.pendingSeason.lowSupply;
  const decisions: Record<string, AgentDecision> = {};
  for (const agent of sortedAgents) {
    const proposed =
      agent.role === "student"
        ? {
            withdrawal: state.pendingSeason.withdrawals[agent.agentId],
            maintenance: state.pendingStudentDecision.maintenance
          }
        : decideAiMaintenanceDecision(agent, state, state.pendingSeason.withdrawals);
    decisions[agent.agentId] = sanitizeDecision(proposed, state.preset);
  }

  const contributorCount = Object.values(decisions).filter((decision) => decision.maintenanceContributed).length;
  const contributorFraction = contributorCount / sortedAgents.length;

  const totalMaintenance = Object.values(decisions).reduce((sum, decision) => sum + decision.maintenance, 0);
  const maintenanceRatio = clamp(totalMaintenance / (state.preset.fairMaintenance * sortedAgents.length), 0, 1.5);

  const totalExtra = Object.values(decisions).reduce(
    (sum, decision) => sum + Math.max(0, decision.withdrawal - state.preset.fairTake),
    0
  );
  const extraPressure = clamp(totalExtra / (sortedAgents.length * state.preset.fairTake), 0, 2);

  const waterMap = routeWaterLinear(sortedAgents, decisions, supply, state.preset.conveyanceLoss);

  const records: SeasonRecord[] = [];
  const updatedAgents: AgentState[] = [];
  const yields: number[] = [];
  for (const agent of sortedAgents) {
    const decision = decisions[agent.agentId];
    const waterReceived = roundTo(waterMap[agent.agentId] ?? 0, 4);
    const yieldValue = calculateYield(waterReceived, state.preset);
    const waterDeficit = Math.max(0, state.preset.fairTake - waterReceived);
    const nextStress = roundTo(clamp(agent.waterStress * 0.55 + waterDeficit * 2.3, 0, 100), 4);
    const nextReputation = updateReputation(agent.reputation, decision.maintenanceContributed, decision.tookExtra, 0.06, 0.08);
    const nextWealth = roundTo(agent.wealth + yieldValue - decision.maintenance, 4);

    updatedAgents.push({
      ...agent,
      waterStress: nextStress,
      reputation: nextReputation,
      wealth: nextWealth,
      cumulativeYield: roundTo(agent.cumulativeYield + yieldValue, 4)
    });
    yields.push(yieldValue);
    records.push({
      run_id: state.runId,
      season,
      agent_id: agent.agentId,
      role: agent.role,
      position: agent.position,
      strategy: agent.strategy,
      water_received: waterReceived,
      withdrawal: decision.withdrawal,
      maintenance_contributed: decision.maintenanceContributed ? 1 : 0,
      yield: yieldValue,
      reputation: nextReputation,
      wealth: nextWealth,
      detected_defection: 0,
      sanction: 0,
      canal_failure_flag: 0
    });
  }

  const studentDecision = decisions.student;
  if (!studentDecision) {
    throw new Error("Student decision missing for maintenance phase.");
  }

  const nextStatus = updateStatusMetrics(state.status, {
    agents: sortedAgents,
    waterMap,
    maintenanceRatio,
    extraPressure,
    studentDecision,
    preset: state.preset
  });
  const studentSelfishness = computeStudentSelfishness(studentDecision, state.preset);
  const nextRetaliationPressure = computeRetaliationPressure({
    previous: state.retaliationPressure,
    studentSelfishness,
    extraPressure,
    downstreamStress: nextStatus.downstreamStress,
    groupTrust: nextStatus.groupTrust
  });
  const statusDelta = {
    canalCondition: roundTo(nextStatus.canalCondition - state.status.canalCondition, 4),
    downstreamStress: roundTo(nextStatus.downstreamStress - state.status.downstreamStress, 4),
    groupTrust: roundTo(nextStatus.groupTrust - state.status.groupTrust, 4)
  };

  const canalFailure = nextStatus.canalCondition <= 10;
  if (canalFailure) {
    for (const record of records) {
      record.canal_failure_flag = 1;
    }
  }

  const criticalStressStreak = nextStatus.downstreamStress >= 90 ? state.criticalStressStreak + 1 : 0;
  let outcome: OutcomeState = "in_progress";
  if (canalFailure || criticalStressStreak >= state.preset.criticalStressSeasons) {
    outcome = "loss";
  } else if (season >= state.preset.seasonsPerRun) {
    outcome =
      nextStatus.canalCondition >= 40 && nextStatus.downstreamStress <= 60 && nextStatus.groupTrust >= 40
        ? "win"
        : "loss";
  }

  const narrative = buildNarrative({
    maintenanceRatio,
    extraPressure,
    downstreamStress: nextStatus.downstreamStress,
    canalCondition: nextStatus.canalCondition,
    groupTrust: nextStatus.groupTrust,
    outcome
  });
  const feedback = buildStudentFeedback(studentDecision, state.preset, statusDelta);

  const totalYield = roundTo(yields.reduce((sum, value) => sum + value, 0), 4);
  const giniYield = calculateGini(yields);

  const nextState: SimulationState = {
    ...state,
    currentSeason: season,
    agents: updatedAgents,
    history: [...state.history, ...records],
    turnPhase: "water",
    pendingSeason: undefined,
    pendingStudentDecision: undefined,
    lastCooperationRate: contributorFraction,
    criticalStressStreak,
    nFailures: state.nFailures + (canalFailure ? 1 : 0),
    lowSupplyEvents: state.lowSupplyEvents + (lowSupply ? 1 : 0),
    contributorCountSum: state.contributorCountSum + contributorCount,
    status: nextStatus,
    statusHistory: [
      ...state.statusHistory,
      {
        season,
        ...nextStatus
      }
    ],
    lastStatusDelta: statusDelta,
    retaliationPressure: nextRetaliationPressure,
    outcome,
    lastNarrative: narrative,
    lastFeedback: feedback
  };

  return {
    season,
    supply,
    drought: lowSupply,
    canalFailure,
    contributorCount,
    contributorFraction: roundTo(contributorFraction, 4),
    totalYield,
    giniYield,
    records,
    narrative,
    feedback,
    status: nextStatus,
    statusDelta,
    outcome,
    state: nextState
  };
}

/**
 * Runs full simulation from season 1 to completion.
 */
export function runSimulation(preset: object, seed: number, options: RunOptions = {}): RunResult {
  let state = createInitialState(preset, seed, options);
  const scripted = options.playerDecisions ?? [];
  const seasons: SeasonResult[] = [];

  for (let i = 0; i < state.preset.seasonsPerRun; i += 1) {
    if (state.outcome !== "in_progress") {
      break;
    }
    const planned = scripted[i] ?? {};
    const waterPhase = stepSeason({
      ...state,
      pendingStudentDecision: {
        withdrawal:
          typeof planned.withdrawal === "number" ? planned.withdrawal : state.preset.fairTake
      }
    });
    state = waterPhase.state;
    if (state.outcome !== "in_progress") {
      break;
    }
    const maintenancePhase = stepSeason({
      ...state,
      pendingStudentDecision: {
        maintenance:
          typeof planned.maintenance === "number" ? planned.maintenance : state.preset.fairMaintenance
      }
    });
    seasons.push(maintenancePhase);
    state = maintenancePhase.state;
  }

  return {
    runId: state.runId,
    scenario: state.scenario,
    seed: state.seed,
    records: state.history,
    summary: buildRunSummary(state),
    seasons,
    finalState: state
  };
}

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

export function exportRunSummaryCSV(runResult: RunResult): string {
  const row = {
    run_id: runResult.summary.run_id,
    scenario: runResult.summary.scenario,
    seed: runResult.summary.seed,
    n_agents: runResult.summary.n_agents,
    n_contributors_mean: runResult.summary.n_contributors_mean,
    total_yield: runResult.summary.total_yield,
    gini_yield: runResult.summary.gini_yield,
    student_final_wealth: runResult.summary.student_final_wealth,
    n_failures: runResult.summary.n_failures,
    drought_events: runResult.summary.drought_events,
    notes: runResult.summary.notes
  };
  return toCsv(RUN_SUMMARY_COLUMNS, [row]);
}

/**
 * Routes water head-to-tail in a linear canal.
 */
export function routeWaterLinear(
  agents: AgentState[],
  decisions: Record<string, AgentDecision>,
  supply: number,
  lossRate: number
): Record<string, number> {
  const sorted = [...agents].sort((a, b) => a.position - b.position);
  const received: Record<string, number> = {};
  let flow = Math.max(0, supply);
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0) {
      flow *= 1 - lossRate;
    }
    const request = decisions[sorted[i].agentId]?.withdrawal ?? 0;
    const taken = Math.min(flow, Math.max(0, request));
    received[sorted[i].agentId] = roundTo(taken, 4);
    flow = Math.max(0, flow - taken);
  }
  return received;
}

export function calculateYield(waterReceived: number, preset: SimulationPreset): number {
  const fairTake = preset.fairTake;
  const baseSlope = preset.fullAllotmentYield / Math.max(1, fairTake);
  if (waterReceived <= fairTake) {
    return roundTo(Math.max(0, waterReceived) * baseSlope, 4);
  }
  const above = waterReceived - fairTake;
  return roundTo(preset.fullAllotmentYield + above * baseSlope * 0.35, 4);
}

export function updateReputation(
  previous: number,
  contributed: boolean,
  tookExtra: boolean,
  alpha: number,
  beta: number
): number {
  let next = previous;
  if (contributed) {
    next += alpha;
  }
  if (tookExtra) {
    next -= beta;
  }
  return roundTo(clamp(next, 0, 2), 4);
}

function sanitizeDecision(decision: PlayerDecision, preset: SimulationPreset): AgentDecision {
  const rawWithdrawal =
    typeof decision.withdrawal === "number" ? decision.withdrawal : preset.fairTake;
  const rawMaintenance =
    typeof decision.maintenance === "number" ? decision.maintenance : preset.fairMaintenance;
  const withdrawal = roundTo(clamp(rawWithdrawal, 0, preset.maxTake), 4);
  const maintenance = roundTo(clamp(rawMaintenance, 0, preset.maxMaintenance), 4);
  return {
    withdrawal,
    maintenance,
    maintenanceContributed: maintenance >= preset.fairMaintenance * 0.85,
    tookExtra: withdrawal > preset.fairTake + 0.01
  };
}

function decideAiWaterDecision(agent: AgentState, state: SimulationState): PlayerDecision {
  const fairTake = state.preset.fairTake;
  const trust = state.status.groupTrust;
  const downstreamStress = state.status.downstreamStress;
  const retaliation = state.retaliationPressure;
  const coop = state.preset.aiCooperativeness;
  const comp = state.preset.aiCompetitiveness;
  const takeEscalation = retaliation * (2 + comp * 2.5);

  let withdrawal = fairTake;
  switch (agent.strategy) {
    case "upstream_pressure":
      withdrawal = trust < 55 ? fairTake + 5 + takeEscalation : fairTake + 2 + takeEscalation;
      break;
    case "downstream_retaliation":
      withdrawal =
        agent.waterStress > 22 || downstreamStress > 58 || retaliation > 0.45
          ? fairTake + 4 + takeEscalation
          : fairTake + takeEscalation * 0.5;
      break;
    case "reciprocal":
      withdrawal =
        state.lastCooperationRate >= 0.6 && retaliation < 0.7
          ? fairTake + takeEscalation * 0.35
          : fairTake + 3 + takeEscalation;
      break;
    default:
      withdrawal = fairTake;
      break;
  }

  // Global standards: cooperativeness pulls toward fairness/help, competitiveness pulls toward extraction.
  withdrawal = withdrawal + comp * 2.6 - coop * 2.2;

  return {
    withdrawal
  };
}

function decideAiMaintenanceDecision(
  agent: AgentState,
  state: SimulationState,
  withdrawals: Record<string, number>
): PlayerDecision {
  const fairMaintenance = state.preset.fairMaintenance;
  const fairTake = state.preset.fairTake;
  const downstreamStress = state.status.downstreamStress;
  const retaliation = state.retaliationPressure;
  const coop = state.preset.aiCooperativeness;
  const comp = state.preset.aiCompetitiveness;

  const ownWithdrawal = withdrawals[agent.agentId] ?? fairTake;
  const studentWithdrawal = withdrawals.student ?? fairTake;
  const meanWithdrawal =
    Object.values(withdrawals).reduce((sum, value) => sum + value, 0) /
    Math.max(1, Object.keys(withdrawals).length);
  const highTakingPressure = Math.max(0, (meanWithdrawal - fairTake) / Math.max(1, fairTake));
  const studentOvertake = Math.max(0, (studentWithdrawal - fairTake) / Math.max(1, fairTake));
  const ownOvertake = Math.max(0, (ownWithdrawal - fairTake) / Math.max(1, fairTake));

  let maintenance = fairMaintenance;
  switch (agent.strategy) {
    case "upstream_pressure":
      maintenance = fairMaintenance * (0.55 - retaliation * 0.25);
      break;
    case "downstream_retaliation":
      maintenance =
        downstreamStress > 60 || studentOvertake > 0.3
          ? fairMaintenance * (0.35 - retaliation * 0.2)
          : fairMaintenance * (0.95 - retaliation * 0.25);
      break;
    case "reciprocal":
      maintenance =
        state.lastCooperationRate >= 0.6 && studentOvertake < 0.2
          ? fairMaintenance * (1.05 - retaliation * 0.2)
          : fairMaintenance * (0.55 - retaliation * 0.25);
      break;
    default:
      maintenance = fairMaintenance;
      break;
  }

  maintenance =
    maintenance * (1 + coop * 0.45 - comp * 0.45) -
    fairMaintenance * (studentOvertake * 0.35 + highTakingPressure * 0.2 + ownOvertake * 0.15);

  return {
    withdrawal: ownWithdrawal,
    maintenance
  };
}

function updateStatusMetrics(
  previous: StatusMetrics,
  context: {
    agents: AgentState[];
    waterMap: Record<string, number>;
    maintenanceRatio: number;
    extraPressure: number;
    studentDecision: AgentDecision;
    preset: SimulationPreset;
  }
): StatusMetrics {
  const tailAgents = [...context.agents]
    .sort((a, b) => b.position - a.position)
    .slice(0, 2);
  const tailMeanWater =
    tailAgents.reduce((sum, agent) => sum + (context.waterMap[agent.agentId] ?? 0), 0) /
    Math.max(1, tailAgents.length);
  const downstreamDeficit = Math.max(0, context.preset.fairTake - tailMeanWater);

  const studentWithdrawalGap =
    (context.studentDecision.withdrawal - context.preset.fairTake) /
    Math.max(1, context.preset.fairTake);
  const studentMaintenanceGap =
    (context.studentDecision.maintenance - context.preset.fairMaintenance) /
    Math.max(0.1, context.preset.fairMaintenance);
  const studentTrustEffect = clamp(-studentWithdrawalGap * 12 + studentMaintenanceGap * 9, -10, 8);
  const lowMaintenancePenalty = context.maintenanceRatio < 0.8 ? (0.8 - context.maintenanceRatio) * 8 : 0;

  const canalCondition = clamp(
    previous.canalCondition +
      context.maintenanceRatio * 13 -
      context.extraPressure * 11 -
      context.preset.canalDecay -
      lowMaintenancePenalty,
    0,
    100
  );
  const downstreamStress = clamp(
    previous.downstreamStress +
      downstreamDeficit * 1.6 +
      context.extraPressure * 7.5 -
      context.maintenanceRatio * 8 +
      lowMaintenancePenalty * 0.4,
    0,
    100
  );
  const groupTrust = clamp(
    previous.groupTrust +
      context.maintenanceRatio * 8 -
      context.extraPressure * 15 +
      studentTrustEffect,
    0,
    100
  );

  return {
    canalCondition: roundTo(canalCondition, 4),
    downstreamStress: roundTo(downstreamStress, 4),
    groupTrust: roundTo(groupTrust, 4)
  };
}

function buildRunSummary(state: SimulationState): RunSummaryRecord {
  const totalYield = roundTo(state.history.reduce((sum, record) => sum + record.yield, 0), 4);
  const student = state.agents.find((agent) => agent.role === "student");
  return {
    run_id: state.runId,
    scenario: state.scenario,
    seed: state.seed,
    n_agents: state.agents.length,
    n_contributors_mean: roundTo(
      state.contributorCountSum / Math.max(1, state.currentSeason),
      4
    ),
    total_yield: totalYield,
    gini_yield: calculateGini(state.agents.map((agent) => agent.cumulativeYield)),
    student_final_wealth: roundTo(student?.wealth ?? 0, 4),
    n_failures: state.nFailures,
    drought_events: state.lowSupplyEvents,
    notes: state.notes || `Outcome: ${state.outcome}`
  };
}

function buildNarrative(input: {
  maintenanceRatio: number;
  extraPressure: number;
  downstreamStress: number;
  canalCondition: number;
  groupTrust: number;
  outcome: OutcomeState;
}): string {
  if (input.outcome === "win") {
    return "Group survival succeeded: fairer withdrawals and maintenance coordination held together.";
  }
  if (input.outcome === "loss") {
    return "Group survival failed: either canal condition collapsed or downstream stress remained critical.";
  }
  if (input.extraPressure > 0.3) {
    return "Too much above-fair withdrawal is stressing downstream households.";
  }
  if (input.maintenanceRatio < 0.9) {
    return "Maintenance is below fair allocation, and canal condition is slipping.";
  }
  if (input.downstreamStress > 60) {
    return "Downstream stress is high; coordination is becoming fragile.";
  }
  if (input.groupTrust > 70) {
    return "Trust is strengthening. Cooperative behavior is stabilizing outcomes.";
  }
  return "System is stable for now. Keep withdrawals fair and maintenance near target.";
}

function buildStudentFeedback(
  studentDecision: AgentDecision,
  preset: SimulationPreset,
  delta: StatusMetrics
): string {
  const takeDelta = roundTo(studentDecision.withdrawal - preset.fairTake, 2);
  const maintenanceDelta = roundTo(studentDecision.maintenance - preset.fairMaintenance, 2);
  return `You took ${studentDecision.withdrawal.toFixed(1)} water (fair ${preset.fairTake.toFixed(
    1
  )}, ${withSigned(takeDelta)}) and contributed ${studentDecision.maintenance.toFixed(
    1
  )} maintenance (fair ${preset.fairMaintenance.toFixed(1)}, ${withSigned(
    maintenanceDelta
  )}). Retaliation pressure ${retaliationLabel(studentDecision, preset)}. Canal ${withSigned(delta.canalCondition)}, stress ${withSigned(
    delta.downstreamStress
  )}, trust ${withSigned(delta.groupTrust)} this season.`;
}

function computeStudentSelfishness(studentDecision: AgentDecision, preset: SimulationPreset): number {
  const takeGap = Math.max(0, (studentDecision.withdrawal - preset.fairTake) / Math.max(1, preset.fairTake));
  const maintenanceGap = Math.max(
    0,
    (preset.fairMaintenance - studentDecision.maintenance) / Math.max(0.1, preset.fairMaintenance)
  );
  return clamp(takeGap + maintenanceGap, 0, 2);
}

function computeRetaliationPressure(input: {
  previous: number;
  studentSelfishness: number;
  extraPressure: number;
  downstreamStress: number;
  groupTrust: number;
}): number {
  const trustPenalty = input.groupTrust < 45 ? (45 - input.groupTrust) / 45 : 0;
  const stressSignal = input.downstreamStress > 55 ? (input.downstreamStress - 55) / 45 : 0;
  const next =
    input.previous * 0.4 +
    input.studentSelfishness * 0.45 +
    input.extraPressure * 0.30 +
    trustPenalty * 0.4 +
    stressSignal * 0.4;
  return roundTo(clamp(next, 0, 1.0), 4);
}

function retaliationLabel(studentDecision: AgentDecision, preset: SimulationPreset): string {
  const selfishness = computeStudentSelfishness(studentDecision, preset);
  if (selfishness >= 1.2) {
    return "high";
  }
  if (selfishness >= 0.6) {
    return "rising";
  }
  return "low";
}

function withSigned(value: number): string {
  const rounded = roundTo(value, 2);
  return rounded >= 0 ? `+${rounded.toFixed(2)}` : rounded.toFixed(2);
}

function pickString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}

function pickNumber(...values: Array<unknown>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function pickBoolean(...values: Array<unknown>): boolean {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}
