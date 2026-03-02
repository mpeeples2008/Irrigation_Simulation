import {
  AGENT_SEASON_COLUMNS,
  RUN_SUMMARY_COLUMNS,
  createInitialState,
  exportAgentsCSV,
  exportRunSummaryCSV,
  routeWaterLinear,
  runSimulation,
  stepSeason
} from "../src/engine/engine";
import { AgentDecision, AgentState, SimulationPreset } from "../src/engine/types";

const testPreset: Partial<SimulationPreset> = {
  scenario: "Numeric Test",
  seasonsPerRun: 4,
  nAgents: 6,
  conveyanceLoss: 0.08,
  baseSupply: 90,
  supplyVariance: 20,
  studentPosition: 2,
  fairTake: 12,
  maxTake: 24,
  fairMaintenance: 1,
  maxMaintenance: 3
};

describe("simplified numeric engine", () => {
  const resolveSeason = (
    state: ReturnType<typeof createInitialState>,
    withdrawal: number,
    maintenance: number
  ) => {
    const waterPhase = stepSeason({
      ...state,
      pendingStudentDecision: { withdrawal }
    });
    const maintenancePhase = stepSeason({
      ...waterPhase.state,
      pendingStudentDecision: { maintenance }
    });
    return { waterPhase, maintenancePhase };
  };

  test("routing yields expected water in a 3-agent linear setup", () => {
    const agents: AgentState[] = [
      {
        agentId: "a1",
        role: "ai",
        position: 0,
        strategy: "upstream_pressure",
        reputation: 1,
        wealth: 0,
        cumulativeYield: 0,
        waterStress: 0
      },
      {
        agentId: "a2",
        role: "student",
        position: 1,
        strategy: "student_controlled",
        reputation: 1,
        wealth: 0,
        cumulativeYield: 0,
        waterStress: 0
      },
      {
        agentId: "a3",
        role: "ai",
        position: 2,
        strategy: "downstream_retaliation",
        reputation: 1,
        wealth: 0,
        cumulativeYield: 0,
        waterStress: 0
      }
    ];

    const decisions: Record<string, AgentDecision> = {
      a1: {
        withdrawal: 10,
        maintenance: 1,
        maintenanceContributed: true,
        tookExtra: false
      },
      a2: {
        withdrawal: 10,
        maintenance: 1,
        maintenanceContributed: true,
        tookExtra: false
      },
      a3: {
        withdrawal: 10,
        maintenance: 1,
        maintenanceContributed: true,
        tookExtra: false
      }
    };

    const received = routeWaterLinear(agents, decisions, 30, 0.1);
    expect(received.a1).toBeCloseTo(10, 4);
    expect(received.a2).toBeCloseTo(10, 4);
    expect(received.a3).toBeCloseTo(7.2, 4);
  });

  test("taking above fair and skipping maintenance worsens stress and trust", () => {
    const cooperativeStart = createInitialState(testPreset, 77, {
      runId: "cooperative",
      studentPosition: 2
    });
    const selfishStart = createInitialState(testPreset, 77, {
      runId: "selfish",
      studentPosition: 2
    });

    const cooperative = resolveSeason(cooperativeStart, 12, 1).maintenancePhase;
    const selfish = resolveSeason(selfishStart, 24, 0).maintenancePhase;

    expect(selfish.status.downstreamStress).toBeGreaterThan(cooperative.status.downstreamStress);
    expect(selfish.status.groupTrust).toBeLessThan(cooperative.status.groupTrust);
    expect(selfish.feedback).toContain("fair");
  });

  test("selfish behavior in season 1 triggers stronger AI retaliation in season 2", () => {
    const cooperativeStart = createInitialState(testPreset, 81, {
      runId: "cooperative-retaliation",
      studentPosition: 2
    });
    const selfishStart = createInitialState(testPreset, 81, {
      runId: "selfish-retaliation",
      studentPosition: 2
    });

    const cooperativeSeason1 = resolveSeason(cooperativeStart, 12, 1).maintenancePhase;
    const selfishSeason1 = resolveSeason(selfishStart, 24, 0).maintenancePhase;

    const cooperativeSeason2 = resolveSeason(cooperativeSeason1.state, 12, 1).maintenancePhase;
    const selfishSeason2 = resolveSeason(selfishSeason1.state, 12, 1).maintenancePhase;

    const avgAiWithdrawal = (records: typeof cooperativeSeason2.records): number => {
      const aiRows = records.filter((row) => row.role === "ai");
      return aiRows.reduce((sum, row) => sum + row.withdrawal, 0) / aiRows.length;
    };

    expect(selfishSeason1.state.retaliationPressure).toBeGreaterThan(
      cooperativeSeason1.state.retaliationPressure
    );
    expect(avgAiWithdrawal(selfishSeason2.records)).toBeGreaterThan(
      avgAiWithdrawal(cooperativeSeason2.records)
    );
  });

  test("simulation is deterministic with same seed and numeric decision script", () => {
    const decisions = [
      { withdrawal: 12, maintenance: 1 },
      { withdrawal: 16, maintenance: 0.5 },
      { withdrawal: 10, maintenance: 1.3 }
    ];

    const runA = runSimulation(testPreset, 42, {
      runId: "deterministic-run",
      playerDecisions: decisions,
      studentPosition: 2
    });
    const runB = runSimulation(testPreset, 42, {
      runId: "deterministic-run",
      playerDecisions: decisions,
      studentPosition: 2
    });

    expect(runA.records).toEqual(runB.records);
    expect(exportAgentsCSV(runA)).toBe(exportAgentsCSV(runB));
    expect(exportRunSummaryCSV(runA)).toBe(exportRunSummaryCSV(runB));
  });

  test("rainfall variability toggle off keeps seasonal supply fixed at baseSupply", () => {
    const state = createInitialState(
      {
        ...testPreset,
        baseSupply: 87,
        supplyVariance: 30,
        rainfallVariabilityEnabled: false
      },
      99,
      { runId: "fixed-rainfall", studentPosition: 2 }
    );
    const season = stepSeason({
      ...state,
      pendingStudentDecision: { withdrawal: 12 }
    });

    expect(season.supply).toBeCloseTo(87, 4);
    expect(season.drought).toBe(false);
    expect(season.state.turnPhase).toBe("maintenance");
    expect(season.records.length).toBe(0);
  });

  test("AI standards tuning changes AI extraction behavior", () => {
    const cooperative = createInitialState(
      {
        ...testPreset,
        aiCooperativeness: 0.85,
        aiCompetitiveness: 0.2
      },
      66,
      { runId: "ai-cooperative", studentPosition: 2 }
    );
    const competitive = createInitialState(
      {
        ...testPreset,
        aiCooperativeness: 0.2,
        aiCompetitiveness: 0.9
      },
      66,
      { runId: "ai-competitive", studentPosition: 2 }
    );

    const coopSeason = resolveSeason(cooperative, 12, 1).maintenancePhase;
    const compSeason = resolveSeason(competitive, 12, 1).maintenancePhase;

    const avgAiWithdrawal = (records: typeof coopSeason.records): number => {
      const aiRows = records.filter((row) => row.role === "ai");
      return aiRows.reduce((sum, row) => sum + row.withdrawal, 0) / aiRows.length;
    };

    expect(avgAiWithdrawal(compSeason.records)).toBeGreaterThan(avgAiWithdrawal(coopSeason.records));
  });

  test("CSV exports preserve schema headers and parseable numeric fields", () => {
    const run = runSimulation(testPreset, 42, { runId: "csv-run", studentPosition: 2 });
    const agentsCsv = exportAgentsCSV(run).trim();
    const runSummaryCsv = exportRunSummaryCSV(run).trim();

    const [agentHeader, firstAgentRow] = agentsCsv.split("\n");
    const [summaryHeader, firstSummaryRow] = runSummaryCsv.split("\n");
    expect(agentHeader.split(",")).toEqual(AGENT_SEASON_COLUMNS);
    expect(summaryHeader.split(",")).toEqual(RUN_SUMMARY_COLUMNS);

    const agentCells = firstAgentRow.split(",");
    expect(Number.isFinite(Number(agentCells[1]))).toBe(true);
    expect(Number.isFinite(Number(agentCells[6]))).toBe(true);
    expect(["student", "ai"].includes(agentCells[3])).toBe(true);

    const summaryCells = firstSummaryRow.split(",");
    expect(Number.isFinite(Number(summaryCells[2]))).toBe(true);
    expect(Number.isFinite(Number(summaryCells[5]))).toBe(true);
  });
});
