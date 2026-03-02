import React from "react";
import { RevealedWithdrawal, StatusMetrics, TurnPhase } from "../../engine/types";

interface DecisionPanelProps {
  turnPhase: TurnPhase;
  seasonNumber: number;
  withdrawal: number;
  maintenance: number;
  fairTake: number;
  maxTake: number;
  fairMaintenance: number;
  maxMaintenance: number;
  lastResolvedSeason: number;
  lastFeedback: string;
  statusDelta: StatusMetrics;
  revealedWithdrawals?: RevealedWithdrawal[];
  revealedSupply?: number;
  revealedLowSupply?: boolean;
  onWithdrawalChange: (value: number) => void;
  onMaintenanceChange: (value: number) => void;
}

function decisionLabel(
  withdrawal: number,
  fairTake: number,
  maintenance: number,
  fairMaintenance: number
): string {
  const takeState =
    withdrawal > fairTake + 0.2 ? "Above-fair take" : withdrawal < fairTake - 0.2 ? "Below-fair take" : "Fair take";
  const maintenanceState =
    maintenance > fairMaintenance + 0.1
      ? "Above-fair maintenance"
      : maintenance < fairMaintenance - 0.1
        ? "Below-fair maintenance"
        : "Fair maintenance";
  return `${takeState} + ${maintenanceState}`;
}

export default function DecisionPanel({
  turnPhase,
  seasonNumber,
  withdrawal,
  maintenance,
  fairTake,
  maxTake,
  fairMaintenance,
  maxMaintenance,
  lastResolvedSeason,
  lastFeedback,
  statusDelta,
  revealedWithdrawals = [],
  revealedSupply,
  revealedLowSupply = false,
  onWithdrawalChange,
  onMaintenanceChange
}: DecisionPanelProps): JSX.Element {
  const isWaterPhase = turnPhase === "water";
  const label = decisionLabel(withdrawal, fairTake, maintenance, fairMaintenance);
  const heading = isWaterPhase ? "Phase 1: Water Decision" : "Phase 2: Maintenance Decision";
  const phaseNote = isWaterPhase
    ? "Choose your water take first. After reveal, all maintenance choices happen."
    : "Withdrawals are now visible. Choose maintenance as a response.";
  const sortedReveals = [...revealedWithdrawals].sort((a, b) => a.position - b.position);
  const yourReveal = sortedReveals.find((row) => row.role === "student");
  const otherReveals = sortedReveals.filter((row) => row.role !== "student");
  const aiAboveFairCount = otherReveals.filter((row) => row.above_fair > 0.1).length;
  const aiBelowFairCount = otherReveals.filter((row) => row.above_fair < -0.1).length;
  const aiMeanTake =
    otherReveals.reduce((sum, row) => sum + row.withdrawal, 0) / Math.max(1, otherReveals.length);

  return (
    <section className="panel">
      <h2>{heading}</h2>
      <p className="small-note">Season {seasonNumber}</p>
      <p className="decision-tag">{label}</p>
      <p className="small-note">{phaseNote}</p>
      <p className="small-note">Use the sticky command bar to lock and advance.</p>
      {lastResolvedSeason > 0 && (
        <div key={`impact-flash-${lastResolvedSeason}`} className="decision-impact-flash" aria-live="polite">
          <div className="decision-impact-grid">
            <div className={`decision-impact-card ${deltaClass(statusDelta.canalCondition)}`}>
              <span>Canal</span>
              <strong>{signed(statusDelta.canalCondition)}</strong>
            </div>
            <div className={`decision-impact-card ${deltaClass(-statusDelta.downstreamStress)}`}>
              <span>Stress</span>
              <strong>{signed(-statusDelta.downstreamStress)}</strong>
            </div>
            <div className={`decision-impact-card ${deltaClass(statusDelta.groupTrust)}`}>
              <span>Trust</span>
              <strong>{signed(statusDelta.groupTrust)}</strong>
            </div>
          </div>
          {lastFeedback && <p className="small-note">{lastFeedback}</p>}
        </div>
      )}

      {isWaterPhase ? (
        <>
          <label htmlFor="withdrawal-range" className="control-label">
            Water take: {withdrawal.toFixed(1)} (fair target {fairTake.toFixed(1)})
          </label>
          <input
            id="withdrawal-range"
            type="range"
            min={0}
            max={maxTake}
            step={0.5}
            value={withdrawal}
            onChange={(event) => onWithdrawalChange(Number(event.target.value))}
          />
          <p className="small-note">
            Below fair can protect downstream flow. Above fair increases downstream stress.
          </p>
        </>
      ) : (
        <>
          <div className="reveal-card" aria-live="polite">
            <h3 className="reveal-title">Quick View: Other Agents This Season</h3>
            <p className="small-note">
              Supply {typeof revealedSupply === "number" ? revealedSupply.toFixed(1) : "--"}
              {revealedLowSupply ? " (Low rainfall)" : ""}
            </p>
            <div className="reveal-stats">
              <div className="reveal-stat">
                <span>AI avg take</span>
                <strong>{aiMeanTake.toFixed(1)}</strong>
              </div>
              <div className="reveal-stat">
                <span>AI above fair</span>
                <strong>{aiAboveFairCount}</strong>
              </div>
              <div className="reveal-stat">
                <span>AI below fair</span>
                <strong>{aiBelowFairCount}</strong>
              </div>
            </div>
            {yourReveal && (
              <p className="small-note">
                You took {yourReveal.withdrawal.toFixed(1)} ({yourReveal.above_fair >= 0 ? "+" : ""}
                {yourReveal.above_fair.toFixed(1)} vs fair).
              </p>
            )}
            <div className="reveal-list">
              {otherReveals.map((row) => {
                const barWidth = Math.max(4, (row.withdrawal / Math.max(1, maxTake)) * 100);
                const deltaLabel = `${row.above_fair >= 0 ? "+" : ""}${row.above_fair.toFixed(1)}`;
                const stateClass =
                  row.above_fair > 0.1 ? "over" : row.above_fair < -0.1 ? "under" : "fair";
                return (
                  <div key={row.agent_id} className={`reveal-row ${stateClass}`}>
                    <div className="reveal-row-head">
                      <span>Pos {row.position}</span>
                      <span>
                        {row.withdrawal.toFixed(1)} ({deltaLabel})
                      </span>
                    </div>
                    <div className="reveal-bar-track">
                      <div className="reveal-bar-fill" style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <label htmlFor="maintenance-range" className="control-label">
            Maintenance: {maintenance.toFixed(1)} (fair allocation {fairMaintenance.toFixed(1)})
          </label>
          <input
            id="maintenance-range"
            type="range"
            min={0}
            max={maxMaintenance}
            step={0.1}
            value={maintenance}
            onChange={(event) => onMaintenanceChange(Number(event.target.value))}
          />
          <p className="small-note">
            Contributing near or above fair allocation improves canal condition and trust.
          </p>
        </>
      )}
    </section>
  );
}

function deltaClass(value: number): "pos" | "neg" | "flat" {
  if (value > 0.01) {
    return "pos";
  }
  if (value < -0.01) {
    return "neg";
  }
  return "flat";
}

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}`;
}
