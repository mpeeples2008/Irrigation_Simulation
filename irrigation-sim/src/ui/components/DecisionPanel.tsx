import React from "react";
import { MaintenanceChoice, WithdrawalChoice } from "../../engine/types";

interface DecisionPanelProps {
  withdrawalChoice: WithdrawalChoice | "";
  maintenanceChoice: MaintenanceChoice | "";
  disabled: boolean;
  onWithdrawalChange: (choice: WithdrawalChoice) => void;
  onMaintenanceChange: (choice: MaintenanceChoice) => void;
  onSubmit: () => void;
}

export default function DecisionPanel({
  withdrawalChoice,
  maintenanceChoice,
  disabled,
  onWithdrawalChange,
  onMaintenanceChange,
  onSubmit
}: DecisionPanelProps): JSX.Element {
  return (
    <section className="panel">
      <h2>Decision Panel</h2>
      <fieldset>
        <legend>Withdrawal</legend>
        <label>
          <input
            type="radio"
            name="withdrawal"
            value="low"
            checked={withdrawalChoice === "low"}
            onChange={() => onWithdrawalChange("low")}
          />
          Low
        </label>
        <label>
          <input
            type="radio"
            name="withdrawal"
            value="medium"
            checked={withdrawalChoice === "medium"}
            onChange={() => onWithdrawalChange("medium")}
          />
          Medium
        </label>
        <label>
          <input
            type="radio"
            name="withdrawal"
            value="high"
            checked={withdrawalChoice === "high"}
            onChange={() => onWithdrawalChange("high")}
          />
          High
        </label>
      </fieldset>

      <fieldset>
        <legend>Maintenance</legend>
        <label>
          <input
            type="radio"
            name="maintenance"
            value="contribute"
            checked={maintenanceChoice === "contribute"}
            onChange={() => onMaintenanceChange("contribute")}
          />
          Contribute
        </label>
        <label>
          <input
            type="radio"
            name="maintenance"
            value="skip"
            checked={maintenanceChoice === "skip"}
            onChange={() => onMaintenanceChange("skip")}
          />
          Skip
        </label>
      </fieldset>

      <button type="button" onClick={onSubmit} disabled={disabled}>
        Submit Season Decision
      </button>
    </section>
  );
}
