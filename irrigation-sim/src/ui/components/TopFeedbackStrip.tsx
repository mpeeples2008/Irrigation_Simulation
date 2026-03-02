import React from "react";
import { OutcomeState } from "../../engine/types";

interface TopFeedbackStripProps {
  season: number;
  maxSeasons: number;
  outcome: OutcomeState;
  communityWealthSeries: number[];
  studentWealthSeries: number[];
  studentYieldSeries: number[];
  groupScoreSeries: number[];
  giniSeries: number[];
  canalSeries: number[];
  stressSeries: number[];
  trustSeries: number[];
}

function trendClass(data: number[]): "up" | "down" | "flat" {
  if (data.length < 2) {
    return "flat";
  }
  const delta = data[data.length - 1] - data[data.length - 2];
  if (delta > 0.01) {
    return "up";
  }
  if (delta < -0.01) {
    return "down";
  }
  return "flat";
}

function BarStrip(props: {
  data: number[];
  max: number;
  min?: number;
  invert?: boolean;
  className: string;
}): JSX.Element {
  const { data, max, min = 0, invert = false, className } = props;
  const range = Math.max(0.0001, max - min);
  return (
    <div className={`bar-strip ${className}`} aria-hidden="true">
      {data.map((value, index) => {
        const normalized = Math.max(0, Math.min(1, (value - min) / range));
        const display = invert ? 1 - normalized : normalized;
        return (
          <div key={`${className}-${index}`} className="bar-col">
            <div className="bar-fill" style={{ height: `${display * 100}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export default function TopFeedbackStrip({
  season,
  maxSeasons,
  outcome,
  communityWealthSeries,
  studentWealthSeries,
  studentYieldSeries,
  groupScoreSeries,
  giniSeries,
  canalSeries,
  stressSeries,
  trustSeries
}: TopFeedbackStripProps): JSX.Element {
  const latestWealth =
    studentWealthSeries.length > 0 ? studentWealthSeries[studentWealthSeries.length - 1] : 0;
  const latestYield =
    studentYieldSeries.length > 0 ? studentYieldSeries[studentYieldSeries.length - 1] : 0;
  const latestGroup =
    groupScoreSeries.length > 0 ? groupScoreSeries[groupScoreSeries.length - 1] : 0;
  const latestCommunityWealth =
    communityWealthSeries.length > 0 ? communityWealthSeries[communityWealthSeries.length - 1] : 0;
  const latestGini = giniSeries.length > 0 ? giniSeries[giniSeries.length - 1] : 0;

  const wealthMin = Math.min(...studentWealthSeries, 0);
  const wealthMax = Math.max(...studentWealthSeries, 1);
  const communityWealthMin = Math.min(...communityWealthSeries, 0);
  const communityWealthMax = Math.max(...communityWealthSeries, 1);
  const yieldMax = Math.max(...studentYieldSeries, 1);

  return (
    <section className="panel top-feedback-sticky">
      <div className="top-feedback-head">
        <h2>Live Success Snapshot</h2>
        <p className="small-note">
          Season {season}/{maxSeasons} {outcome !== "in_progress" ? `| ${outcome.toUpperCase()}` : ""}
        </p>
      </div>
      <div className="top-feedback-grid">
        <article className="mini-card">
          <h3>Individual</h3>
          <p className="mini-value">
            Wealth {latestWealth.toFixed(1)} <span className={`trend ${trendClass(studentWealthSeries)}`} />
          </p>
          <BarStrip data={studentWealthSeries} min={wealthMin} max={wealthMax} className="wealth" />
          <p className="small-note">
            Last yield {latestYield.toFixed(1)} <span className={`trend ${trendClass(studentYieldSeries)}`} />
          </p>
          <BarStrip data={studentYieldSeries} max={yieldMax} className="yield" />
        </article>

        <article className="mini-card">
          <h3>Group</h3>
          <p className="mini-value">
            Community wealth {latestCommunityWealth.toFixed(1)}{" "}
            <span className={`trend ${trendClass(communityWealthSeries)}`} />
          </p>
          <BarStrip
            data={communityWealthSeries}
            min={communityWealthMin}
            max={communityWealthMax}
            className="community-wealth"
          />
          <p className="mini-value">
            Survival score {latestGroup.toFixed(1)} <span className={`trend ${trendClass(groupScoreSeries)}`} />
          </p>
          <BarStrip data={groupScoreSeries} max={100} className="group" />
          <div className="spark-legend">
            <span className="legend-item canal">Canal</span>
            <span className="legend-item stress">Stress (inverted)</span>
            <span className="legend-item trust">Trust</span>
          </div>
          <div className="triple-lines">
            <BarStrip data={canalSeries} max={100} className="canal" />
            <BarStrip data={stressSeries} max={100} invert className="stress" />
            <BarStrip data={trustSeries} max={100} className="trust" />
          </div>
        </article>

        <article className="mini-card">
          <h3>Inequality</h3>
          <p className="mini-value">
            Gini {latestGini.toFixed(3)} <span className={`trend ${trendClass(giniSeries)}`} />
          </p>
          <BarStrip data={giniSeries} max={1} className="gini" />
          <p className="small-note">
            Higher Gini means more unequal seasonal yield distribution.
          </p>
        </article>
      </div>
    </section>
  );
}
