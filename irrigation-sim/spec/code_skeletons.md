# Code Skeletons

```ts
export function runSimulation(preset: object, seed: number, options?: object): RunResult {
  // initialize state
  // loop through seasons
  // return records and summary
}
```

```ts
export function stepSeason(state: SimulationState): SeasonResult {
  // draw supply
  // collect decisions
  // route water and compute outcomes
  // return updated state and records
}
```

```ts
export function exportAgentsCSV(runResult: RunResult): string {
  // serialize per-season records
}
```

```ts
export function exportRunSummaryCSV(runResult: RunResult): string {
  // serialize run summary record
}
```
