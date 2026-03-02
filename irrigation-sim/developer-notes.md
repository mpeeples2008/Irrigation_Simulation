# Developer Notes

## Tradeoffs
- SVG animation is intentionally lightweight (flow dash animation and node labels) to keep rendering robust and accessible.
- Branch routing is modeled with one trunk split and alternating assignment to two branches after split index.
- Batch runs are client-only and CSV-only. ZIP export is intentionally omitted for simplicity and dependency control.
- The app warns on large batch counts (`N > 200`) to communicate browser memory pressure risk.

## Engine Notes
- Engine module is pure and has no DOM side-effects.
- All stochastic operations use a seeded deterministic RNG.
- Core behaviors are exposed as modular functions for direct unit testing:
  - routing
  - yield calculation
  - reputation updates
  - defection detection
  - failure logic
  - CSV export
