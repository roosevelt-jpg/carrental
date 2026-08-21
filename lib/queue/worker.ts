import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./connection";
import { QUEUE_NAMES, ensureRecurringJobs } from "./queues";
import { initSentry } from "@/lib/observability/sentry";

initSentry("worker");

const connection = getRedisConnection();

const inboundWorker = new Worker(
  QUEUE_NAMES.inboundMessage,
  async (job) => {
    const { processInboundMessage } = await import("./jobs/process-inbound-message");
    return processInboundMessage(job.data);
  },
  { connection },
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

for (const worker of [inboundWorker, reminderWorker, mediaWorker, droppedWorker]) {
  worker.on("failed", (job, error) => {
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
