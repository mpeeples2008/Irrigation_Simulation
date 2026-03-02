import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { SeasonRecord } from "../../engine/types";
import { calculateGini } from "../../engine/utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface AnalyticsPanelProps {
  records: SeasonRecord[];
  onDownloadAgents: () => void;
  onDownloadSummary: () => void;
}

export default function AnalyticsPanel({
  records,
  onDownloadAgents,
  onDownloadSummary
}: AnalyticsPanelProps): JSX.Element {
  const series = useMemo(() => {
    const bySeason = new Map<number, SeasonRecord[]>();
    for (const record of records) {
      const rows = bySeason.get(record.season) ?? [];
      rows.push(record);
      bySeason.set(record.season, rows);
    }
    const seasons = [...bySeason.keys()].sort((a, b) => a - b);
    const totalYield = seasons.map((season) =>
      bySeason.get(season)!.reduce((sum, row) => sum + row.yield, 0)
    );
    const gini = seasons.map((season) =>
      calculateGini(bySeason.get(season)!.map((row) => row.yield))
    );
    const studentYield = seasons.map((season) => {
      const student = bySeason.get(season)!.find((row) => row.role === "student");
      return student?.yield ?? 0;
    });
    const avgYield = seasons.map((season) => {
      const rows = bySeason.get(season)!;
      return rows.reduce((sum, row) => sum + row.yield, 0) / rows.length;
    });
    return { seasons, totalYield, gini, studentYield, avgYield };
  }, [records]);

  return (
    <section className="panel">
      <h2>Analytics</h2>
      {series.seasons.length === 0 ? (
        <p>Run seasons to populate charts and exports.</p>
      ) : (
        <>
          <div className="chart-wrap">
            <Line
              data={{
                labels: series.seasons,
                datasets: [
                  {
                    label: "Total yield",
                    data: series.totalYield,
                    borderColor: "#0072B2",
                    backgroundColor: "rgba(0,114,178,0.15)",
                    tension: 0.2,
                    fill: true
                  }
                ]
              }}
            />
          </div>
          <div className="chart-wrap">
            <Line
              data={{
                labels: series.seasons,
                datasets: [
                  {
                    label: "Gini (yield inequality)",
                    data: series.gini,
                    borderColor: "#E69F00",
                    backgroundColor: "rgba(230,159,0,0.15)",
                    tension: 0.2,
                    fill: true
                  }
                ]
              }}
            />
          </div>
          <div className="chart-wrap">
            <Line
              data={{
                labels: series.seasons,
                datasets: [
                  {
                    label: "Student yield",
                    data: series.studentYield,
                    borderColor: "#009E73",
                    tension: 0.2
                  },
                  {
                    label: "Average yield",
                    data: series.avgYield,
                    borderColor: "#6C757D",
                    tension: 0.2
                  }
                ]
              }}
            />
          </div>
        </>
      )}
      <div className="actions">
        <button type="button" onClick={onDownloadAgents} disabled={records.length === 0}>
          Download agents-per-season.csv
        </button>
        <button type="button" onClick={onDownloadSummary} disabled={records.length === 0}>
          Download run-summary.csv
        </button>
      </div>
    </section>
  );
}
