import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES, ensureRecurringJobs } from "./queues";
import { captureException, initSentry } from "@/lib/observability/sentry";
import { prisma } from "@/lib/db";

initSentry("worker");

const connection = getRedisConnection();
const workerStartedAt = new Date();

async function writeHeartbeat() {
  try {
    await prisma.workerHeartbeat.upsert({
      where: { id: "primary" },
      create: {
        id: "primary",
        startedAt: workerStartedAt,
        metadata: { pid: process.pid, queues: Object.values(QUEUE_NAMES) },
      },
      update: {
        metadata: { pid: process.pid, queues: Object.values(QUEUE_NAMES) },
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      msg: "worker_heartbeat_failed",
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

void writeHeartbeat();
const heartbeatTimer = setInterval(() => void writeHeartbeat(), 30_000);
heartbeatTimer.unref();

const inboundWorker = new Worker(
  QUEUE_NAMES.inboundMessage,
  async (job) => {
    const { processInboundWebhookEvent } = await import("./jobs/process-whatsapp-webhook");
    const { withDistributedLock } = await import("./locks");
    const senderHash = String(job.data.senderHash ?? "unknown");
    return withDistributedLock(`conversation:${senderHash}`, () =>
      processInboundWebhookEvent(String(job.data.eventId)),
    );
  },
  { connection, concurrency: 8 },
);
const whatsappWebhookWorker = new Worker(
  QUEUE_NAMES.whatsappWebhook,
  async (job) => { const { processWhatsAppWebhookEvent } = await import("./jobs/process-whatsapp-webhook"); return processWhatsAppWebhookEvent(String(job.data.eventId)); },
  { connection, concurrency: 12 },
);

const reminderWorker = new Worker(
  QUEUE_NAMES.escalationReminder,
  async (job) => {
    const { processEscalationReminder } = await import("./jobs/escalation-reminder");
    return processEscalationReminder(job.data);
  },
  { connection },
);

const mediaWorker = new Worker(
  QUEUE_NAMES.mediaReupload,
  async (job) => {
    const { processMediaReupload } = await import("./jobs/media-reupload");
    return processMediaReupload(job.data);
  },
  { connection },
);

const droppedWorker = new Worker(
  QUEUE_NAMES.markDropped,
  async (job) => {
    const { processMarkDroppedConversations } = await import(
      "./jobs/mark-dropped-conversations"
    );
    return processMarkDroppedConversations(job.data);
  },
  { connection },
);

const expireQuotesWorker = new Worker(
  QUEUE_NAMES.expireQuotes,
  async () => {
    const { processExpireQuotes } = await import("./jobs/expire-quotes");
    return processExpireQuotes();
  },
  { connection },
);

const retentionWorker = new Worker(
  QUEUE_NAMES.retention,
  async () => {
    const { processRetentionSweep } = await import("./jobs/retention-sweep");
    return processRetentionSweep();
  },
  { connection },
);

const weeklyDigestWorker = new Worker(
  QUEUE_NAMES.weeklyDigest,
  async (job) => {
    const { processWeeklyDigest } = await import("./jobs/weekly-digest");
    return processWeeklyDigest(job.data);
  },
  { connection },
);

for (const worker of [
  whatsappWebhookWorker,
  inboundWorker,
  reminderWorker,
  mediaWorker,
  droppedWorker,
  expireQuotesWorker,
  retentionWorker,
  weeklyDigestWorker,
]) {
  worker.on("failed", (job, error) => {
    captureException(error, { queue: worker.name, jobId: job?.id });
    console.error(
      JSON.stringify({
        msg: "job_failed",
        queue: worker.name,
        jobId: job?.id,
        error: error.message,
      }),
    );
  });
}

ensureRecurringJobs()
  .then(() => {
    console.log(
      JSON.stringify({
        msg: "worker_started",
        queues: Object.values(QUEUE_NAMES),
      }),
    );
  })
  .catch((error) => {
    console.error(
      JSON.stringify({
        msg: "worker_schedule_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
