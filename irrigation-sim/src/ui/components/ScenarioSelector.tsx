import React from "react";

export interface ScenarioOption {
  key: string;
  label: string;
  vignette: string;
}

interface ScenarioSelectorProps {
  options: ScenarioOption[];
  selectedKey: string;
  onScenarioChange: (key: string) => void;
}

export default function ScenarioSelector({
  options,
  selectedKey,
  onScenarioChange
}: ScenarioSelectorProps): JSX.Element {
  const selected = options.find((option) => option.key === selectedKey) ?? options[0];
  return (
    <section className="panel">
      <h2>Preset Profile</h2>
      <label htmlFor="scenario-select" className="control-label">
        Pick a profile (defaults only)
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
      <p className="scenario-vignette">{selected.vignette}</p>
      <ul className="goal-list">
        <li>Profiles are starting points.</li>
        <li>Rainfall and AI standards are tunable below.</li>
        <li>Apply tuning to reset with your custom settings.</li>
      </ul>
    </section>
  );
}
