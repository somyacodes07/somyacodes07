#!/usr/bin/env node
/**
 * Profile sheets generator, styled after somyacodes.in.
 *
 * - dark.svg / light.svg: sheet 01, hidden-line chip drawing and spec table (profile.mjs)
 * - github-jet.svg / github-jet-light.svg: sheet 02, live contribution grid with a commits/week trace
 * - Data comes from the GitHub GraphQL API, falling back to the public contribution graph
 */

import fs from "node:fs";
import path from "node:path";
import { tokensFor, baseStyle, sheetFrame, titleBlock, revStamp } from "./sheet.mjs";

export const USERNAME = process.env.GH_USERNAME || "somyacodes07";
export const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
export const OUTPUT = process.env.OUTPUT_PATH || "dist/github-jet.svg";

// GitHub's rolling calendar includes a partial edge week, so it spans 53 columns.
export const COLS = 53;
export const ROWS = 7;
export const CELL = 15;
export const GAP = 4;
export const STEP = CELL + GAP;

export const WIDTH = 1180;
export const HEIGHT = 420;

export const GRID_W = COLS * STEP - GAP;
export const GRID_X = Math.round((WIDTH - GRID_W) / 2) + 16;
export const GRID_Y = 162;
export const TRACE_TOP = GRID_Y + ROWS * STEP + 20;
export const TRACE_H = 30;

/** Fill opacity of the red signal for GitHub levels 1-4. */
export const LEVEL_ALPHA = [0, 0.3, 0.52, 0.76, 1];

const LEVEL_ENUM = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

export const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const DAY_NAMES = [
  { label: "mon", row: 1 },
  { label: "wed", row: 3 },
  { label: "fri", row: 5 }
];

export function sanitizeText(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/on\w+\s*=/gi, "disarmed-attr=")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function validateUsername(username) {
  if (!username || typeof username !== "string") return false;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
}

export function validateApiEndpoint(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "https:" && parsed.hostname === "api.github.com";
  } catch {
    return false;
  }
}

/** Deterministic sample calendar for previews and tests. */
export function generateMockWeeks(colCount = COLS, now = new Date()) {
  const weeks = [];
  let seed = 42;
  for (let c = 0; c < colCount; c++) {
    const contributionDays = [];
    for (let r = 0; r < ROWS; r++) {
      seed = (seed * 16807) % 2147483647;
      const rand = seed / 2147483647;
      let count = 0;
      let level = 0;
      if (rand > 0.9) { count = Math.floor(rand * 15) + 6; level = 4; }
      else if (rand > 0.75) { count = Math.floor(rand * 6) + 3; level = 3; }
      else if (rand > 0.6) { count = Math.floor(rand * 3) + 2; level = 2; }
      else if (rand > 0.45) { count = 1; level = 1; }
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - ((colCount - 1 - c) * 7 + (6 - r)));
      contributionDays.push({ contributionCount: count, level, date: d.toISOString().slice(0, 10) });
    }
    weeks.push({ contributionDays });
  }
  return weeks;
}

export function computeStats(data) {
  let total = 0;
  let activeDays = 0;
  let maxDay = 0;
  if (!Array.isArray(data)) return { total, activeDays, maxDay };

  const days = data[0] && Array.isArray(data[0].contributionDays)
    ? data.flatMap(w => (w && Array.isArray(w.contributionDays) ? w.contributionDays : []))
    : data;
  for (const d of days) {
    if (!d) continue;
    const count = Number(d.count !== undefined ? d.count : d.contributionCount) || 0;
    total += count;
    if (count > 0) activeDays++;
    if (count > maxDay) maxDay = count;
  }
  return { total, activeDays, maxDay };
}

/** Longest run of consecutive active days, in calendar order. */
export function longestStreak(cells) {
  const ordered = [...cells].filter(c => c.date).sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const c of ordered) {
    run = c.count > 0 ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

function levelOf(day, maxCount) {
  const lv = Number(day.level);
  if (Number.isInteger(lv) && lv >= 0 && lv <= 4) return lv;
  if (day.contributionLevel in LEVEL_ENUM) return LEVEL_ENUM[day.contributionLevel];
  const n = Number(day.contributionCount) || 0;
  if (n <= 0 || maxCount <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((n / maxCount) * 4)));
}

