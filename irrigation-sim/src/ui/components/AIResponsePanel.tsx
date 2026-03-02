import React from "react";
import { SeasonRecord } from "../../engine/types";

interface AIResponsePanelProps {
  latestSeasonRecords: SeasonRecord[];
  fairTake: number;
  retaliationPressure: number;
}

function retaliationLabel(value: number): string {
  if (value >= 1) {
    return "High";
  }
  if (value >= 0.55) {
    return "Rising";
  }
  return "Low";
}

export default function AIResponsePanel({
  latestSeasonRecords,
  fairTake,
  retaliationPressure
}: AIResponsePanelProps): JSX.Element {
  const aiRows = latestSeasonRecords.filter((row) => row.role === "ai");
  const nAi = aiRows.length || 1;
  const aboveFair = aiRows.filter((row) => row.withdrawal > fairTake + 0.01).length;
  const lowMaintenance = aiRows.filter((row) => row.maintenance_contributed === 0).length;
  const aggressiveTail = aiRows
    .filter((row) => row.withdrawal > fairTake + 0.01)
    .sort((a, b) => b.position - a.position)
    .slice(0, 2);

  return (
    <section className="panel">
      <h2>AI Response</h2>
      {latestSeasonRecords.length === 0 ? (
        <p>No AI response yet. Advance one season to reveal behavior.</p>
      ) : (
        <>
          <p className="small-note">
            Retaliation pressure: <strong>{retaliationLabel(retaliationPressure)}</strong> ({retaliationPressure.toFixed(2)})
          </p>
          <div className="ai-bars">
            <div>
              <span>AI above-fair takes</span>
              <div className="metric-track">
                <div className="metric-fill bad" style={{ width: `${(aboveFair / nAi) * 100}%` }} />
              </div>
              <small>{aboveFair}/{nAi}</small>
            </div>
            <div>
              <span>AI skipping fair maintenance</span>
              <div className="metric-track">
                <div className="metric-fill warn" style={{ width: `${(lowMaintenance / nAi) * 100}%` }} />
              </div>
              <small>{lowMaintenance}/{nAi}</small>
            </div>
          </div>
          {aggressiveTail.length > 0 && (
            <p className="small-note">
              Aggressive downstream positions this season:{" "}
              {aggressiveTail.map((row) => row.position).join(", ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
