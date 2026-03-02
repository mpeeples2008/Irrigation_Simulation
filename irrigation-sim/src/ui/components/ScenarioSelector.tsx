import React from "react";
import { TopologyType } from "../../engine/types";

export interface ScenarioOption {
  key: string;
  label: string;
  vignette: string;
}

interface ScenarioSelectorProps {
  options: ScenarioOption[];
  selectedKey: string;
  topology: TopologyType;
  onScenarioChange: (key: string) => void;
  onTopologyChange: (topology: TopologyType) => void;
}

export default function ScenarioSelector({
  options,
  selectedKey,
  topology,
  onScenarioChange,
  onTopologyChange
}: ScenarioSelectorProps): JSX.Element {
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];
  return (
    <section className="panel">
      <h2>Scenario</h2>
      <label htmlFor="scenario-select" className="control-label">
        Select narrative scenario
      </label>
      <select
        id="scenario-select"
        value={selectedKey}
        onChange={(event) => onScenarioChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="scenario-vignette">{selected?.vignette}</p>
      <fieldset>
        <legend>Canal topology</legend>
        <label>
          <input
            type="radio"
            name="topology"
            value="linear"
            checked={topology === "linear"}
            onChange={() => onTopologyChange("linear")}
          />
          Linear
        </label>
        <label>
          <input
            type="radio"
            name="topology"
            value="branch"
            checked={topology === "branch"}
            onChange={() => onTopologyChange("branch")}
          />
          One branch
        </label>
      </fieldset>
    </section>
  );
}
