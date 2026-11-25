import fs from "node:fs";
import path from "node:path";
import { tokensFor, baseStyle, sheetFrame, titleBlock, revStamp, MONO_ADVANCE } from "./sheet.mjs";

/**
 * Profile card: sheet 01. A hidden-line drawing of the chip, as on somyacodes.in.
 */

export const WIDTH = 1180;
export const HEIGHT = 586;

export const DEFAULT_CONFIG = {
  username: "somyacodes07",
  name: "Somyajeet Singh",
  partNumber: "SS-2029",
  site: "somyacodes.in",
  tagline: "Full-stack software engineer. I build the database, the API, the interface and the pipeline that ships them.",
  specs: [
    { label: "status", value: "open to software engineering internships", live: true },
    { label: "experience", value: "devops intern, springer capital '26" },
    { label: "studying", value: "b.tech cs (ai & ml), class of '29" },
    { label: "based", value: "navi mumbai, india" },
    { label: "stack", value: "react · next.js · fastapi · node · postgres" },
    { label: "find me", value: "somyacodes.in · in/somyajeetsingh" }
  ],
  callouts: [
    { part: "lid", text: "lid: full-stack engineer" },
    { part: "die", text: "die: cs (ai & ml), '29" },
    { part: "pins", text: "pins: python · rust · ts · java" },
    { part: "caps", text: "caps: claude code · codex · hermes" },
    { part: "bus", text: "bus: docker · actions · vercel" }
  ],
  heatmap: {
    title: "Every commit, last 52 weeks"
  }
};

export function loadProfileConfig(configPath = "profile.config.json") {
  try {
    const resolved = path.resolve(configPath);
    if (fs.existsSync(resolved)) {
      const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        specs: Array.isArray(parsed.specs) ? parsed.specs : DEFAULT_CONFIG.specs,
        callouts: Array.isArray(parsed.callouts) ? parsed.callouts : DEFAULT_CONFIG.callouts,
        heatmap: { ...DEFAULT_CONFIG.heatmap, ...(parsed.heatmap || {}) }
      };
    }
  } catch (err) {
    console.warn(`Could not read config at ${configPath}, using defaults: ${err.message}`);
  }
  return { ...DEFAULT_CONFIG };
}

