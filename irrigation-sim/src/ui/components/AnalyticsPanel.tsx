import React from "react";
import { OutcomeState, StatusMetrics } from "../../engine/types";

type LearningGoalKey = "equity_guardian" | "canal_steward" | "trust_builder";

interface LearningGoalOption {
  key: LearningGoalKey;
  label: string;
  description: string;
}

interface GoalEvaluation {
  score: number;
  grade: "A" | "B" | "C" | "Needs work";
  passed: boolean;
  summary: string;
}

interface RoleReplayRow {
  position: number;
  positionLabel: string;
  outcome: "win" | "loss";
  studentFinalWealth: number;
  totalYield: number;
  giniYield: number;
  canalCondition: number;
  downstreamStress: number;
  groupTrust: number;
}

interface AnalyticsPanelProps {
  status: StatusMetrics;
  narrative: string;
  feedback: string;
  statusDelta: StatusMetrics;
  outcome: OutcomeState;
  learningGoals: LearningGoalOption[];
  selectedGoal: LearningGoalKey;
  onGoalChange: (key: LearningGoalKey) => void;
  goalEvaluation: GoalEvaluation;
  debriefPoints: string[];
  replayRows: RoleReplayRow[];
  replayBaselinePosition: number;
  canRunReplay: boolean;
  onRunReplay: () => void;
  onDownloadAgents: () => void;
  onDownloadSummary: () => void;
  canDownload: boolean;
}

function metricClass(value: number, kind: "normal" | "inverse"): string {
  const score = kind === "inverse" ? 100 - value : value;
  if (score >= 65) {
    return "good";
  }
  if (score >= 40) {
    return "warn";
  }
  return "bad";
}

function MetricBar(props: { label: string; value: number; kind: "normal" | "inverse" }): JSX.Element {
  const { label, value, kind } = props;
  const width = Math.max(0, Math.min(100, kind === "inverse" ? 100 - value : value));
  const cls = metricClass(value, kind);
  return (
    <div className="metric-row">
      <div className="metric-head">
        <span>{label}</span>
        <strong>{value.toFixed(1)}</strong>
      </div>
      <div className="metric-track" aria-label={`${label} ${value.toFixed(1)}`}>
        <div className={`metric-fill ${cls}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPanel({
  status,
  narrative,
  feedback,
  statusDelta,
  outcome,
  learningGoals,
  selectedGoal,
  onGoalChange,
  goalEvaluation,
  debriefPoints,
  replayRows,
  replayBaselinePosition,
  canRunReplay,
  onRunReplay,
  onDownloadAgents,
  onDownloadSummary,
  canDownload
}: AnalyticsPanelProps): JSX.Element {
  const selectedGoalMeta = learningGoals.find((goal) => goal.key === selectedGoal);

  return (
    <section className="panel">
      <h2>Group Survival Monitor</h2>
      <MetricBar label="Canal condition" value={status.canalCondition} kind="normal" />
      <MetricBar label="Downstream stress" value={status.downstreamStress} kind="inverse" />
      <MetricBar label="Group trust" value={status.groupTrust} kind="normal" />

      <p className="debrief">{feedback || narrative}</p>
      {feedback && <p className="small-note">{narrative}</p>}
      <p className="delta-line">
        Delta this season: Canal {statusDelta.canalCondition >= 0 ? "+" : ""}
        {statusDelta.canalCondition.toFixed(1)} | Stress {statusDelta.downstreamStress >= 0 ? "+" : ""}
        {statusDelta.downstreamStress.toFixed(1)} | Trust {statusDelta.groupTrust >= 0 ? "+" : ""}
        {statusDelta.groupTrust.toFixed(1)}
      </p>
      {outcome !== "in_progress" && (
        <p className={`outcome ${outcome}`}>{outcome === "win" ? "Outcome: Community survives." : "Outcome: Community collapse."}</p>
      )}

      <div className="goal-card">
        <div className="goal-head">
          <h3>Learning Goal</h3>
          <select
            aria-label="Learning goal"
            value={selectedGoal}
            onChange={(event) => onGoalChange(event.target.value as LearningGoalKey)}
          >
            {learningGoals.map((goal) => (
              <option key={goal.key} value={goal.key}>
                {goal.label}
              </option>
            ))}
          </select>
        </div>
        <p className="small-note">{selectedGoalMeta?.description ?? ""}</p>
        <div className="metric-head">
          <span>Goal score</span>
          <strong>
            {goalEvaluation.score.toFixed(1)} / 100 ({goalEvaluation.grade})
          </strong>
        </div>
        <div className="metric-track" aria-label={`Goal score ${goalEvaluation.score.toFixed(1)}`}>
          <div
            className={`metric-fill ${goalEvaluation.passed ? "good" : goalEvaluation.score >= 55 ? "warn" : "bad"}`}
            style={{ width: `${Math.max(0, Math.min(100, goalEvaluation.score))}%` }}
          />
        </div>
        <p className="goal-summary">{goalEvaluation.summary}</p>
      </div>

      <div className="goal-card">
        <h3>Debrief</h3>
        <ul className="goal-list">
          {debriefPoints.map((point, index) => (
            <li key={`${index}-${point}`}>{point}</li>
          ))}
        </ul>
      </div>

      <div className="goal-card">
        <h3>Role-Switch Replay (Same Seed)</h3>
        <p className="small-note">
          Replays your decision pattern across canal positions using the same seed to isolate position effects.
        </p>
        <div className="actions">
          <button type="button" onClick={onRunReplay} disabled={!canRunReplay}>
            Run Replay Across Positions
          </button>
        </div>
        {replayRows.length > 0 && (
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Outcome</th>
                  <th>Student Wealth</th>
                  <th>Total Yield</th>
                  <th>Inequality (Gini)</th>
                  <th>Canal</th>
                  <th>Stress</th>
                  <th>Trust</th>
                </tr>
              </thead>
              <tbody>
                {replayRows.map((row) => (
                  <tr
                    key={row.position}
                    className={row.position === replayBaselinePosition ? "replay-row baseline" : "replay-row"}
                  >
                    <td>{row.positionLabel}</td>
                    <td>{row.outcome === "win" ? "Survived" : "Collapsed"}</td>
                    <td>{row.studentFinalWealth.toFixed(1)}</td>
                    <td>{row.totalYield.toFixed(1)}</td>
                    <td>{row.giniYield.toFixed(3)}</td>
                    <td>{row.canalCondition.toFixed(1)}</td>
                    <td>{row.downstreamStress.toFixed(1)}</td>
                    <td>{row.groupTrust.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="actions">
        <button type="button" onClick={onDownloadAgents} disabled={!canDownload}>
          Download agents-per-season.csv
        </button>
        <button type="button" onClick={onDownloadSummary} disabled={!canDownload}>
          Download run-summary.csv
        </button>
      </div>
    </section>
  );
}
