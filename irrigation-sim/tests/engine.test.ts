import {
  AGENT_SEASON_COLUMNS,
  RUN_SUMMARY_COLUMNS,
  exportAgentsCSV,
  exportRunSummaryCSV,
  routeWaterLinear,
  runSimulation,
  updateReputation
} from "../src/engine/engine";
import { AgentDecision, AgentState, SimulationPreset } from "../src/engine/types";

const testPreset: Partial<SimulationPreset> = {
  scenario: "Test Scenario",
  nAgents: 3,
  seasonsPerRun: 3,
  topology: "linear",
  conveyanceLoss: 0.06,
  strategyMix: ["always_cooperate", "always_defect"],
  studentPosition: 1
};

describe("engine", () => {
  test("routing yields expected water in trivial 3-agent linear setup", () => {
    const agents: AgentState[] = [
      {
        agentId: "a1",
        role: "ai",
        position: 0,
        strategy: "always_cooperate",
        reputation: 1,
        wealth: 0,
        cumulativeYield: 0
      },
      {
        agentId: "a2",
        role: "student",
        position: 1,
        strategy: "student_controlled",
        reputation: 1,
        wealth: 0,
        cumulativeYield: 0
      },
      {
        agentId: "a3",
        role: "ai",
        position: 2,
        strategy: "always_defect",
        reputation: 1,
        wealth: 0,
        cumulativeYield: 0
      }
    ];

    const decisions: Record<string, AgentDecision> = {
      a1: {
        withdrawalChoice: "medium",
        maintenanceChoice: "contribute",
        withdrawalAmount: 10,
        maintenanceContributed: true
      },
      a2: {
        withdrawalChoice: "medium",
        maintenanceChoice: "contribute",
        withdrawalAmount: 10,
        maintenanceContributed: true
      },
      a3: {
        withdrawalChoice: "medium",
        maintenanceChoice: "contribute",
        withdrawalAmount: 10,
        maintenanceContributed: true
      }
    };

    const received = routeWaterLinear(agents, decisions, 30, 0.1);
    expect(received.a1).toBeCloseTo(10, 4);
    expect(received.a2).toBeCloseTo(10, 4);
    expect(received.a3).toBeCloseTo(7.2, 4);
  });

  test("reputation updates apply contribution increase and detected defection decrease", () => {
    const afterContribution = updateReputation(1, true, false, 0.1, 0.2);
    expect(afterContribution).toBeCloseTo(1.1, 4);
    const afterDetection = updateReputation(afterContribution, false, true, 0.1, 0.2);
    expect(afterDetection).toBeCloseTo(0.9, 4);
  });

  test("simulation is deterministic for same seed and decisions", () => {
    const decisions = [
      { withdrawalChoice: "low" as const, maintenanceChoice: "contribute" as const },
      { withdrawalChoice: "medium" as const, maintenanceChoice: "contribute" as const },
      { withdrawalChoice: "high" as const, maintenanceChoice: "skip" as const }
    ];
    const runA = runSimulation(testPreset, 42, { playerDecisions: decisions, runId: "deterministic-run" });
    const runB = runSimulation(testPreset, 42, { playerDecisions: decisions, runId: "deterministic-run" });

    expect(runA.records).toEqual(runB.records);
    expect(exportAgentsCSV(runA)).toBe(exportAgentsCSV(runB));
    expect(exportRunSummaryCSV(runA)).toBe(exportRunSummaryCSV(runB));
  });

  test("CSV exports match schema headers and contain parseable typed values", () => {
    const run = runSimulation(testPreset, 42, { runId: "csv-run" });
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
