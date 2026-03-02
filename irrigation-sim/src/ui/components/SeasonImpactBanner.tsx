import React from "react";
import { StatusMetrics } from "../../engine/types";

interface SeasonImpactBannerProps {
  season: number;
  feedback: string;
  statusDelta: StatusMetrics;
}

function deltaClass(value: number): string {
  if (value > 0.01) {
    return "pos";
  }
  if (value < -0.01) {
    return "neg";
  }
  return "flat";
}

function DeltaBadge(props: { label: string; value: number; invert?: boolean }): JSX.Element {
  const signed = props.invert ? -props.value : props.value;
  const cls = deltaClass(signed);
  return (
    <div className={`impact-badge ${cls}`}>
      <span>{props.label}</span>
      <strong>
        {signed >= 0 ? "+" : ""}
        {signed.toFixed(1)}
      </strong>
    </div>
  );
}

export default function SeasonImpactBanner({
  season,
  feedback,
  statusDelta
}: SeasonImpactBannerProps): JSX.Element {
  if (season <= 0) {
    return <></>;
  }
  return (
    <section className="panel impact-banner">
      <div className="impact-head">
        <h2>Season {season} Impact</h2>
      </div>
      <div className="impact-grid">
        <DeltaBadge label="Canal" value={statusDelta.canalCondition} />
        <DeltaBadge label="Stress" value={statusDelta.downstreamStress} invert />
        <DeltaBadge label="Trust" value={statusDelta.groupTrust} />
      </div>
      <p className="debrief">{feedback}</p>
    </section>
  );
}
