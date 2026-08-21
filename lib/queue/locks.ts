import { randomUUID } from "node:crypto";
import { getRedisConnection } from "@/lib/queue/connection";

const LOCK_TTL_MS = 120_000;

export class LockBusyError extends Error {
  constructor(key: string) {
    super(`Processing lock is busy: ${key}`);
    this.name = "LockBusyError";
  }
}

export async function withDistributedLock<T>(key: string, work: () => Promise<T>) {
  const redis = getRedisConnection();
  const token = randomUUID();
  const acquired = await redis.set(key, token, "PX", LOCK_TTL_MS, "NX");
  if (acquired !== "OK") throw new LockBusyError(key);

  const renewal = setInterval(() => {
    void redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
      1,
      key,
      token,
      LOCK_TTL_MS,
    );
  }, LOCK_TTL_MS / 3);
  renewal.unref();

  try {
    return await work();
  } finally {
    clearInterval(renewal);
    await redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token,
    );
  }
}
