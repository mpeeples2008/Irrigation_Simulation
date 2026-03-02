import React from "react";

interface CommandBarProps {
  seasonNumber: number;
  maxSeasons: number;
  phaseLabel: string;
  inWaterPhase: boolean;
  withdrawal: number;
  maintenance: number;
  fairTake: number;
  fairMaintenance: number;
  decisionLocked: boolean;
  disabled: boolean;
  onLockDecision: () => void;
  onSubmit: () => void;
}

export default function CommandBar({
  seasonNumber,
  maxSeasons,
  phaseLabel,
  inWaterPhase,
  withdrawal,
  maintenance,
  fairTake,
  fairMaintenance,
  decisionLocked,
  disabled,
  onLockDecision,
  onSubmit
}: CommandBarProps): JSX.Element {
  const submitLabel = inWaterPhase ? "Reveal Withdrawals" : "Finalize Season";
  return (
    <section className="panel command-bar" aria-label="Season command bar">
      <div className="command-row">
        <span className="command-chip">Season {seasonNumber}/{maxSeasons}</span>
        <span className="command-chip">{phaseLabel}</span>
        <span className="command-chip">
          Choice: {inWaterPhase ? `Take ${withdrawal.toFixed(1)}` : `Maintenance ${maintenance.toFixed(1)}`}
        </span>
        <span className="command-chip">
          Fair: take {fairTake.toFixed(1)} | maintenance {fairMaintenance.toFixed(1)}
        </span>
        <span className="command-chip">{decisionLocked ? "State: locked" : "State: unlocked"}</span>
        <button
          type="button"
          className={`secondary-btn ${decisionLocked ? "locked" : ""}`}
          onClick={onLockDecision}
          disabled={disabled}
        >
          {decisionLocked ? "Locked" : "Lock"}
        </button>
        <button type="button" onClick={onSubmit} disabled={disabled || !decisionLocked}>
          {submitLabel}
        </button>
      </div>
    </section>
  );
}
