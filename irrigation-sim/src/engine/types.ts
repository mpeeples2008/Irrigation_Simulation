export type StrategyName = "reciprocal" | "upstream_pressure" | "downstream_retaliation";
export type TopologyType = "linear";
export type AgentRole = "student" | "ai";
export type OutcomeState = "in_progress" | "win" | "loss";
export type TurnPhase = "water" | "maintenance";

export interface PlayerDecision {
  withdrawal?: number;
  maintenance?: number;
}

export interface AgentDecision extends PlayerDecision {
  maintenanceContributed: boolean;
  tookExtra: boolean;
}

export interface SimulationPreset {
  scenario: string;
  seasonsPerRun: number;
  nAgents: number;
  topology: TopologyType;
  conveyanceLoss: number;
  baseSupply: number;
  supplyVariance: number;
  rainfallVariabilityEnabled: boolean;
  studentPosition: number;
  fairTake: number;
  maxTake: number;
  fairMaintenance: number;
  maxMaintenance: number;
  aiCooperativeness: number;
  aiCompetitiveness: number;
  fullAllotmentYield: number;
  canalDecay: number;
  criticalStressSeasons: number;
}

export interface AgentState {
  agentId: string;
  role: AgentRole;
  position: number;
  strategy: StrategyName | "student_controlled";
  reputation: number;
  wealth: number;
  cumulativeYield: number;
  waterStress: number;
}

export interface StatusMetrics {
  canalCondition: number;
  downstreamStress: number;
  groupTrust: number;
}

export interface StatusPoint extends StatusMetrics {
  season: number;
}

export interface RevealedWithdrawal {
  agent_id: string;
  role: AgentRole;
  position: number;
  withdrawal: number;
  above_fair: number;
}

export interface PendingSeasonData {
  season: number;
  supply: number;
  lowSupply: boolean;
  withdrawals: Record<string, number>;
  revealedWithdrawals: RevealedWithdrawal[];
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
  turnPhase: TurnPhase;
  pendingSeason?: PendingSeasonData;
  pendingStudentDecision?: PlayerDecision;
  lastCooperationRate: number;
  criticalStressStreak: number;
  nFailures: number;
  lowSupplyEvents: number;
  contributorCountSum: number;
  status: StatusMetrics;
  statusHistory: StatusPoint[];
  lastStatusDelta: StatusMetrics;
  retaliationPressure: number;
  outcome: OutcomeState;
  lastNarrative: string;
  lastFeedback: string;
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
  narrative: string;
  feedback: string;
  status: StatusMetrics;
  statusDelta: StatusMetrics;
  outcome: OutcomeState;
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
  studentPosition?: number;
}
