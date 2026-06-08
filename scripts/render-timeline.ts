#!/usr/bin/env bun
// Renders an SVG event-timeline for every reports/*.json produced by the
// E2E harness. Workflow rasterises the SVGs to PNG via ImageMagick and
// attaches both to the PR artifact bundle.
//
//   bun ./scripts/render-timeline.ts [--dir reports]

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { dir: { type: "string", default: "reports" } },
});
const DIR = path.resolve(process.cwd(), values.dir!);

type Entry = {
  ts: number;
  phase: "boot" | "subscribe" | "event" | "call" | "assert";
  label: string;
  status: "ok" | "fail" | "warn" | "info";
  expected?: unknown; actual?: unknown; diff?: string;
};
type Report = {
  name: string; provider: string; mode: string; durationMs: number; exitCode: number;
  counts: { ok: number; fail: number; warn: number };
  timeline: Entry[];
};

const COLOR = {
  ok: "#16a34a", fail: "#dc2626", warn: "#d97706", info: "#0891b2",
} as const;
const ICON = { ok: "✓", fail: "✗", warn: "!", info: "▸" } as const;
const PHASE_BG = {
  boot: "#1e293b", subscribe: "#0c4a6e", event: "#1e3a8a",
  call: "#3b0764", assert: "#0f172a",
} as const;

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" })[c]!);
}

function render(r: Report): string {
  const W = 1200, ROW = 28, PAD_TOP = 100, PAD_L = 110;
  const H = PAD_TOP + r.timeline.length * ROW + 40;
  const overall = r.exitCode === 0
    ? (r.counts.warn ? { txt: "PASS (warnings)", fill: COLOR.warn } : { txt: "PASS", fill: COLOR.ok })
    : { txt: "FAIL", fill: COLOR.fail };

  const rows = r.timeline.map((e, i) => {
    const y = PAD_TOP + i * ROW;
    const label = e.label.length > 110 ? e.label.slice(0, 107) + "…" : e.label;
    return `
      <g>
        <rect x="0" y="${y - 2}" width="${W}" height="${ROW}" fill="${i % 2 ? "#0b1220" : "#0f172a"}"/>
        <text x="20" y="${y + 17}" fill="#64748b" font-family="ui-monospace,monospace" font-size="12">+${e.ts}ms</text>
        <rect x="${PAD_L - 90}" y="${y + 3}" width="78" height="18" rx="4" fill="${PHASE_BG[e.phase]}"/>
        <text x="${PAD_L - 51}" y="${y + 17}" fill="#e2e8f0" font-family="ui-sans-serif" font-size="11" text-anchor="middle">${e.phase}</text>
        <text x="${PAD_L}" y="${y + 17}" fill="${COLOR[e.status]}" font-family="ui-sans-serif" font-size="14" font-weight="700">${ICON[e.status]}</text>
        <text x="${PAD_L + 20}" y="${y + 17}" fill="#e5e7eb" font-family="ui-monospace,monospace" font-size="12">${esc(label)}</text>
      </g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0b0f17"/>
  <text x="24" y="40" fill="#e5e7eb" font-family="ui-sans-serif" font-size="22" font-weight="700">ShipKit E2E timeline</text>
  <rect x="${W - 200}" y="20" width="176" height="30" rx="15" fill="${overall.fill}"/>
  <text x="${W - 112}" y="40" fill="#fff" font-family="ui-sans-serif" font-size="14" font-weight="700" text-anchor="middle">${overall.txt}</text>
  <text x="24" y="68" fill="#9ca3af" font-family="ui-monospace,monospace" font-size="12">${esc(r.name)} · ${esc(r.provider)} · ${r.durationMs}ms · ${r.counts.ok} ok / ${r.counts.fail} fail / ${r.counts.warn} warn</text>
  <line x1="0" y1="92" x2="${W}" y2="92" stroke="#1f2937"/>
  ${rows}
</svg>`;
}

if (!fs.existsSync(DIR)) {
  console.error(`No directory: ${DIR}`);
  process.exit(0);
}
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Report;
  if (!Array.isArray(r.timeline)) continue;
  const out = path.join(DIR, f.replace(/\.json$/, "-timeline.svg"));
  fs.writeFileSync(out, render(r));
  console.log(`▸ ${out}`);
}