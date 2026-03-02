# Developer Notes

## Simplification Focus
This mode intentionally reduces complexity to highlight three concepts only:
- Upstream/downstream positional effects.
- Cooperation via maintenance.
- Coordination as a group survival condition.

## Tradeoffs
- Removed sanctions/reputation institutions, branch topology, and batch controls from the player loop.
- Kept deterministic seeded randomness only for seasonal supply variation.
- Replaced multi-chart analytics with three survival bars and a short narrative debrief per season.
- Replaced binary choices with numeric player controls:
  - water take amount vs fair target
  - maintenance amount vs fair allocation
  - selectable student canal position
- Added end-of-run educational scaffolding:
  - selectable learning goals with score + grade
  - stronger debrief bullets that call out winners/losers and key tradeoffs
  - same-seed role-switch replay table to isolate positional effects
- Added a compact sticky top dashboard using bar-style season trends and a visible inequality metric (Gini).
- Increased behavioral sensitivity: selfish player behavior now raises retaliation pressure, which shifts AI toward more aggressive next-season responses.
- Added explicit per-phase commitment flow (`Lock Decision` before each step) so choices feel intentional.
- Added a two-phase turn structure:
  - water choice first
  - revealed withdrawals second
  - maintenance choice after reveal
- Added prominent per-click impact feedback (`Season Impact` banner + `AI Response` panel).
- Reframed scenarios as optional preset profiles and exposed rainfall variability + AI behavior standards as independently tunable controls.

## Engine Notes
- Engine remains pure and browser-safe (no DOM side-effects).
- Exported APIs are unchanged (`runSimulation`, `stepSeason`, CSV exporters).
- CSV schema remains compatible with the existing column order.
- Parameter sweep tooling is available in `scripts/sweep.ts` with npm commands for raw and summary analysis CSVs.
