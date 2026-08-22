"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [intervalMs, router]);
  return <span className="inline-flex items-center gap-2 text-xs text-ok"><i className="h-2 w-2 animate-pulse rounded-full bg-ok" />Live</span>;
}
