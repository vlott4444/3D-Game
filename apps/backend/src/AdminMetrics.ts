export type PlayerMetric = {
  username: string;
  fps: number;
  ping: number;
  lastUpdate: number;
};
// Ephemeral telemetry; persistent accounts and agent overrides live in SQLite.
export const metricsStore = new Map<string, PlayerMetric>();
