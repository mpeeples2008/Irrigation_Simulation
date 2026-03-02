# Irrigation Simulation - Simplified Survival Mode

## Overview
This version focuses on one teaching objective: students see how upstream/downstream position, cooperation, and coordination must stay aligned for group survival.

Gameplay is intentionally minimal:
- 6 total households in a linear canal (you + 5 AI).
- 8 seasons.
- Optional preset profiles provide starting defaults only.
- Your two choices each season are numeric:
  - Water take amount (below/at/above fair target).
  - Maintenance amount (below/at/above fair allocation).
- You can choose your canal position (upstream to downstream) before starting/resetting a run.
- You can tune features independently:
  - Rainfall variability on/off
  - Rainfall variability magnitude
  - AI cooperativeness standard
  - AI competitiveness standard
- Three survival indicators:
  - Canal condition
  - Downstream stress
  - Group trust
- A sticky top dashboard shows quick bar-style trend visuals for:
  - Individual success (wealth and recent yield)
  - Group success (survival score and canal/stress/trust trends)
  - Inequality (seasonal Gini of yield distribution)

This classroom simulation is an educational model inspired by archaeological and ethnographic research on irrigation systems in the US Southwest. It draws on published scholarship and is intended for pedagogical use only. The simulation simplifies social and ecological complexity for learning and does not represent contemporary O'odham knowledge in full. Instructors who plan to publish or publicly share this activity are strongly encouraged to consult with tribal communities or tribal cultural offices. Primary academic sources used in development are listed in /spec/bibliography.md.

## Local Setup
1. `npm install`
2. `npm run dev`
3. `npm test`
4. `npm run build`

## Parameter Sweeps
- Full sweep (default grid, 100 seeds per config):
  - `npm run sweep`
- Quick sweep (smaller grid):
  - `npm run sweep:quick`

Outputs are written to:
- `sweep-output/sweep_raw.csv` (one row per run)
- `sweep-output/sweep_summary.csv` (aggregated means/SD/collapse rate by config)

Common overrides:
- `npm run sweep -- --profiles=balanced_profile,cooperative_profile`
- `npm run sweep -- --seeds=50 --seedStart=1000`
- `npm run sweep -- --coop=0.2,0.5,0.8 --comp=0.2,0.8`
- `npm run sweep -- --variance=10,20,30 --position=0,2,5`
- `npm run sweep -- --rainfall=true,false`

## How To Play
1. Select a preset profile (optional).
2. Set a seed for reproducibility.
3. Choose your position on the canal.
4. Tune rainfall variability and AI standards as needed.
5. Click `Apply Tuning and Reset`.
6. Phase 1 (Water): set your water take, click `Lock Decision`, then `Reveal Withdrawals`.
7. Review revealed takes for all agents.
8. Phase 2 (Maintenance): set your maintenance amount, click `Lock Decision`, then `Finalize Season`.
9. Review the top `Season Impact` card and `AI Response` panel after each season.
10. Keep all three indicators in stable range through season 8.

Loss triggers early if:
- Canal condition collapses.
- Downstream stress stays critical for multiple seasons.

## CSV Export
- `agents-per-season.csv`
- `run-summary.csv`

## File Layout
- `src/engine`: deterministic simplified simulation engine.
- `src/ui`: single-page React UI.
- `tests`: Jest tests for routing, behavior effects, determinism, and CSV schema.
- `spec`: canonical project spec, scenarios, and source notes.

## Preset Editing
Preset profile defaults are defined in `src/engine/presets.json`.
