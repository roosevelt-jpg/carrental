import IORedis from "ioredis";
import { getRedisUrl } from "@/lib/env";

let connection: IORedis | null = null;

export function getRedisConnection() {
  connection ??= new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
  });
  return connection;
}
