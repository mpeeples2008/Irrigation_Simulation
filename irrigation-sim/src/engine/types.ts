export type StrategyName =
  | "always_cooperate"
  | "always_defect"
  | "conditional_coop"
  | "reputation_sensitive"
  | "drought_defect";

export type WithdrawalChoice = "low" | "medium" | "high";
export type MaintenanceChoice = "contribute" | "skip";
export type TopologyType = "linear" | "branch";
export type AgentRole = "student" | "ai";

export interface PlayerDecision {
  withdrawalChoice: WithdrawalChoice;
  maintenanceChoice: MaintenanceChoice;
}

export interface AgentDecision extends PlayerDecision {
  withdrawalAmount: number;
  maintenanceContributed: boolean;
}

export interface WaterSupplyConfig {
  normal: number;
  droughtMin: number;
  droughtMax: number;
  droughtProbability: number;
}

export interface SimulationPreset {
  scenario: string;
  seasonsPerRun: number;
  nAgents: number;
  topology: TopologyType;
  branchSplitIndex: number;
  branchRatio: number;
  conveyanceLoss: number;
  sanctionAmount: number;
  studentPosition: number;
  strategyMix: StrategyName[];
  withdrawalChoices: Record<WithdrawalChoice, number>;
  withdrawalMaxValue: number;
  maintenanceCost: number;
  maintenanceThresholdForSuccess: number;
  contributionThresholdSeasons: number;
  reputationBase: number;
  reputationAlpha: number;
  reputationBeta: number;
  detectionProbability: number;
  failureProbabilityIncreasePerSeason: number;
  rebuildCostPersonSeasons: number;
  fullAllotmentYield: number;
  diminishingReturnsAboveAllotment: boolean;
  waterSupply: WaterSupplyConfig;
}

export interface AgentState {
  agentId: string;
  role: AgentRole;
  position: number;
  strategy: StrategyName | "student_controlled";
  reputation: number;
  wealth: number;
  cumulativeYield: number;
}

export interface SimulationState {
  runId: string;
  scenario: string;
  seed: number;
  preset: SimulationPreset;
  currentSeason: number;
  rngState: number;
  agents: AgentState[];
  history: SeasonRecord[];
  pendingStudentDecision?: PlayerDecision;
  lastContributorFraction: number;
  consecutiveDeficitSeasons: number;
  nFailures: number;
  droughtEvents: number;
  contributorCountSum: number;
  notes: string;
}

export interface SeasonRecord {
  run_id: string;
  season: number;
  agent_id: string;
  role: AgentRole;
  position: number;
  strategy: string;
  water_received: number;
  withdrawal: number;
  maintenance_contributed: number;
  yield: number;
  reputation: number;
  wealth: number;
  detected_defection: number;
  sanction: number;
  canal_failure_flag: number;
}

export interface RunSummaryRecord {
  run_id: string;
  scenario: string;
  seed: number;
  n_agents: number;
  n_contributors_mean: number;
  total_yield: number;
  gini_yield: number;
  student_final_wealth: number;
  n_failures: number;
  drought_events: number;
  notes: string;
}

export interface SeasonResult {
  season: number;
  supply: number;
  drought: boolean;
  canalFailure: boolean;
  contributorCount: number;
  contributorFraction: number;
  totalYield: number;
  giniYield: number;
  records: SeasonRecord[];
  state: SimulationState;
}

export interface RunResult {
  runId: string;
  scenario: string;
  seed: number;
  records: SeasonRecord[];
  summary: RunSummaryRecord;
  seasons: SeasonResult[];
  finalState: SimulationState;
}

export interface RunOptions {
  runId?: string;
  scenarioName?: string;
  notes?: string;
  playerDecisions?: PlayerDecision[];
}

export interface CanonicalSpec {
  agents: {
    ai_agents_count: number;
    strategies: StrategyName[];
  };
  canal: {
    topology: TopologyType;
    conveyance_loss: {
      default: number;
      range: [number, number];
    };
  };
  simulation: {
    seasons_per_run: number;
    seed_default: number;
    water_supply: {
      normal: number;
      drought_min: number;
      drought_max: number;
      drought_probability: number;
    };
  };
  mechanics: {
    withdrawals: {
      choices: Record<WithdrawalChoice, number>;
      max_value: number;
    };
    maintenance: {
      cost_person_days: number;
      threshold_for_success: number;
      contribution_threshold_seasons: number;
    };
    reputation: {
      base: number;
      alpha: number;
      beta: number;
    };
    detection_probability: number;
    failure: {
      maintenance_deficit_threshold: number;
      failure_probability_increase_per_season: number;
      rebuild_cost_person_seasons: number;
    };
    yield: {
      full_allotment_yield: number;
      diminishing_returns_above_allotment: boolean;
    };
  };
  outputs: {
    csv_schema: {
      agent_season: string[];
      run_summary: string[];
    };
  };
}
