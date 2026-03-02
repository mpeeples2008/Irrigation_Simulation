import React from "react";
import { OutcomeState, StatusMetrics } from "../../engine/types";

interface AnalyticsPanelProps {
  status: StatusMetrics;
  narrative: string;
  feedback: string;
  statusDelta: StatusMetrics;
  outcome: OutcomeState;
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
  onDownloadAgents,
  onDownloadSummary,
  canDownload
}: AnalyticsPanelProps): JSX.Element {
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
