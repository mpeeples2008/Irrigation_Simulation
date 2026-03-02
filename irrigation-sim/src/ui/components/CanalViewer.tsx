import React from "react";
import { AgentState, SeasonRecord } from "../../engine/types";

interface CanalViewerProps {
  agents: AgentState[];
  latestSeasonRecords: SeasonRecord[];
  season: number;
  canalCondition: number;
  downstreamStress: number;
}

export default function CanalViewer({
  agents,
  latestSeasonRecords,
  season,
  canalCondition,
  downstreamStress
}: CanalViewerProps): JSX.Element {
  const sortedAgents = [...agents].sort((a, b) => a.position - b.position);
  const waterByAgent = latestSeasonRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.agent_id] = record.water_received;
    return acc;
  }, {});
  const damageClass = canalCondition < 30 ? "failure" : "";

  return (
    <section className="panel">
      <h2>Canal Flow</h2>
      <svg viewBox="0 0 720 180" className={`canal-svg ${damageClass}`} role="img" aria-label="Linear canal diagram">
        <line x1={30} y1={80} x2={690} y2={80} className="canal-line" />
        <line x1={30} y1={80} x2={690} y2={80} className={`flow-line ${season > 0 ? "active" : ""}`} />
        {sortedAgents.map((agent, index) => {
          const x = 40 + index * (640 / Math.max(1, sortedAgents.length - 1));
          const received = waterByAgent[agent.agentId] ?? 0;
          return (
            <g key={agent.agentId}>
              <circle cx={x} cy={80} r={agent.role === "student" ? 10 : 7} className={agent.role === "student" ? "node-student" : "node-ai"} />
              <text x={x} y={60} textAnchor="middle" className="node-label">
                {agent.role === "student" ? "You" : `A${index + 1}`}
              </text>
              <text x={x} y={104} textAnchor="middle" className="node-water">
                {received.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="small-note">
        Upstream on the left. Downstream stress: {downstreamStress.toFixed(1)}. Season {season}.
      </p>
    </section>
  );
}