export function buildCells(weeks, colCount = COLS) {
  const safeWeeks = Array.isArray(weeks) ? weeks.filter(w => w && Array.isArray(w.contributionDays)) : [];
  const recent = safeWeeks.slice(-colCount);
  const empty = () => ({ contributionCount: 0, level: 0, date: null });
  const padded = Array.from({ length: Math.max(0, colCount - recent.length) }, () => ({
    contributionDays: Array.from({ length: ROWS }, empty)
  })).concat(recent);

  const maxCount = Math.max(0, ...padded.flatMap(w => w.contributionDays.map(d => Number(d?.contributionCount) || 0)));

  const cells = [];
  padded.forEach((week, col) => {
    for (let row = 0; row < ROWS; row++) {
      const day = (week.contributionDays[row] && typeof week.contributionDays[row] === "object") ? week.contributionDays[row] : empty();
      const count = Math.max(0, Number(day.contributionCount) || 0);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(day.date || "")) ? day.date : "";
      cells.push({
        col,
        row,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        count,
        level: count > 0 ? Math.max(1, levelOf(day, maxCount)) : 0,
        date
      });
    }
  });
  return cells;
}

export function weeklyTotals(cells, colCount = COLS) {
  const totals = Array(colCount).fill(0);
  for (const c of cells) if (c.col < colCount) totals[c.col] += c.count;
  return totals;
}

export function buildMonthLabels(cells = [], t = tokensFor("dark")) {
  const marks = [];
  let lastMonth = -1;
  let lastCol = -10;
  for (let col = 0; col < COLS; col++) {
    const first = cells.find(c => c.col === col && c.date);
    if (!first) continue;
    const m = new Date(`${first.date}T00:00:00Z`).getUTCMonth();
    if (m !== lastMonth) {
      if (col - lastCol >= 3) {
        marks.push({ col, label: MONTH_NAMES[m] });
        lastCol = col;
      }
      lastMonth = m;
    }
  }
  if (marks.length === 0) {
    [0, 4, 9, 13, 17, 22, 26, 30, 35, 39, 43, 48].forEach((col, i) => marks.push({ col, label: MONTH_NAMES[i] }));
  }
  return marks.map(({ col, label }) => {
    const x = GRID_X + col * STEP;
    return `<path d="M${x} ${GRID_Y - 18}v5" stroke="${t.line2}"/><text x="${x + 4}" y="${GRID_Y - 10}" class="mono i3 axis-label" font-size="10.5">${label}</text>`;
  }).join("\n");
}

function buildGrid(cells, t) {
  const byCol = new Map();
  for (const c of cells) {
    if (!byCol.has(c.col)) byCol.set(c.col, []);
    byCol.get(c.col).push(c);
  }
  let out = "";
  for (const [col, list] of byCol) {
    out += `<g class="rise" style="animation-delay:${(0.5 + col * 0.016).toFixed(3)}s">`;
    for (const c of list) {
      out += c.level > 0
        ? `<rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="1.5" fill="${t.red}" fill-opacity="${LEVEL_ALPHA[c.level]}"/>`
        : `<rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="1.5" fill="${t.bg3}"/>`;
    }
    out += "</g>\n";
  }
  return out;
}

/** Stepped commits/week waveform, drawn like a timing diagram. */
export function buildTracePath(totals) {
  const max = Math.max(1, ...totals);
  const yOf = v => (TRACE_TOP + TRACE_H - (v / max) * TRACE_H).toFixed(1);
  let d = `M${GRID_X - GAP / 2} ${yOf(totals[0] || 0)}`;
  totals.forEach((v, i) => {
    const x0 = GRID_X + i * STEP - GAP / 2;
    if (i > 0) d += `H${x0}V${yOf(v)}`;
  });
  d += `H${GRID_X + totals.length * STEP - GAP / 2}`;
  return d;
}

