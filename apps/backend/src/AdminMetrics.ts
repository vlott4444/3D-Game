export type PlayerMetric = {
  username: string;
  fps: number;
  ping: number;
  lastUpdate: number;
};

// Глобальная мапа для хранения метрик (ключ - sessionId)
export const metricsStore = new Map<string, PlayerMetric>();
