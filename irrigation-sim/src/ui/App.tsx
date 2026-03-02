import React, { useMemo, useState } from "react";
import specJson from "../../spec/spec.json";
import {
  buildRunResultFromState,
  createInitialState,
  exportAgentsCSV,
  exportRunSummaryCSV,
  runSimulation,
  stepSeason
} from "../engine/engine";
import presetsJson from "../engine/presets.json";
import { MaintenanceChoice, SimulationState, TopologyType, WithdrawalChoice } from "../engine/types";
import AgentDashboard from "./components/AgentDashboard";
import AnalyticsPanel from "./components/AnalyticsPanel";
import CanalViewer from "./components/CanalViewer";
import DecisionPanel from "./components/DecisionPanel";
import ScenarioSelector, { ScenarioOption } from "./components/ScenarioSelector";

const ETHICS_BLURB =
  "This classroom simulation is an educational model inspired by archaeological and ethnographic research on irrigation systems in the US Southwest. It draws on published scholarship and is intended for pedagogical use only. The simulation simplifies social and ecological complexity for learning and does not represent contemporary O’odham knowledge in full. Instructors who plan to publish or publicly share this activity are strongly encouraged to consult with tribal communities or tribal cultural offices. Primary academic sources used in development are listed in /spec/bibliography.md.";

const scenarioOptions: ScenarioOption[] = [
  {
    key: "weak_rules_intro",
    label: "Scenario 1 - Weak Rules",
    vignette:
      "You are a household in a small Middle Gila canal community with informal cleaning and weak labor enforcement."
  },
  {
    key: "ritual_reputation",
    label: "Scenario 2 - Ritual and Reputation",
    vignette:
      "Annual communal cleaning and labor schedules are established; reputation and social sanctions shape choices."
  },
  {
    key: "drought_stress",
    label: "Scenario 3 - Drought Stress",
    vignette:
      "Repeated low-flow years stress the network and maintenance deficits can trigger costly failures."
  }
];

const spec = specJson as {
  simulation: {
    seed_default: number;
  };
};

const presetMap = presetsJson as Record<string, Record<string, unknown>>;

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildInitialState(
  presetKey: string,
  seed: number,
  topologyOverride?: TopologyType
): SimulationState {
  const selectedPreset = presetMap[presetKey] ?? presetMap.weak_rules_intro;
  const preset = {
    ...selectedPreset,
    ...(topologyOverride ? { topology: topologyOverride } : {})
  };
  return createInitialState(preset, seed, {
    scenarioName: String(selectedPreset.scenario ?? presetKey),
    runId: `run-${seed}-${presetKey}`
  });
}

