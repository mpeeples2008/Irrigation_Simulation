import React from "react";
import { SeasonRecord } from "../../engine/types";

interface AgentDashboardProps {
  latestSeasonRecords: SeasonRecord[];
}

export default function AgentDashboard({ latestSeasonRecords }: AgentDashboardProps): JSX.Element {
  const rows = [...latestSeasonRecords].sort((a, b) => a.position - b.position);
  return (
    <section className="panel">
      <h2>Agent Dashboard</h2>
      {rows.length === 0 ? (
        <p>No season results yet. Submit your first decision.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Role</th>
                <th>Position</th>
                <th>Water</th>
                <th>Yield</th>
                <th>Reputation</th>
                <th>Wealth</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agent_id}>
                  <td>{row.agent_id}</td>
                  <td>{row.role}</td>
                  <td>{row.position}</td>
                  <td>{row.water_received.toFixed(2)}</td>
                  <td>{row.yield.toFixed(2)}</td>
                  <td>{row.reputation.toFixed(2)}</td>
                  <td>{row.wealth.toFixed(2)}</td>
                  <td>{row.detected_defection ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
