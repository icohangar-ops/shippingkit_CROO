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

// Focused thumbnail for a single failing/warning step: shows the step plus
// up to two neighbours on either side as context, with the focal row
// highlighted. Designed to embed inline in PR comments (~640x180 PNG).
function renderThumb(r: Report, focusIdx: number): string {
  const W = 720, ROW = 26, PAD_TOP = 64, PAD_L = 110;
  const lo = Math.max(0, focusIdx - 2);
  const hi = Math.min(r.timeline.length, focusIdx + 3);
  const window = r.timeline.slice(lo, hi);
  const H = PAD_TOP + window.length * ROW + 20;
  const f = r.timeline[focusIdx]!;
  const focusColor = COLOR[f.status];

  const rows = window.map((e, i) => {
    const absIdx = lo + i;
    const y = PAD_TOP + i * ROW;
    const focused = absIdx === focusIdx;
    const bg = focused ? "#1c1626" : (i % 2 ? "#0b1220" : "#0f172a");
    const label = e.label.length > 78 ? e.label.slice(0, 75) + "…" : e.label;
    const border = focused
      ? `<rect x="2" y="${y - 1}" width="${W - 4}" height="${ROW - 1}" rx="4" fill="none" stroke="${focusColor}" stroke-width="2"/>`
      : "";
    return `
      <rect x="0" y="${y - 2}" width="${W}" height="${ROW}" fill="${bg}"/>
      <text x="14" y="${y + 16}" fill="#64748b" font-family="ui-monospace,monospace" font-size="11">+${e.ts}ms</text>
      <rect x="${PAD_L - 86}" y="${y + 3}" width="72" height="17" rx="4" fill="${PHASE_BG[e.phase]}"/>
      <text x="${PAD_L - 50}" y="${y + 16}" fill="#e2e8f0" font-family="ui-sans-serif" font-size="10" text-anchor="middle">${e.phase}</text>
      <text x="${PAD_L}" y="${y + 16}" fill="${COLOR[e.status]}" font-family="ui-sans-serif" font-size="13" font-weight="700">${ICON[e.status]}</text>
      <text x="${PAD_L + 18}" y="${y + 16}" fill="#e5e7eb" font-family="ui-monospace,monospace" font-size="11">${esc(label)}</text>
      ${border}`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0b0f17"/>
  <rect x="0" y="0" width="6" height="${H}" fill="${focusColor}"/>
  <text x="20" y="28" fill="#e5e7eb" font-family="ui-sans-serif" font-size="14" font-weight="700">Step #${focusIdx + 1} · ${f.phase}</text>
  <text x="20" y="48" fill="${focusColor}" font-family="ui-monospace,monospace" font-size="11">${ICON[f.status]} ${esc(f.label.slice(0, 96))}</text>
  <line x1="0" y1="58" x2="${W}" y2="58" stroke="#1f2937"/>
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

  // Per-failing-step thumbnails (also covers warnings for inline triage).
  const base = f.replace(/\.json$/, "");
  const failing = r.timeline
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.status === "fail" || e.status === "warn");
  for (const { i } of failing) {
    const thumbPath = path.join(DIR, `${base}-step-${String(i).padStart(3, "0")}.svg`);
    fs.writeFileSync(thumbPath, renderThumb(r, i));
    console.log(`▸ ${thumbPath}`);
  }
}