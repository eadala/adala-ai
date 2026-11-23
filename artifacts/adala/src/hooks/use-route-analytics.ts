/**
 * Route Analytics Hook — عدالة AI Platform
 * يقيس عدد مرات استخدام كل Route وزمن تحميله
 * البيانات تُحفظ في localStorage وتُرسل للخادم بشكل دفعي كل 5 دقائق
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { findRoute } from "@/lib/routeRegistry";

const STORAGE_KEY = "adala:route_analytics";
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_BUFFER_SIZE = 200;

interface RouteVisit {
  path: string;
  nameInternal?: string;
  module?: string;
  ts: number;
  loadMs?: number;
}

function getBuffer(): RouteVisit[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveBuffer(buf: RouteVisit[]) {
  try {
    const trimmed = buf.slice(-MAX_BUFFER_SIZE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full — ignore */
  }
}

async function flushBuffer() {
  const buf = getBuffer();
  if (buf.length === 0) return;
  try {
    const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    await fetch(`${BASE}/api/metrics/route-analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ visits: buf }),
    });
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* offline — buffer stays for next flush */
  }
}

export function useRouteAnalytics() {
  const [location] = useLocation();
  const enterTime = useRef<number>(Date.now());
  const prevPath = useRef<string>("");

  useEffect(() => {
    const path = location;
    if (path === prevPath.current) return;

    const loadMs = Date.now() - enterTime.current;
    enterTime.current = Date.now();
    prevPath.current = path;

    const def = findRoute(path);
    const visit: RouteVisit = {
      path,
      nameInternal: def?.nameInternal,
      module: def?.module,
      ts: Date.now(),
      loadMs: loadMs > 0 && loadMs < 60_000 ? loadMs : undefined,
    };

    const buf = getBuffer();
    buf.push(visit);
    saveBuffer(buf);
  }, [location]);

  useEffect(() => {
    const id = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
    window.addEventListener("beforeunload", flushBuffer);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", flushBuffer);
    };
  }, []);
}
