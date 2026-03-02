import React from "react";
import { SeasonRecord } from "../../engine/types";

interface AgentDashboardProps {
  latestSeasonRecords: SeasonRecord[];
}

export default function AgentDashboard({ latestSeasonRecords }: AgentDashboardProps): JSX.Element {
  const rows = [...latestSeasonRecords].sort((a, b) => a.position - b.position);
  return (
    <section className="panel">
      <h2>Season Outcome</h2>
      {rows.length === 0 ? (
        <p>No completed season yet. Reveal withdrawals, then finalize maintenance.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Position</th>
                <th>Water Received</th>
                <th>Withdrawal</th>
                <th>Maintained</th>
                <th>Yield</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agent_id}>
                  <td>{row.role === "student" ? "You" : row.agent_id}</td>
                  <td>{row.position}</td>
                  <td>{row.water_received.toFixed(2)}</td>
                  <td>{row.withdrawal.toFixed(1)}</td>
                  <td>{row.maintenance_contributed ? "Yes" : "No"}</td>
                  <td>{row.yield.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
