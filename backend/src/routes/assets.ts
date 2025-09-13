import { Router, type Request, type Response } from "express";
import data from "../data/assets.json";
import type { Asset } from "../types";

const router = Router();
const ALL_ASSETS = data as Asset[];

function parseBBox(bbox?: string) {
  if (!bbox) return null;
  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;
  return { minLon, minLat, maxLon, maxLat };
}

function inBBox(asset: Asset, bbox: ReturnType<typeof parseBBox>) {
  if (!bbox) return true;
  const [lon, lat] = asset.centroid;
  return (
    lon >= bbox.minLon &&
    lon <= bbox.maxLon &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

router.get("/", (req: Request, res: Response) => {
  const {
    bbox,            // "minLon,minLat,maxLon,maxLat"
    type,            // "building" | "road" | "poi"
    minHeight,       // number
    maxHeight,       // number
    q,               // text search
    limit = "100",
    offset = "0",
  } = req.query as Record<string, string>;

  const bboxObj = parseBBox(bbox);
  let items = ALL_ASSETS.filter((a) => inBBox(a, bboxObj));

  if (type) items = items.filter((a) => a.type === type);
  if (minHeight) items = items.filter((a) => (a.height ?? -Infinity) >= Number(minHeight));
  if (maxHeight) items = items.filter((a) => (a.height ?? Infinity) <= Number(maxHeight));
  if (q) {
    const s = q.toLowerCase();
    items = items.filter((a) => a.name.toLowerCase().includes(s));
  }

  const total = items.length;
  const lim = Math.min(Math.max(Number(limit), 1), 1000);
  const off = Math.max(Number(offset), 0);
  const page = items.slice(off, off + lim);

  res.json({ items: page, total });
});

export default router;