export default function App(): JSX.Element {
  const [showEthicsModal, setShowEthicsModal] = useState<boolean>(true);
  const [seed, setSeed] = useState<number>(spec.simulation.seed_default);
  const [batchCount, setBatchCount] = useState<number>(50);
  const [selectedScenario, setSelectedScenario] = useState<string>("weak_rules_intro");
  const [topology, setTopology] = useState<TopologyType>(
    (presetMap.weak_rules_intro.topology as TopologyType | undefined) ?? "linear"
  );
  const [withdrawalChoice, setWithdrawalChoice] = useState<WithdrawalChoice | "">("");
  const [maintenanceChoice, setMaintenanceChoice] = useState<MaintenanceChoice | "">("");
  const [batchSummaryText, setBatchSummaryText] = useState<string>("");
  const [state, setState] = useState<SimulationState>(() =>
    buildInitialState("weak_rules_intro", spec.simulation.seed_default, topology)
  );

  const latestSeason = state.currentSeason;
  const done = latestSeason >= state.preset.seasonsPerRun;
  const latestSeasonRecords = state.history.filter((record) => record.season === state.currentSeason);
  const warning = batchCount > 200 ? "Large batches can increase browser memory use." : "";

  const runResult = useMemo(() => buildRunResultFromState(state), [state]);

  const resetRun = (nextSeed = seed, nextScenario = selectedScenario, nextTopology = topology): void => {
    setState(buildInitialState(nextScenario, nextSeed, nextTopology));
    setWithdrawalChoice("");
    setMaintenanceChoice("");
    setBatchSummaryText("");
  };

  const handleSubmit = (): void => {
    if (done || !withdrawalChoice || !maintenanceChoice) {
      return;
    }
    const seasonResult = stepSeason({
      ...state,
      pendingStudentDecision: {
        withdrawalChoice,
        maintenanceChoice
      }
    });
    setState(seasonResult.state);
  };

  const runBatch = (): void => {
    const safeCount = Math.max(1, Math.min(500, batchCount));
    const selectedPreset = {
      ...(presetMap[selectedScenario] ?? presetMap.weak_rules_intro),
      topology
    };
    const summaries = [];
    for (let i = 0; i < safeCount; i += 1) {
      const batchSeed = seed + i;
      const result = runSimulation(selectedPreset, batchSeed, {
        runId: `batch-${batchSeed}-${selectedScenario}`,
        scenarioName: String((selectedPreset.scenario as string | undefined) ?? selectedScenario)
      });
      summaries.push(result.summary);
    }
    const meanYield =
      summaries.reduce((sum, row) => sum + row.total_yield, 0) / Math.max(1, summaries.length);
    const meanFailures =
      summaries.reduce((sum, row) => sum + row.n_failures, 0) / Math.max(1, summaries.length);
    const header =
      "run_id,scenario,seed,n_agents,n_contributors_mean,total_yield,gini_yield,student_final_wealth,n_failures,drought_events,notes";
    const body = summaries
      .map((row) =>
        [
          row.run_id,
          row.scenario,
          row.seed,
          row.n_agents,
          row.n_contributors_mean,
          row.total_yield,
          row.gini_yield,
          row.student_final_wealth,
          row.n_failures,
          row.drought_events,
          row.notes
        ].join(",")
      )
      .join("\n");
    downloadCsv("batch-run-summary.csv", `${header}\n${body}\n`);
    setBatchSummaryText(
      `Batch completed (${safeCount} runs). Mean total yield ${meanYield.toFixed(
        2
      )}, mean failures ${meanFailures.toFixed(2)}.`
    );
  };

  return (
    <main className="app">
      {showEthicsModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ethics-title">
          <div className="modal">
            <h1 id="ethics-title">Educational Use Notice</h1>
            <p>{ETHICS_BLURB}</p>
            <button type="button" onClick={() => setShowEthicsModal(false)}>
              Continue
            </button>
          </div>
        </div>
      )}
      <header>
        <h1>Irrigation Simulation - Single-Player Teaching App</h1>
        <p>
          Seed: <strong>{state.seed}</strong> | Season: <strong>{state.currentSeason}</strong>/
          {state.preset.seasonsPerRun}
        </p>
      </header>

      <div className="layout-grid">
        <ScenarioSelector
          options={scenarioOptions}
          selectedKey={selectedScenario}
          topology={topology}
          onScenarioChange={(key) => {
            setSelectedScenario(key);
            const selected = presetMap[key];
            const presetTopology = (selected?.topology as TopologyType | undefined) ?? "linear";
            setTopology(presetTopology);
            resetRun(seed, key, presetTopology);
          }}
          onTopologyChange={(nextTopology) => {
            setTopology(nextTopology);
            resetRun(seed, selectedScenario, nextTopology);
          }}
        />

        <section className="panel">
          <h2>Run Controls</h2>
          <label htmlFor="seed-input" className="control-label">
            Seed
          </label>
          <input
            id="seed-input"
            type="number"
            value={seed}
            onChange={(event) => setSeed(Number(event.target.value))}
          />
          <button type="button" onClick={() => resetRun(seed, selectedScenario, topology)}>
            Reset with Seed
          </button>

          <label htmlFor="batch-input" className="control-label">
            Batch runs (1-500)
          </label>
          <input
            id="batch-input"
            type="number"
            min={1}
            max={500}
            value={batchCount}
            onChange={(event) => setBatchCount(Number(event.target.value))}
          />
          {warning && <p className="warning">{warning}</p>}
          <button type="button" onClick={runBatch}>
            Run Batch and Download Summary
          </button>
          {batchSummaryText && <p className="small-note">{batchSummaryText}</p>}
        </section>

        <DecisionPanel
          withdrawalChoice={withdrawalChoice}
          maintenanceChoice={maintenanceChoice}
          disabled={done || !withdrawalChoice || !maintenanceChoice}
          onWithdrawalChange={setWithdrawalChoice}
          onMaintenanceChange={setMaintenanceChoice}
          onSubmit={handleSubmit}
        />
      </div>

      <CanalViewer
        agents={state.agents}
        latestSeasonRecords={latestSeasonRecords}
        topology={topology}
        season={state.currentSeason}
      />
      <AgentDashboard latestSeasonRecords={latestSeasonRecords} />
      <AnalyticsPanel
        records={state.history}
        onDownloadAgents={() => downloadCsv("agents-per-season.csv", exportAgentsCSV(runResult))}
        onDownloadSummary={() => downloadCsv("run-summary.csv", exportRunSummaryCSV(runResult))}
      />
    </main>
  );
}
