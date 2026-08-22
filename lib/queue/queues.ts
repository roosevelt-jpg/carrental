import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";
import { getCmsSettings } from "@/lib/cms/content";

export const QUEUE_NAMES = {
  inboundMessage: "process-inbound-message",
  whatsappWebhook: "whatsapp-webhook-event",
  escalationReminder: "escalation-reminder",
  mediaReupload: "media-reupload",
  markDropped: "mark-dropped-conversations",
  expireQuotes: "expire-quotes",
  retention: "retention-sweep",
  weeklyDigest: "weekly-digest",
} as const;

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

let inboundQueue: Queue | null = null;
let whatsappWebhookQueue: Queue | null = null;
let escalationQueue: Queue | null = null;
let mediaQueue: Queue | null = null;
let markDroppedQueue: Queue | null = null;
let expireQuotesQueue: Queue | null = null;
let retentionQueue: Queue | null = null;
let weeklyDigestQueue: Queue | null = null;

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

export function getWhatsAppWebhookQueue() {
  whatsappWebhookQueue ??= new Queue(QUEUE_NAMES.whatsappWebhook, { connection: getRedisConnection(), defaultJobOptions });
  return whatsappWebhookQueue;
}

export function getExpireQuotesQueue() {
  expireQuotesQueue ??= new Queue(QUEUE_NAMES.expireQuotes, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  return expireQuotesQueue;
}

export function getRetentionQueue() {
  retentionQueue ??= new Queue(QUEUE_NAMES.retention, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  return retentionQueue;
}

export function getWeeklyDigestQueue() {
  weeklyDigestQueue ??= new Queue(QUEUE_NAMES.weeklyDigest, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  return weeklyDigestQueue;
}

export async function ensureRecurringJobs() {
  const cms = await getCmsSettings();
  const timezone = validTimezone(cms.timezone);
  await getMarkDroppedQueue().upsertJobScheduler(
    "mark-dropped-hourly",
    { every: 60 * 60 * 1000 },
    {
      name: "sweep",
      data: { idleHours: 72 },
    },
  );
  await getExpireQuotesQueue().upsertJobScheduler(
    "expire-quotes-five-minutes",
    { every: 5 * 60 * 1000 },
    { name: "sweep", data: {} },
  );
  await getRetentionQueue().upsertJobScheduler(
    "retention-daily",
    { pattern: "0 3 * * *" },
    { name: "sweep", data: {} },
  );
  if (timezone) {
    await getWeeklyDigestQueue().upsertJobScheduler(
      "weekly-digest-monday",
      { pattern: "0 9 * * 1", tz: timezone },
      { name: "send", data: { days: 7 } },
    );
    await getMediaReuploadQueue().upsertJobScheduler(
      "refresh-whatsapp-media-daily",
      { pattern: "30 2 * * *", tz: timezone },
      { name: "refresh", data: {} },
    );
  } else {
    await getWeeklyDigestQueue().removeJobScheduler("weekly-digest-monday");
    await getMediaReuploadQueue().removeJobScheduler("refresh-whatsapp-media-daily");
  }
}

function validTimezone(value: string) {
  const timezone = value.trim();
  if (!timezone) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return null;
  }
}
