# Irrigation Simulation - Single-Player Hohokam/O'odham Teaching App

## Overview
This project is a single-player irrigation simulation web app. A student controls one agent while AI agents follow strategy rules under changing water supply, maintenance cooperation, sanctions, and canal-failure risk.

This classroom simulation is an educational model inspired by archaeological and ethnographic research on irrigation systems in the US Southwest. It draws on published scholarship and is intended for pedagogical use only. The simulation simplifies social and ecological complexity for learning and does not represent contemporary O’odham knowledge in full. Instructors who plan to publish or publicly share this activity are strongly encouraged to consult with tribal communities or tribal cultural offices. Primary academic sources used in development are listed in /spec/bibliography.md.

## Local Setup
1. `npm install`
2. `npm run dev`
3. `npm test`
4. `npm run build`

## File Layout
- `src/engine`: deterministic simulation engine and typed mechanics.
- `src/ui`: React single-page UI and reusable components.
- `tests`: Jest unit tests for core engine behavior.
- `spec`: canonical machine-readable spec, scenarios, bibliography, and skeleton references.
- `sample`: sample CSV outputs.
- `developer-notes.md`: implementation tradeoffs and rationale.

## Running Simulations
- Choose a scenario in the Scenario selector.
- Set seed to any integer for reproducibility.
- Each season, choose withdrawal and maintenance actions, then submit.
- Run proceeds for 10 seasons by default.

## Batch Runs and CSV Export
- Use **Batch runs (1-500)** to run multiple seeded simulations (`seed + i`).
- The app warns when `N > 200` to reduce browser memory risk.
- Single-run downloads:
  - `agents-per-season.csv`
  - `run-summary.csv`
- Batch download:
  - `batch-run-summary.csv`

## Preset Editing
Scenario parameter subsets are defined in `src/engine/presets.json`.

## Acceptance Checklist
- [ ] `npm run dev` launches the app and UI renders without errors.
- [ ] User can select a scenario, run a 10-season simulation, see season-by-season updates, and download CSVs.
- [ ] `npm test` passes all tests.
- [ ] Generated CSVs match schema in `/spec/spec.json` exactly (column names and order).
- [ ] The engine is deterministic with a seed: two runs with same seed produce identical CSVs.
- [ ] README and ethics landing text are present and correct.