export function buildSvg(weeks, options = {}) {
  const { mock = false, username = USERNAME, cols = COLS } = options;
  const theme = options.theme === "light" ? "light" : "dark";
  const t = tokensFor(theme);
  const date = options.date || new Date();
  if (mock || !Array.isArray(weeks) || weeks.length === 0) weeks = generateMockWeeks(cols, date);

  const cells = buildCells(weeks, Math.min(cols, COLS));
  const stats = computeStats(cells);
  const streak = longestStreak(cells);
  const totals = weeklyTotals(cells, Math.min(cols, COLS));
  const trace = buildTracePath(totals);
  const user = sanitizeText(username);
  const title = sanitizeText(options.title || "Every commit, last 52 weeks");
  const updated = date.toISOString().slice(0, 10);

  const latest = cells.filter(c => c.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const today = latest
    ? `<rect x="${latest.x - 2.5}" y="${latest.y - 2.5}" width="${CELL + 5}" height="${CELL + 5}" rx="3" fill="none" stroke="${t.red}" stroke-width="1.2" style="animation:blink 1.8s ease-in-out 2s infinite"/>`
    : "";

  const statBlocks = [
    ["commits", stats.total.toLocaleString("en-US")],
    ["active days", String(stats.activeDays)],
    ["best day", String(stats.maxDay)],
    ["longest streak", `${streak}d`]
  ];
  const blockW = 128;
  const statsSvg = statBlocks.map(([k, v], i) => {
    const x = WIDTH - 40 - (statBlocks.length - i) * blockW + 16;
    return `<g class="rise" style="animation-delay:${(0.3 + i * 0.07).toFixed(2)}s"><path d="M${x - 16} 80v44" stroke="${t.line2}"/><text x="${x}" y="92" class="mono i3" font-size="10.5">${k}</text><text x="${x}" y="122" class="sans" font-size="30" font-weight="600" letter-spacing="-.02em">${sanitizeText(v)}</text></g>`;
  }).join("\n");

  const days = DAY_NAMES.map(({ label, row }) =>
    `<text x="${GRID_X - 10}" y="${GRID_Y + row * STEP + 11}" text-anchor="end" class="mono i3 axis-label" font-size="10.5">${label}</text>`
  ).join("\n");

  const legendX = GRID_X;
  const legendY = HEIGHT - 44;
  const legend = `<g class="rise" style="animation-delay:1.4s"><text x="${legendX}" y="${legendY + 10}" class="mono i3" font-size="10.5">less</text>${[0, 1, 2, 3, 4].map(l =>
    `<rect x="${legendX + 34 + l * 16}" y="${legendY}" width="12" height="12" rx="1.5" fill="${l ? t.red : t.bg3}"${l ? ` fill-opacity="${LEVEL_ALPHA[l]}"` : ""}/>`
  ).join("")}<text x="${legendX + 120}" y="${legendY + 10}" class="mono i3" font-size="10.5">more</text>
<text x="${legendX + 170}" y="${legendY + 10}" class="mono i3" font-size="10.5">fig. 2 — one square per day. the trace below is commits per week.</text></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${stats.total} GitHub contributions in the last 52 weeks by ${user}">
<title>${user}: contributions, last 52 weeks</title>
<style>
${baseStyle(t)}
@keyframes trace{0%{stroke-dashoffset:1}70%,100%{stroke-dashoffset:0}}
</style>
${sheetFrame(t, WIDTH, HEIGHT)}

<g id="nav" class="rise" style="animation-delay:.1s">
  <text x="40" y="44" class="mono i3" font-size="13">02</text>
  <text x="66" y="44" class="mono" font-size="13">field test</text>
  <text x="${WIDTH - 40}" y="44" text-anchor="end" class="mono i2" font-size="12">live from github.com/${user}   ·   updated ${updated}</text>
</g>
<path d="M12 62H${WIDTH - 12}" stroke="${t.line2}"/>

<text x="38" y="120" class="sans rise" font-size="34" font-weight="600" letter-spacing="-.02em" style="animation-delay:.2s">${title}</text>
${statsSvg}

<g id="month-labels" class="rise" style="animation-delay:.4s">${buildMonthLabels(cells, t)}</g>
<g id="day-labels" class="rise" style="animation-delay:.4s">${days}</g>
<g id="contribution-blocks">
${buildGrid(cells, t)}${today}
</g>

<g id="signal-trace">
  <text x="${GRID_X - 10}" y="${TRACE_TOP + TRACE_H - 4}" text-anchor="end" class="mono i3" font-size="10.5">sig</text>
  <path d="M${GRID_X - GAP / 2} ${TRACE_TOP + TRACE_H}H${GRID_X + GRID_W + GAP / 2}" stroke="${t.line}" stroke-dasharray="2 4"/>
  <path d="${trace}" fill="none" stroke="${t.line2}" stroke-width="1" pathLength="1" class="pen" style="animation-delay:1.2s;animation-duration:2.4s"/>
  <path d="${trace}" fill="none" stroke="${t.red}" stroke-width="1.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="animation:trace 9s linear 3s infinite"/>
  <circle r="3.5" fill="${t.red}" opacity="0">
    <set attributeName="opacity" to="1" begin="3s"/>
    <animateMotion dur="9s" begin="3s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="linear" path="${trace}"/>
  </circle>
</g>

${legend}
${titleBlock(t, [
    { k: "DRAWN", v: user, w: 132 },
    { k: "SHEET", v: "02 / 02", w: 74 },
    { k: "REV", v: revStamp(date), w: 64 }
  ], WIDTH - 40, HEIGHT - 58)}
</svg>`;
}

const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;

export async function fetchWeeks(username = USERNAME, token = TOKEN) {
  const endpoint = "https://api.github.com/graphql";
  if (!validateApiEndpoint(endpoint)) throw new Error("Invalid GraphQL endpoint configuration");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login: username } })
  });
  if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error("GraphQL query execution failed: " + JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

export function parsePublicContributionCalendar(html) {
  const tooltips = new Map();
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/gi)) {
    const target = match[1].match(/\bfor="([^"]+)"/i)?.[1];
    if (!target) continue;
    tooltips.set(target, match[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim());
  }

  const days = [];
  for (const match of html.matchAll(/<td\b([^>]*)>/gi)) {
    const attrs = match[1];
    if (!/\brole="gridcell"/i.test(attrs)) continue;
    const date = attrs.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/i)?.[1];
    const id = attrs.match(/\bid="([^"]+)"/i)?.[1];
    const levelText = attrs.match(/\bdata-level="([0-4])"/i)?.[1];
    if (!date || !id || levelText === undefined) continue;

    const label = tooltips.get(id);
    if (!label) throw new Error(`Missing contribution tooltip for ${date}`);
    const countText = label.match(/\b([\d,]+)\s+contributions?\b/i)?.[1];
    const contributionCount = countText ? Number(countText.replace(/,/g, "")) : (/\bno contributions\b/i.test(label) ? 0 : NaN);
    if (!Number.isSafeInteger(contributionCount) || contributionCount < 0) {
      throw new Error(`Could not read contribution count for ${date}`);
    }
    days.push({ date, contributionCount, level: Number(levelText) });
  }

  if (days.length < 350) throw new Error(`GitHub returned an incomplete contribution calendar (${days.length} days)`);
  days.sort((a, b) => a.date.localeCompare(b.date));

  const weeksBySunday = new Map();
  for (const day of days) {
    const d = new Date(`${day.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const sunday = d.toISOString().slice(0, 10);
    if (!weeksBySunday.has(sunday)) weeksBySunday.set(sunday, []);
    weeksBySunday.get(sunday).push(day);
  }

  return [...weeksBySunday.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sunday, list]) => {
    const byWeekday = new Map(list.map(day => [new Date(`${day.date}T00:00:00Z`).getUTCDay(), day]));
    const start = new Date(`${sunday}T00:00:00Z`);
    const contributionDays = Array.from({ length: ROWS }, (_, weekday) => {
      const existing = byWeekday.get(weekday);
      if (existing) return existing;
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + weekday);
      return { date: d.toISOString().slice(0, 10), contributionCount: 0, level: 0 };
    });
    return { contributionDays };
  });
}

export async function fetchPublicContributionWeeks(username = USERNAME) {
  if (!validateUsername(username)) throw new Error("Invalid GitHub username");
  const endpoint = `https://github.com/users/${encodeURIComponent(username)}/contributions`;
  const response = await fetch(endpoint, { headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`GitHub profile returned HTTP ${response.status}`);
  return parsePublicContributionCalendar(await response.text());
}

function write(file, svg) {
  const out = path.resolve(file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, svg, "utf8");
  console.log(`wrote ${file} (${Buffer.byteLength(svg, "utf8")} bytes)`);
}

export async function main() {
  const { loadProfileConfig, buildProfileSvg } = await import("./profile.mjs");
  const config = loadProfileConfig("profile.config.json");
  const username = process.env.GH_USERNAME || config.username || USERNAME;
  if (!validateUsername(username)) throw new Error("Invalid GitHub username");

  let weeks;
  if (TOKEN) {
    try {
      weeks = await fetchWeeks(username, TOKEN);
      console.log(`GitHub API: ${weeks.length} weeks for @${username}`);
    } catch (err) {
      console.warn(`GitHub API failed (${err.message}); reading the public graph.`);
    }
  }
  if (!weeks) {
    weeks = await fetchPublicContributionWeeks(username);
    console.log(`public graph: ${weeks.length} weeks for @${username}`);
  }

  const commits = computeStats(buildCells(weeks)).total;
  const date = new Date();

  for (const theme of ["dark", "light"]) {
    write(`${theme}.svg`, buildProfileSvg(config, { theme, commits, date }));
  }

  const heat = { username, title: config.heatmap?.title, date };
  const darkHeat = buildSvg(weeks, { ...heat, theme: "dark" });
  const lightHeat = buildSvg(weeks, { ...heat, theme: "light" });
  const lightOut = OUTPUT.replace(/\.svg$/, "-light.svg");
  write(OUTPUT, darkHeat);
  write(lightOut, lightHeat);
  if (path.resolve(OUTPUT) !== path.resolve("github-jet.svg")) {
    write("github-jet.svg", darkHeat);
    write("github-jet-light.svg", lightHeat);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch(err => {
    console.error("FATAL:", err.message);
    process.exit(1);
  });
}
