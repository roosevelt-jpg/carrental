import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";

export const QUEUE_NAMES = {
  inboundMessage: "process-inbound-message",
  escalationReminder: "escalation-reminder",
  mediaReupload: "media-reupload",
  markDropped: "mark-dropped-conversations",
} as const;

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

let inboundQueue: Queue | null = null;
let escalationQueue: Queue | null = null;
let mediaQueue: Queue | null = null;
let markDroppedQueue: Queue | null = null;

export function getInboundMessageQueue() {
  inboundQueue ??= new Queue(QUEUE_NAMES.inboundMessage, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  return inboundQueue;
}

export function getEscalationReminderQueue() {
  escalationQueue ??= new Queue(QUEUE_NAMES.escalationReminder, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  return escalationQueue;
}

export function getMediaReuploadQueue() {
  mediaQueue ??= new Queue(QUEUE_NAMES.mediaReupload, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  return mediaQueue;
}

export function getMarkDroppedQueue() {
  markDroppedQueue ??= new Queue(QUEUE_NAMES.markDropped, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  return markDroppedQueue;
}

export async function ensureRecurringJobs() {
  const queue = getMarkDroppedQueue();
  await queue.upsertJobScheduler(
    "mark-dropped-hourly",
    { every: 60 * 60 * 1000 },
    {
      name: "sweep",
      data: { idleHours: 72 },
    },
  );
}
