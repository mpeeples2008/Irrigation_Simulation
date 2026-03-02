import React, { useMemo, useState } from "react";
import {
  buildRunResultFromState,
  createInitialState,
  exportAgentsCSV,
  exportRunSummaryCSV,
  stepSeason
} from "../engine/engine";
import presetsJson from "../engine/presets.json";
import { calculateGini } from "../engine/utils";
import { SimulationState } from "../engine/types";
import AgentDashboard from "./components/AgentDashboard";
import AIResponsePanel from "./components/AIResponsePanel";
import AnalyticsPanel from "./components/AnalyticsPanel";
import CanalViewer from "./components/CanalViewer";
import CommandBar from "./components/CommandBar";
import DecisionPanel from "./components/DecisionPanel";
import ScenarioSelector, { ScenarioOption } from "./components/ScenarioSelector";
import TopFeedbackStrip from "./components/TopFeedbackStrip";

const ETHICS_BLURB =
  "This classroom simulation is an educational model inspired by archaeological and ethnographic research on irrigation systems in the US Southwest. It draws on published scholarship and is intended for pedagogical use only. The simulation simplifies social and ecological complexity for learning and does not represent contemporary O'odham knowledge in full. Instructors who plan to publish or publicly share this activity are strongly encouraged to consult with tribal communities or tribal cultural offices. Primary academic sources used in development are listed in /spec/bibliography.md.";

const profileOptions: ScenarioOption[] = [
  {
    key: "balanced_profile",
    label: "Balanced Preset",
    vignette: "Neutral defaults for most classroom runs."
  },
  {
    key: "cooperative_profile",
    label: "Cooperative Preset",
    vignette: "Higher AI cooperation and softer competition."
  },
  {
    key: "competitive_profile",
    label: "Competitive Preset",
    vignette: "Higher extraction pressure and lower baseline cooperation."
  }
];

const presetMap = presetsJson as Record<string, Record<string, unknown>>;
const DEFAULT_PROFILE = "balanced_profile";
const DEFAULT_SEED = 42;

interface TuningState {
  rainfallVariabilityEnabled: boolean;
  supplyVariance: number;
  aiCooperativeness: number;
  aiCompetitiveness: number;
}

function readPreset(profileKey: string): Record<string, unknown> {
  return presetMap[profileKey] ?? presetMap[DEFAULT_PROFILE];
}

function readTuningFromPreset(profileKey: string): TuningState {
  const preset = readPreset(profileKey);
  return {
    rainfallVariabilityEnabled: Boolean(preset.rainfallVariabilityEnabled ?? true),
    supplyVariance: Number(preset.supplyVariance ?? 20),
    aiCooperativeness: Math.round(Number(preset.aiCooperativeness ?? 0.5) * 100),
    aiCompetitiveness: Math.round(Number(preset.aiCompetitiveness ?? 0.5) * 100)
  };
}

function buildPresetWithTuning(
  profileKey: string,
  tuning: TuningState,
  position: number
): Record<string, unknown> {
  const base = readPreset(profileKey);
  return {
    ...base,
    studentPosition: position,
    rainfallVariabilityEnabled: tuning.rainfallVariabilityEnabled,
    supplyVariance: tuning.supplyVariance,
    aiCooperativeness: tuning.aiCooperativeness / 100,
    aiCompetitiveness: tuning.aiCompetitiveness / 100
  };
}

function buildInitialState(
  profileKey: string,
  seed: number,
  position: number,
  tuning: TuningState
): SimulationState {
  const preset = buildPresetWithTuning(profileKey, tuning, position);
  return createInitialState(preset, seed, {
    scenarioName: String(preset.scenario ?? profileKey),
    runId: `run-${seed}-${profileKey}`,
    studentPosition: position
  });
}

function positionLabel(index: number, nAgents: number): string {
  if (index === 0) {
    return `${index} (Most upstream)`;
  }
  if (index === nAgents - 1) {
    return `${index} (Most downstream)`;
  }
  return `${index} (Midstream)`;
}

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

