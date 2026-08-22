import { prisma } from "@/lib/db";

export async function recordLatency(stage: string, startedAt: number, reference?: string) {
  const latencyMs = Math.max(0, Date.now() - startedAt);
  await prisma.pipelineLatencyMetric.create({ data: { stage, latencyMs, reference } });
  return latencyMs;
}

export function percentile(values: number[], percentileRank: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(percentileRank * sorted.length) - 1)];
}