export function escapeXml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/on\w+\s*=/gi, "disarmed=")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word wrap by character budget. */
export function wrapText(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shorten to a character budget with an ellipsis. */
export function clip(text, maxChars) {
  const s = String(text ?? "");
  return s.length > maxChars ? s.slice(0, Math.max(0, maxChars - 1)) + "…" : s;
}

// ---------- isometric chip ----------

const ISO = { ox: 752, oy: 156, s: 1.36 };
const COS30 = Math.cos(Math.PI / 6);

export function iso(x, y, z = 0) {
  return [ISO.ox + (x - y) * COS30 * ISO.s, ISO.oy + (x + y) * 0.5 * ISO.s - z * ISO.s];
}

const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
const poly = (pts) => pts.map(p => pt(iso(...p))).join(" ");

class Pen {
  constructor(t) {
    this.t = t;
    this.parts = [];
    this.i = 0;
    this.start = 0.25;
    this.step = 0.014;
  }
  delay() {
    return (this.start + this.i++ * this.step).toFixed(3);
  }
  face(pts, stroke, fill) {
    this.parts.push(`<polygon points="${poly(pts)}" fill="${fill ?? this.t.bg}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" pathLength="1" class="pen" style="animation-delay:${this.delay()}s"/>`);
  }
  box(x, y, z, w, d, h, stroke = this.t.ink2) {
    const x1 = x + w, y1 = y + d, zt = z + h;
    this.face([[x, y1, zt], [x1, y1, zt], [x1, y1, z], [x, y1, z]], stroke);
    this.face([[x1, y, zt], [x1, y1, zt], [x1, y1, z], [x1, y, z]], stroke);
    this.face([[x, y, zt], [x1, y, zt], [x1, y1, zt], [x, y1, zt]], stroke);
  }
  path(d, stroke, extra = "") {
    this.parts.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1" pathLength="1" class="pen" style="animation-delay:${this.delay()}s" ${extra}/>`);
  }
  raw(svg) {
    this.parts.push(svg);
  }
}

const seg = (a, b) => `M${pt(iso(...a))}L${pt(iso(...b))}`;

/** 3-D anchor point for each callout part. */
export const CALLOUT_ANCHORS = {
  ram: [96, 30, 16],
  lid: [132, 96, 47],
  die: [120, 104, 12],
  pins: [137, 128, 9],
  caps: [156, 80, 13],
  bus: [194, 116, 4]
};

export function buildChip(t, partNumber = "SS-2029") {
  const pen = new Pen(t);
  const Z = 4; // board top

  // board
  pen.box(0, 0, 0, 200, 200, Z, t.ink2);

  // copper traces on the board top
  const traces = [];
  for (let k = 0; k < 9; k++) {
    const y = 68 + k * 8;
    const jog = 152 + (k % 3) * 8;
    traces.push(`${seg([140, y, Z], [jog, y, Z])}L${pt(iso(jog + 8, y + (k < 4 ? -8 : 8), Z))}L${pt(iso(194, y + (k < 4 ? -8 : 8), Z))}`);
  }
  for (let k = 0; k < 9; k++) {
    const x = 68 + k * 8;
    traces.push(seg([x, 140, Z], [x, 194, Z]));
  }
  for (let k = 0; k < 6; k++) {
    const y = 72 + k * 11;
    traces.push(seg([60, y, Z], [42, y, Z]));
    const x = 70 + k * 11;
    traces.push(seg([x, 60, Z], [x, 46, Z]));
  }
  pen.path(traces.join(""), t.line2);

  // live signal pulses along a few traces (start once the drawing settles)
  const pulses = [0, 3, 7, 10, 14, 16].map((n, i) =>
    `<path d="${traces[n]}" fill="none" stroke="${t.red}" stroke-width="1.6" stroke-linecap="round" pathLength="1" stroke-dasharray=".12 .88" style="animation:pulse 2.6s linear ${(2.4 + i * 0.37).toFixed(2)}s infinite;opacity:0"/>`
  );

  // behind the package: RAM sticks, VRM bank, back caps
  for (let i = 0; i < 4; i++) pen.box(14, 6 + i * 8, Z, 96, 3, 12, t.ink2);
  for (let i = 0; i < 5; i++) pen.box(22, 66 + i * 15, Z, 11, 11, 7, t.ink2);
  pen.box(66, 48, Z, 6, 6, 8, t.ink3);
  pen.box(120, 48, Z, 6, 6, 8, t.ink3);

  // package substrate
  pen.box(60, 60, Z, 80, 80, 5, t.ink);
  const S = Z + 5;
  const pads = [];
  for (let k = 0; k < 12; k++) {
    const a = 64 + k * 6;
    pads.push(`M${poly([[a, 134, S], [a + 3, 134, S], [a + 3, 137, S], [a, 137, S]])}Z`);
    pads.push(`M${poly([[134, a, S], [137, a, S], [137, a + 3, S], [134, a + 3, S]])}Z`);
  }
  pen.path(pads.join(""), t.line2);

  // die
  pen.box(80, 80, S, 40, 40, 3, t.ink);
  const D = S + 3;
  const dieLines = [];
  for (let k = 1; k < 5; k++) {
    dieLines.push(seg([80 + k * 8, 80, D], [80 + k * 8, 120, D]));
    dieLines.push(seg([80, 80 + k * 8, D], [120, 80 + k * 8, D]));
  }
  pen.path(dieLines.join(""), t.line2);

  // caps in front
  for (const [x, y] of [[148, 62], [148, 76], [64, 148], [78, 148], [148, 122]]) pen.box(x, y, Z, 7, 7, 9, t.ink2);

  // exploded lid with guide lines down to the substrate
  const L = 42;
  const guides = [[68, 68], [132, 68], [132, 132], [68, 132]].map(([x, y]) => seg([x, y, L], [x, y, S])).join("");
  pen.raw(`<path d="${guides}" fill="none" stroke="${t.line2}" stroke-dasharray="3 4" class="rise" style="animation-delay:1.5s"/>`);
  pen.box(68, 68, L, 64, 64, 5, t.ink);

  // part number engraved on the lid top
  const top = L + 5;
  const [lx, ly] = iso(100, 100, top);
  const k = ISO.s * 0.9;
  const m = [COS30 * k, 0.5 * k, -COS30 * k, 0.5 * k].map(v => v.toFixed(4)).join(",");
  const pin1 = iso(74, 74, top);
  pen.raw(`<g class="rise" style="animation-delay:1.7s"><text transform="matrix(${m},${lx.toFixed(1)},${ly.toFixed(1)})" text-anchor="middle" dy="4" class="mono i2" font-size="11" letter-spacing=".12em">${escapeXml(clip(partNumber, 10))}</text><circle cx="${pin1[0].toFixed(1)}" cy="${pin1[1].toFixed(1)}" r="2" fill="${t.red}"/></g>`);

  return { svg: pen.parts.join("\n"), pulses: pulses.join("\n") };
}

/** Leader-line callouts, right-aligned like the portfolio hero. */
export function buildCallouts(t, callouts, { right = WIDTH - 40, top = 104, gap = 44 } = {}) {
  const items = callouts
    .filter(c => c && CALLOUT_ANCHORS[c.part] && c.text)
    .slice(0, 7)
    .map(c => {
      const text = clip(c.text, 34);
      return { ...c, text, w: text.length * 12 * MONO_ADVANCE, at: iso(...CALLOUT_ANCHORS[c.part]) };
    });
  if (!items.length) return "";

  // Every underline stops at one shared column; ordering anchors by angle from it keeps leaders from crossing.
  const elbowX = right - Math.max(...items.map(c => c.w)) - 10;
  const midY = top + ((items.length - 1) * gap) / 2;
  items.sort((a, b) => Math.atan2(a.at[1] - midY, elbowX - a.at[0]) - Math.atan2(b.at[1] - midY, elbowX - b.at[0]));

  return items.map((c, i) => {
    const y = top + i * gap;
    const x0 = right - c.w;
    const [ax, ay] = c.at;
    const colon = c.text.indexOf(":");
    const key = colon > 0 ? c.text.slice(0, colon + 1) : "";
    const rest = colon > 0 ? c.text.slice(colon + 1) : c.text;
    const delay = (1.8 + i * 0.12).toFixed(2);
    const live = c.part === "ram";
    return `<g>
  <path d="M${right} ${y + 7}H${elbowX.toFixed(1)}L${ax.toFixed(1)} ${ay.toFixed(1)}" fill="none" stroke="${t.line2}" pathLength="1" class="pen" style="animation-delay:${delay}s"/>
  <g class="rise" style="animation-delay:${delay}s">
    <rect x="${(x0 - 4).toFixed(1)}" y="${y - 11}" width="${(c.w + 6).toFixed(1)}" height="16" fill="${t.bg}"/>
    <text x="${right}" y="${y}" text-anchor="end" class="mono i2" font-size="12"><tspan class="${live ? "red" : "mono"}">${escapeXml(key)}</tspan>${escapeXml(rest)}</text>
    <circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.6" fill="${t.bg}" stroke="${live ? t.red : t.ink}" stroke-width="1.2"${live ? ' style="animation:blink 1.6s ease-in-out 2.5s infinite"' : ""}/>
  </g>
</g>`;
  }).join("\n");
}

export function buildSpecTable(t, specs, { x = 56, y = 300, w = 470, row = 34, labelW = 118 } = {}) {
  const rows = (specs || []).slice(0, 7);
  let out = "";
  rows.forEach((s, i) => {
    const ry = y + i * row;
    const delay = (0.9 + i * 0.08).toFixed(2);
    const valueX = x + labelW + (s.live ? 14 : 0);
    out += `<g class="rise" style="animation-delay:${delay}s">
  <path d="M${x} ${ry}h${w}" stroke="${t.line2}"/>
  <text x="${x}" y="${ry + 22}" class="mono i3" font-size="12">${escapeXml(clip(s.label, 14))}</text>
  ${s.live ? `<circle cx="${x + labelW + 4}" cy="${ry + 18}" r="3.5" fill="${t.live}" style="animation:blink 2.4s ease-in-out 2s infinite"/>` : ""}
  <text x="${valueX}" y="${ry + 22}" class="mono" font-size="12.5">${escapeXml(clip(s.value, s.live ? 44 : 46))}</text>
</g>\n`;
  });
  if (rows.length) out += `<path class="rise" style="animation-delay:1.4s" d="M${x} ${y + rows.length * row}h${w}" stroke="${t.line2}"/>`;
  return out;
}

export function buildProfileSvg(config = DEFAULT_CONFIG, options = {}) {
  const theme = options.theme === "light" ? "light" : "dark";
  const t = tokensFor(theme);
  const date = options.date || new Date();
  const rev = revStamp(date);
  const part = escapeXml(config.partNumber || "SS-2029");
  const name = escapeXml(clip(config.name || config.username, 24));
  const site = escapeXml(config.site || "");
  const user = escapeXml(config.username || "");

  const callouts = [...(config.callouts || [])];
  if (Number.isFinite(options.commits)) {
    callouts.unshift({ part: "ram", text: `ram: ${options.commits.toLocaleString("en-US")} commits in 52 weeks` });
  }

  const tagline = wrapText(config.tagline, 46).slice(0, 3);
  const chip = buildChip(t, config.partNumber || "SS-2029");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${name}: ${escapeXml(config.tagline || "")}">
<title>${name}</title>
<style>
${baseStyle(t)}
@keyframes pulse{0%{opacity:1;stroke-dashoffset:1}100%{opacity:1;stroke-dashoffset:0}}
</style>
${sheetFrame(t, WIDTH, HEIGHT)}

<g id="nav" class="rise" style="animation-delay:.1s">
  <rect x="40" y="31" width="16" height="16" rx="2" fill="none" stroke="${t.ink}"/>
  <rect x="44.5" y="35.5" width="7" height="7" fill="${t.ink}"/>
  <text x="66" y="44" class="mono" font-size="13">${escapeXml((config.site || user).replace(/\..*$/, ""))}</text>
  <text x="${WIDTH - 40}" y="44" text-anchor="end" class="mono i2" font-size="12">${site}${site && user ? "   ·   " : ""}github.com/${user}</text>
</g>
<path d="M12 62H${WIDTH - 12}" stroke="${t.line2}"/>

<g id="chip">
${chip.svg}
${chip.pulses}
</g>

<g id="intro">
  <g class="rise" style="animation-delay:.25s">
    <text x="56" y="118" class="mono i2" font-size="14" letter-spacing=".02em">${part}</text>
    <path d="M${62 + part.length * 8.4} 113h34" stroke="${t.line2}"/>
    <text x="${104 + part.length * 8.4}" y="118" class="mono i2" font-size="14">rev ${rev}</text>
  </g>
  <text x="54" y="178" class="sans rise" font-size="52" font-weight="600" letter-spacing="-.02em" style="animation-delay:.4s">${name}</text>
  ${tagline.map((l, i) => `<text x="56" y="${222 + i * 27}" class="sans i2 rise" font-size="19.5" style="animation-delay:${(0.55 + i * 0.07).toFixed(2)}s">${escapeXml(l)}</text>`).join("\n  ")}
</g>

<g id="specs">
${buildSpecTable(t, config.specs, { y: 222 + tagline.length * 27 + 12 })}
</g>

<g id="callouts">
${buildCallouts(t, callouts)}
</g>

<text x="40" y="550" class="mono i3 rise" font-size="10.5" style="animation-delay:1.6s">fig. 1 — the build, exploded. hidden-line, not to scale.</text>
${titleBlock(t, [
    { k: "DRAWN", v: user, w: 132 },
    { k: "PART", v: part, w: 86 },
    { k: "SHEET", v: "01 / 02", w: 74 },
    { k: "REV", v: rev, w: 64 }
  ], WIDTH - 40, 526)}
</svg>`;
}
