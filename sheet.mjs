/**
 * Shared drawing-sheet look for the profile cards.
 * Tokens, fonts and type match somyacodes.in (warm paper, ink lines, red signal).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const TOKENS = {
  dark: {
    bg: "#232120",
    bg2: "#2B2927",
    bg3: "#34312F",
    ink: "#E2DFDA",
    ink2: "#B2ADA6",
    ink3: "#A19A93",
    line: "rgba(226,223,218,0.14)",
    line2: "rgba(226,223,218,0.30)",
    grid: "rgba(226,223,218,0.045)",
    red: "#E5483A",
    redText: "#F47466",
    live: "#4CC9C0"
  },
  light: {
    bg: "#D9D5CF",
    bg2: "#E2DFDA",
    bg3: "#CFCAC3",
    ink: "#2B2927",
    ink2: "#57534E",
    ink3: "#5A554F",
    line: "rgba(43,41,39,0.16)",
    line2: "rgba(43,41,39,0.32)",
    grid: "rgba(35,33,32,0.06)",
    red: "#E5483A",
    redText: "#9E2B20",
    live: "#1E8C8A"
  }
};

export function tokensFor(theme = "dark") {
  return theme === "light" ? TOKENS.light : TOKENS.dark;
}

/** Monospace advance for IBM Plex Mono (600 units per em). */
export const MONO_ADVANCE = 0.6;

const FONT_FILES = [
  ["Archivo", 400, "archivo-400.woff2"],
  ["Archivo", 600, "archivo-600.woff2"],
  ["Plex Mono", 400, "plex-mono-400.woff2"],
  ["Plex Mono", 500, "plex-mono-500.woff2"]
];

let fontCache = null;

/** Subset fonts embedded as data URIs; GitHub serves README SVGs as images, so web fonts cannot load. */
export function fontFaces() {
  if (fontCache !== null) return fontCache;
  fontCache = FONT_FILES.map(([family, weight, file]) => {
    const p = path.join(HERE, "fonts", file);
    if (!fs.existsSync(p)) return "";
    const b64 = fs.readFileSync(p).toString("base64");
    return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join("\n");
  return fontCache;
}

export const SANS = "'Archivo','Helvetica Neue',Arial,sans-serif";
export const MONO = "'Plex Mono','IBM Plex Mono',ui-monospace,Menlo,monospace";

/** Base CSS shared by every sheet: type, pen-plot reveal, reduced motion. */
export function baseStyle(t) {
  return `${fontFaces()}
text{white-space:pre}
.sans{font-family:${SANS};fill:${t.ink}}
.mono{font-family:${MONO};fill:${t.ink}}
.i2{fill:${t.ink2}}
.i3{fill:${t.ink3}}
.red{fill:${t.redText}}
.pen{stroke-dasharray:1;stroke-dashoffset:1;animation:pen 1.2s cubic-bezier(.16,1,.3,1) forwards}
.rise{opacity:0;animation:rise .7s cubic-bezier(.16,1,.3,1) forwards}
@keyframes pen{to{stroke-dashoffset:0}}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;opacity:1!important;stroke-dashoffset:0!important}}`;
}

/** Faint drafting grid, sheet border and zone ticks. */
export function sheetFrame(t, width, height, { gridStep = 24, inset = 12 } = {}) {
  const ticks = [];
  const zonesX = 8;
  const zonesY = Math.max(2, Math.round(height / 150));
  for (let i = 1; i < zonesX; i++) {
    const x = inset + ((width - inset * 2) * i) / zonesX;
    ticks.push(`M${x.toFixed(1)} ${inset}v6M${x.toFixed(1)} ${height - inset}v-6`);
  }
  for (let i = 1; i < zonesY; i++) {
    const y = inset + ((height - inset * 2) * i) / zonesY;
    ticks.push(`M${inset} ${y.toFixed(1)}h6M${width - inset} ${y.toFixed(1)}h-6`);
  }
  return `<defs><pattern id="grid" width="${gridStep}" height="${gridStep}" patternUnits="userSpaceOnUse"><path d="M${gridStep} 0H0V${gridStep}" fill="none" stroke="${t.grid}" stroke-width="1"/></pattern></defs>
<rect width="${width}" height="${height}" fill="${t.bg}"/>
<rect width="${width}" height="${height}" fill="url(#grid)"/>
<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" fill="none" stroke="${t.line2}" stroke-width="1"/>
<path d="${ticks.join("")}" stroke="${t.line2}" stroke-width="1"/>`;
}

/**
 * Engineering title block: a row of labelled cells, right-aligned at (right, y).
 * cells: [{ k, v, w }]
 */
export function titleBlock(t, cells, right, y, height = 34) {
  const total = cells.reduce((s, c) => s + c.w, 0);
  let x = right - total;
  let out = `<g class="rise" style="animation-delay:1.6s"><rect x="${x}" y="${y}" width="${total}" height="${height}" fill="${t.bg}" stroke="${t.line2}"/>`;
  cells.forEach((c, i) => {
    if (i > 0) out += `<path d="M${x} ${y}v${height}" stroke="${t.line2}"/>`;
    out += `<text x="${x + 8}" y="${y + 13}" class="mono i3" font-size="8.5" letter-spacing=".08em">${c.k}</text>`;
    out += `<text x="${x + 8}" y="${y + 27}" class="mono" font-size="11">${c.v}</text>`;
    x += c.w;
  });
  return out + "</g>";
}

/** "rev YY.MM" stamp for a date. */
export function revStamp(date = new Date()) {
  const yy = String(date.getUTCFullYear()).slice(2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}.${mm}`;
}
