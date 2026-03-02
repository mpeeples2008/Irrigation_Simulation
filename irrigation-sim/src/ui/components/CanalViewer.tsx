import React from "react";
import { AgentState, SeasonRecord, TopologyType } from "../../engine/types";

interface CanalViewerProps {
  agents: AgentState[];
  latestSeasonRecords: SeasonRecord[];
  topology: TopologyType;
  season: number;
}

export default function CanalViewer({
  agents,
  latestSeasonRecords,
  topology,
  season
}: CanalViewerProps): JSX.Element {
  const sortedAgents = [...agents].sort((a, b) => a.position - b.position);
  const waterByAgent = latestSeasonRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.agent_id] = record.water_received;
    return acc;
  }, {});
  const failure = latestSeasonRecords.some((record) => record.canal_failure_flag === 1);

  return (
    <section className="panel">
      <h2>Canal Viewer</h2>
      <svg viewBox="0 0 720 220" className={`canal-svg ${failure ? "failure" : ""}`} role="img" aria-label="Canal schematic">
        <defs>
          <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0072B2" />
            <stop offset="100%" stopColor="#56B4E9" />
          </linearGradient>
        </defs>

        <line x1={30} y1={70} x2={690} y2={70} className="canal-line" />
        {topology === "branch" && (
          <>
            <line x1={360} y1={70} x2={580} y2={120} className="canal-line" />
            <line x1={360} y1={70} x2={580} y2={170} className="canal-line" />
          </>
        )}

        <line
          x1={30}
          y1={70}
          x2={690}
          y2={70}
          className={`flow-line ${season > 0 ? "active" : ""}`}
          style={{ stroke: "url(#flow-gradient)" }}
        />
        {topology === "branch" && season > 0 && (
          <>
            <line x1={360} y1={70} x2={580} y2={120} className="flow-line active" style={{ stroke: "url(#flow-gradient)" }} />
            <line x1={360} y1={70} x2={580} y2={170} className="flow-line active" style={{ stroke: "url(#flow-gradient)" }} />
          </>
        )}

        {sortedAgents.map((agent, index) => {
          const x = 40 + index * (640 / Math.max(1, sortedAgents.length - 1));
          const y = topology === "branch" && index > Math.floor(sortedAgents.length / 3)
            ? index % 2 === 0
              ? 120
              : 170
            : 70;
          const received = waterByAgent[agent.agentId] ?? 0;
          return (
            <g key={agent.agentId}>
              <circle cx={x} cy={y} r={agent.role === "student" ? 10 : 7} className={agent.role === "student" ? "node-student" : "node-ai"} />
              <text x={x} y={y - 14} textAnchor="middle" className="node-label">
                {agent.role === "student" ? "You" : agent.agentId}
              </text>
              <text x={x} y={y + 20} textAnchor="middle" className="node-water">
                {received.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="small-note">
        Water labels show current season receipt per agent. Season: {season}
        {failure ? " (canal failure this season)" : ""}
      </p>
    </section>
  );
}
