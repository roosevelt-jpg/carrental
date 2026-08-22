import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { percentile } from "@/lib/analytics/latency";

const required = process.env.REQUIRE_GO_LIVE_EVIDENCE === "1";

describe("recorded real-provider and UAT evidence", () => {
  it.skipIf(!required)("has recent passing connection tests for every live provider", async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.integrationTestResult.findMany({ where: { ok: true, testedAt: { gte: cutoff } } });
    expect(new Set(rows.map((row) => row.provider))).toEqual(new Set(["whatsapp", "anthropic", "stripe"]));
  });

  it.skipIf(!required)("has completed signed webhook and full owner UAT evidence", async () => {
    const [inbound, stripe, review, resolutionAudit] = await Promise.all([
      prisma.whatsAppWebhookEvent.count({ where: { kind: "INBOUND_MESSAGE", status: "COMPLETE" } }),
      prisma.processedWebhookEvent.count({ where: { provider: "stripe", status: "COMPLETE" } }),
      prisma.activationReview.findUnique({ where: { id: "primary" } }),
      prisma.auditLog.count({ where: { entityType: "Escalation", action: "resolve" } }),
    ]);
    expect(inbound).toBeGreaterThan(0); expect(stripe).toBeGreaterThan(0); expect(resolutionAudit).toBeGreaterThan(0); expect(review?.ownerUatSignedOff).toBe(true);
  });

  it.skipIf(!required)("proves every p95 latency budget with at least 20 real samples", async () => {
    const [pipeline, processing] = await Promise.all([prisma.pipelineLatencyMetric.findMany({ take: 5000, orderBy: { createdAt: "desc" } }), prisma.processingMetric.findMany({ take: 2000, orderBy: { createdAt: "desc" } })]);
    const budgets = [{ stage: "webhook_to_queue", target: 200 }, { stage: "context_assembly", target: 500 }, { stage: "db_tool", target: 100 }];
    for (const budget of budgets) { const values = pipeline.filter((row) => row.stage === budget.stage).map((row) => row.latencyMs); expect(values.length).toBeGreaterThanOrEqual(20); expect(percentile(values, .95)).toBeLessThanOrEqual(budget.target); }
    const total = processing.map((row) => row.latencyMs); expect(total.length).toBeGreaterThanOrEqual(20); expect(percentile(total, .95)).toBeLessThanOrEqual(5000);
  });
});