export default function App(): JSX.Element {
  const initialTuning = readTuningFromPreset(DEFAULT_PROFILE);
  const initialState = buildInitialState(DEFAULT_PROFILE, DEFAULT_SEED, 2, initialTuning);

  const [showEthicsModal, setShowEthicsModal] = useState(true);
  const [seed, setSeed] = useState<number>(DEFAULT_SEED);
  const [selectedProfile, setSelectedProfile] = useState<string>(DEFAULT_PROFILE);
  const [selectedPosition, setSelectedPosition] = useState<number>(
    initialState.agents.find((agent) => agent.role === "student")?.position ?? 2
  );
  const [tuning, setTuning] = useState<TuningState>(initialTuning);
  const [withdrawal, setWithdrawal] = useState<number>(initialState.preset.fairTake);
  const [maintenance, setMaintenance] = useState<number>(initialState.preset.fairMaintenance);
  const [decisionLocked, setDecisionLocked] = useState<boolean>(false);
  const [state, setState] = useState<SimulationState>(initialState);

  const latestSeasonRecords = state.history.filter((record) => record.season === state.currentSeason);
  const pendingSeasonNumber = Math.min(state.currentSeason + 1, state.preset.seasonsPerRun);
  const inWaterPhase = state.turnPhase === "water";
  const phaseLabel = inWaterPhase ? "Water phase" : "Maintenance phase";
  const runResult = useMemo(() => buildRunResultFromState(state), [state]);
  const topSeries = useMemo(() => {
    const perSeason = new Map<number, typeof state.history>();
    for (const record of state.history) {
      const existing = perSeason.get(record.season) ?? [];
      existing.push(record);
      perSeason.set(record.season, existing);
    }
    const seasons = [...perSeason.keys()].sort((a, b) => a - b);
    const studentYieldSeries =
      seasons.length === 0
        ? [0]
        : seasons.map((season) => {
            const student = perSeason.get(season)?.find((row) => row.role === "student");
            return student?.yield ?? 0;
          });
    const studentWealthSeries =
      seasons.length === 0
        ? [0]
        : seasons.map((season) => {
            const student = perSeason.get(season)?.find((row) => row.role === "student");
            return student?.wealth ?? 0;
          });
    const communityWealthSeries =
      seasons.length === 0
        ? [0]
        : seasons.map((season) =>
            (perSeason.get(season) ?? []).reduce((sum, row) => sum + row.wealth, 0)
          );
    const giniSeries =
      seasons.length === 0
        ? [0]
        : seasons.map((season) =>
            calculateGini((perSeason.get(season) ?? []).map((row) => row.yield))
          );
    const canalSeries = state.statusHistory.map((point) => point.canalCondition);
    const stressSeries = state.statusHistory.map((point) => point.downstreamStress);
    const trustSeries = state.statusHistory.map((point) => point.groupTrust);
    const groupScoreSeries = state.statusHistory.map((point) =>
      (point.canalCondition + (100 - point.downstreamStress) + point.groupTrust) / 3
    );
    return {
      communityWealthSeries,
      studentYieldSeries,
      studentWealthSeries,
      giniSeries,
      canalSeries,
      stressSeries,
      trustSeries,
      groupScoreSeries
    };
  }, [state.history, state.statusHistory]);

  const done = state.outcome !== "in_progress";

  const applyTuningAndReset = (
    nextSeed = seed,
    profile = selectedProfile,
    position = selectedPosition,
    nextTuning = tuning
  ): void => {
    const newState = buildInitialState(profile, nextSeed, position, nextTuning);
    setState(newState);
    setWithdrawal(newState.preset.fairTake);
    setMaintenance(newState.preset.fairMaintenance);
    setDecisionLocked(false);
  };

  const handleSubmit = (): void => {
    if (done || !decisionLocked) {
      return;
    }
    const pendingStudentDecision = inWaterPhase ? { withdrawal } : { maintenance };
    const seasonResult = stepSeason({ ...state, pendingStudentDecision });
    const nextState = seasonResult.state;
    setState(nextState);
    if (inWaterPhase) {
      setMaintenance(nextState.preset.fairMaintenance);
    } else {
      setWithdrawal(nextState.preset.fairTake);
      setMaintenance(nextState.preset.fairMaintenance);
    }
    setDecisionLocked(false);
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
        <h1>Irrigation Survival (Tunable)</h1>
        <p>
          Goal: survive <strong>{state.preset.seasonsPerRun}</strong> seasons by balancing fair use,
          maintenance, and coordination.
        </p>
        <p>
          Seed: <strong>{state.seed}</strong> | Completed seasons: <strong>{state.currentSeason}</strong>/
          {state.preset.seasonsPerRun}
        </p>
        <p>
          Active step: <strong>Season {pendingSeasonNumber}</strong> ({phaseLabel})
        </p>
      </header>
      <CommandBar
        seasonNumber={pendingSeasonNumber}
        maxSeasons={state.preset.seasonsPerRun}
        phaseLabel={phaseLabel}
        inWaterPhase={inWaterPhase}
        withdrawal={withdrawal}
        maintenance={maintenance}
        fairTake={state.preset.fairTake}
        fairMaintenance={state.preset.fairMaintenance}
        decisionLocked={decisionLocked}
        disabled={done}
        onLockDecision={() => setDecisionLocked(true)}
        onSubmit={handleSubmit}
      />

      <TopFeedbackStrip
        season={state.currentSeason}
        maxSeasons={state.preset.seasonsPerRun}
        outcome={state.outcome}
        communityWealthSeries={topSeries.communityWealthSeries}
        studentYieldSeries={topSeries.studentYieldSeries}
        studentWealthSeries={topSeries.studentWealthSeries}
        groupScoreSeries={topSeries.groupScoreSeries}
        giniSeries={topSeries.giniSeries}
        canalSeries={topSeries.canalSeries}
        stressSeries={topSeries.stressSeries}
        trustSeries={topSeries.trustSeries}
      />

      <div className="layout-grid">
        <ScenarioSelector
          options={profileOptions}
          selectedKey={selectedProfile}
          onScenarioChange={(key) => {
            const presetTuning = readTuningFromPreset(key);
            const defaultPosition = Number(readPreset(key).studentPosition ?? 2);
            setSelectedProfile(key);
            setSelectedPosition(defaultPosition);
            setTuning(presetTuning);
            applyTuningAndReset(seed, key, defaultPosition, presetTuning);
          }}
        />

        <section className="panel">
          <h2>Simulation Controls</h2>
          <label htmlFor="seed-input" className="control-label">
            Seed
          </label>
          <input
            id="seed-input"
            type="number"
            value={seed}
            onChange={(event) => setSeed(Number(event.target.value))}
          />

          <label htmlFor="position-select" className="control-label">
            Your canal position
          </label>
          <select
            id="position-select"
            value={selectedPosition}
            onChange={(event) => setSelectedPosition(Number(event.target.value))}
          >
            {Array.from({ length: state.preset.nAgents }, (_, index) => (
              <option key={index} value={index}>
                {positionLabel(index, state.preset.nAgents)}
              </option>
            ))}
          </select>

          <label className="control-label">
            <input
              type="checkbox"
              checked={tuning.rainfallVariabilityEnabled}
              onChange={(event) =>
                setTuning((prev) => ({
                  ...prev,
                  rainfallVariabilityEnabled: event.target.checked
                }))
              }
            />
            Enable rainfall variability
          </label>

          <label htmlFor="variance-range" className="control-label">
            Rainfall variability: {tuning.supplyVariance.toFixed(0)}
          </label>
          <input
            id="variance-range"
            type="range"
            min={0}
            max={35}
            step={1}
            value={tuning.supplyVariance}
            disabled={!tuning.rainfallVariabilityEnabled}
            onChange={(event) =>
              setTuning((prev) => ({
                ...prev,
                supplyVariance: Number(event.target.value)
              }))
            }
          />

          <label htmlFor="coop-range" className="control-label">
            AI cooperativeness standard: {tuning.aiCooperativeness}
          </label>
          <input
            id="coop-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={tuning.aiCooperativeness}
            onChange={(event) =>
              setTuning((prev) => ({
                ...prev,
                aiCooperativeness: Number(event.target.value)
              }))
            }
          />

          <label htmlFor="comp-range" className="control-label">
            AI competitiveness standard: {tuning.aiCompetitiveness}
          </label>
          <input
            id="comp-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={tuning.aiCompetitiveness}
            onChange={(event) =>
              setTuning((prev) => ({
                ...prev,
                aiCompetitiveness: Number(event.target.value)
              }))
            }
          />

          <div className="actions">
            <button
              type="button"
              onClick={() => applyTuningAndReset(seed, selectedProfile, selectedPosition, tuning)}
            >
              Apply Tuning and Reset
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                const presetTuning = readTuningFromPreset(selectedProfile);
                setTuning(presetTuning);
                applyTuningAndReset(seed, selectedProfile, selectedPosition, presetTuning);
              }}
            >
              Reset to Profile Defaults
            </button>
          </div>
          {done && (
            <p className={`outcome ${state.outcome}`}>
              {state.outcome === "win"
                ? "You kept the system alive through all seasons."
                : "The system collapsed before stable coordination held."}
            </p>
          )}
        </section>

        <DecisionPanel
          turnPhase={state.turnPhase}
          seasonNumber={pendingSeasonNumber}
          withdrawal={withdrawal}
          maintenance={maintenance}
          fairTake={state.preset.fairTake}
          maxTake={state.preset.maxTake}
          fairMaintenance={state.preset.fairMaintenance}
          maxMaintenance={state.preset.maxMaintenance}
          lastResolvedSeason={state.currentSeason}
          lastFeedback={state.lastFeedback}
          statusDelta={state.lastStatusDelta}
          revealedWithdrawals={state.pendingSeason?.revealedWithdrawals ?? []}
          revealedSupply={state.pendingSeason?.supply}
          revealedLowSupply={state.pendingSeason?.lowSupply ?? false}
          onWithdrawalChange={(value) => {
            setWithdrawal(value);
            setDecisionLocked(false);
          }}
          onMaintenanceChange={(value) => {
            setMaintenance(value);
            setDecisionLocked(false);
          }}
        />
      </div>

      <AIResponsePanel
        latestSeasonRecords={latestSeasonRecords}
        fairTake={state.preset.fairTake}
        retaliationPressure={state.retaliationPressure}
      />

      <CanalViewer
        agents={state.agents}
        latestSeasonRecords={latestSeasonRecords}
        season={state.currentSeason}
        canalCondition={state.status.canalCondition}
        downstreamStress={state.status.downstreamStress}
      />

      <AgentDashboard latestSeasonRecords={latestSeasonRecords} />

      <AnalyticsPanel
        status={state.status}
        statusDelta={state.lastStatusDelta}
        narrative={state.lastNarrative}
        feedback={state.lastFeedback}
        outcome={state.outcome}
        canDownload={state.history.length > 0}
        onDownloadAgents={() => downloadCsv("agents-per-season.csv", exportAgentsCSV(runResult))}
        onDownloadSummary={() => downloadCsv("run-summary.csv", exportRunSummaryCSV(runResult))}
      />
    </main>
  );
}
