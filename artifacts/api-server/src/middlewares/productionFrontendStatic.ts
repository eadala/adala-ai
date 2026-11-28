/**
 * Production frontend static delivery.
 *
 * Early (before Clerk): serve allowlisted `/assets/*` + root static files.
 * Late (after /api): SPA HTML fallback for client routes only.
 *
 * Never serves source trees, `.env`, or arbitrary filesystem paths.
 */
import type { Express, RequestHandler } from "express";
import express from "express";
import path from "node:path";
import { isSensitiveDotPath } from "../lib/sensitiveStaticPath";
import {
  isPublicFrontendAssetPath,
  isSpaFallbackPath,
} from "../lib/publicFrontendAssetPath";

export type ProductionFrontendStaticOptions = {
  publicDir: string;
  /** When true, register even if NODE_ENV is not production (tests). */
  force?: boolean;
};

/** Skip Clerk (and similar) for allowlisted frontend asset paths. */
export function skipAuthForPublicFrontendAssets(req: {
  path?: string;
  originalUrl?: string;
  url?: string;
}): boolean {
  const raw = req.path || req.originalUrl || req.url || "";
  const pathOnly = String(raw).split("?")[0];
  return isPublicFrontendAssetPath(pathOnly);
}

function resolvedPublicDir(opts: ProductionFrontendStaticOptions): string | null {
  if (process.env.NODE_ENV !== "production" && !opts.force) return null;
  return path.resolve(opts.publicDir);
}

/**
 * BEFORE Clerk/API auth: sensitive-path guard + allowlisted static files.
 * Missing `/assets/*` → 404 text/plain (never SPA HTML, never auth JSON).
 */
export function registerEarlyProductionFrontendAssets(
  app: Express,
  opts: ProductionFrontendStaticOptions,
): void {
  const publicDir = resolvedPublicDir(opts);
  if (!publicDir) return;

  app.use((req, res, next) => {
    if (isSensitiveDotPath(req.path)) {
      return void res.status(404).end();
    }
    next();
  });

  const assetStatic = express.static(publicDir, {
    maxAge: "1d",
    etag: true,
    index: false,
    fallthrough: true,
    redirect: false,
  });

  const gatedStatic: RequestHandler = (req, res, next) => {
    if (!isPublicFrontendAssetPath(req.path)) return next();
    return assetStatic(req, res, next);
  };
  app.use(gatedStatic);

  app.use((req, res, next) => {
    if (!isPublicFrontendAssetPath(req.path)) return next();
    // Reached only when allowlisted path was not found on disk.
    res.status(404).type("text/plain").send("Not Found");
  });
}

/**
 * AFTER /api routers: SPA HTML fallback for non-API, non-asset GETs.
 */
export function registerProductionSpaFallback(
  app: Express,
  opts: ProductionFrontendStaticOptions,
): void {
  const publicDir = resolvedPublicDir(opts);
  if (!publicDir) return;

  app.get(/.*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!isSpaFallbackPath(req.path)) return next();
    if (isSensitiveDotPath(req.path)) {
      return void res.status(404).end();
    }
    res.sendFile("index.html", { root: publicDir }, (err) => {
      if (err) next(err);
    });
  });
}

/** @deprecated use registerEarlyProductionFrontendAssets + registerProductionSpaFallback */
export function registerProductionFrontendStatic(
  app: Express,
  opts: ProductionFrontendStaticOptions,
): void {
  registerEarlyProductionFrontendAssets(app, opts);
  registerProductionSpaFallback(app, opts);
}
