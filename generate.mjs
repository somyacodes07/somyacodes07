#!/usr/bin/env node
/**
 * Minecraft Overworld profile and live contribution miner generator
 *
 * - Block-built Overworld canvas and live GitHub contribution grid
 * - Animated pixel-art Steve mines contribution blocks with a diamond pickaxe
 * - Daily GitHub Actions generation retains the existing API and output paths
 * - Strict TDD & STRIDE / OWASP Top 10 security defenses
 */

import fs from "node:fs";
import path from "node:path";

export const USERNAME = process.env.GH_USERNAME || "somyacodes07";
export const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
export const OUTPUT = process.env.OUTPUT_PATH || "dist/github-jet.svg";

// GitHub's rolling contribution calendar includes a partial edge week, so it
// renders as 53 columns across the full 52-week period.
export const COLS = 53;
export const ROWS = 7;
export const CELL = 14;
export const GAP = 4;
export const STEP = CELL + GAP; // 18px

export const WIDTH = 1180;
export const HEIGHT = 340;

export const GRID_X = 140;
export const GRID_Y = 88;

export const MINER_TOOL_CONTACT_X = 57;
export const MINER_X_START = GRID_X + CELL / 2 - MINER_TOOL_CONTACT_X;
export const MINER_X_END = GRID_X + (COLS - 1) * STEP + CELL / 2 - MINER_TOOL_CONTACT_X;
export const MINER_Y = 148;
// Keep legacy coordinate exports stable for downstream scripts.
export const JET_X_START = GRID_X + CELL / 2;
export const JET_X_END = GRID_X + (COLS - 1) * STEP + CELL / 2;
export const JET_Y = MINER_Y;
export const LOOP_DUR = 18;

export const THEME = {
  bgStart: "#243a4a",
  bgEnd: "#172019",
  border1: "#73ad47",
  border2: "#91c45c",
  border3: "#795338",
  gold: "#d7b96e",
  cyan: "#87b8c8",
  rose: "#b96857",
  emerald: "#70a64a",
  mint: "#a6d275",
  slate: "#b2b6a3",
  muted: "#6d7562",
  cellEmpty: "#373c35",
  cellEmptyBorder: "#58604f",
  palette: ["#373c35", "#46533b", "#5e7f40", "#78a84b", "#a4cf63"]
};

export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const DAY_NAMES = [
  { label: "MON", row: 1 },
  { label: "WED", row: 3 },
  { label: "FRI", row: 5 }
];

export function sanitizeText(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  return s
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

export function computeArcadeScore(count) {
  const safeCount = Number(count);
  if (count === null || count === undefined || isNaN(safeCount)) {
    return "766,000 PTS";
  }
  if (safeCount === 0) return "0 PTS";
  const pts = safeCount * 1000;
  return pts.toLocaleString("en-US") + " PTS";
}

export function buildShieldBar(pct = 100) {
  const totalBlocks = 10;
  const activeBlocks = Math.max(0, Math.min(totalBlocks, Math.round((pct / 100) * totalBlocks)));
  let svg = '<g id="shield-segments">\n';
  for (let i = 0; i < totalBlocks; i++) {
    const x = i * 10;
    const isFilled = i < activeBlocks;
    const fill = isFilled ? "#22D3EE" : "#0F172A";
    const opacity = isFilled ? "0.95" : "0.3";
    svg += `  <rect x="${x}" y="0" width="7.5" height="12" rx="1.5" fill="${fill}" opacity="${opacity}" stroke="#0284C7" stroke-width="0.5"/>\n`;
  }
  svg += "</g>";
  return svg;
}

export function generateMockWeeks(colCount = COLS) {
  const weeks = [];
  const now = new Date();
  const seedMultiplier = 16807;
  let seed = 42;

  for (let c = 0; c < colCount; c++) {
    const contributionDays = [];
    for (let r = 0; r < ROWS; r++) {
      seed = (seed * seedMultiplier) % 2147483647;
      const rand = seed / 2147483647;
      let count = 0;
      let color = THEME.palette[0];

      if (rand > 0.45) {
        if (rand > 0.90) {
          count = Math.floor(rand * 15) + 6;
          color = THEME.palette[4];
        } else if (rand > 0.75) {
          count = Math.floor(rand * 6) + 3;
          color = THEME.palette[3];
        } else if (rand > 0.60) {
          count = Math.floor(rand * 3) + 2;
          color = THEME.palette[2];
        } else {
          count = 1;
          color = THEME.palette[1];
        }
      }

      const d = new Date(now);
      d.setDate(d.getDate() - ((colCount - 1 - c) * 7 + (6 - r)));
      contributionDays.push({
        contributionCount: count,
        color,
        date: d.toISOString().split("T")[0]
      });
    }
    weeks.push({ contributionDays });
  }
  return weeks;
}

export function computeStats(data) {
  let total = 0;
  let activeDays = 0;
  let maxDay = 0;

  if (!data) return { total, activeDays, maxDay };

  if (Array.isArray(data) && data[0] && Array.isArray(data[0].contributionDays)) {
    for (const week of data) {
      if (!week || !Array.isArray(week.contributionDays)) continue;
      for (const day of week.contributionDays) {
        if (!day) continue;
        const count = Number(day.contributionCount) || 0;
        total += count;
        if (count > 0) activeDays++;
        if (count > maxDay) maxDay = count;
      }
    }
  } else if (Array.isArray(data)) {
    for (const c of data) {
      if (!c) continue;
      const count = Number(c.count !== undefined ? c.count : c.contributionCount) || 0;
      total += count;
      if (count > 0) activeDays++;
      if (count > maxDay) maxDay = count;
    }
  }

  return { total, activeDays, maxDay };
}

export function buildCells(weeks, colCount = COLS) {
  const safeWeeks = Array.isArray(weeks) ? weeks.filter(w => w && Array.isArray(w.contributionDays)) : [];
  const recent = safeWeeks.slice(-colCount);
  const pad = colCount - recent.length;

  const padded = Array.from({ length: Math.max(0, pad) }, () => ({
    contributionDays: Array.from({ length: ROWS }, () => ({ contributionCount: 0, color: THEME.palette[0], date: null }))
  })).concat(recent);

  const cells = [];
  padded.forEach((week, col) => {
    if (col >= colCount) return;
    const days = Array.isArray(week.contributionDays) ? week.contributionDays : [];
    for (let row = 0; row < ROWS; row++) {
      const day = days[row] || { contributionCount: 0, color: THEME.palette[0], date: null };
      const rawColor = day.color || THEME.palette[0];
      const color = (rawColor === "#161b22" || rawColor === "#ebedf0") ? THEME.palette[0] : rawColor;
      cells.push({
        col,
        row,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        color: sanitizeText(color),
        count: Number(day.contributionCount) || 0,
        date: sanitizeText(day.date || "")
      });
    }
  });
  return cells;
}

/**
 * Exact analytical inversion of SMIL calcMode="spline" keySplines="0.45 0 0.55 1"
 * Solves 3u^2 - 2u^3 = p in closed-form, then evaluates X(u).
 */
export function columnToTimeFraction(col, totalCols = COLS - 1) {
  const p = Math.max(0, Math.min(1, col / totalCols));
  // Exact root of 2u^3 - 3u^2 + p = 0 via Cardano/trigonometric formulation
  const theta = Math.asin(Math.max(-1, Math.min(1, 2 * p - 1))) / 3;
  const u = 0.5 + Math.sin(theta);

  // Evaluate X(u) for keySplines="0.45 0 0.55 1"
  const oneMinusU = 1 - u;
  const tau = 1.35 * oneMinusU * oneMinusU * u + 1.65 * oneMinusU * u * u + u * u * u;

  // Forward sweep: 0.0s to 9.0s (0 to 0.5 of 18s)
  const t_fwd = 0.5 * tau;
  // Return sweep: 9.0s to 18.0s (0.5 to 1.0 of 18s)
  const t_ret = 0.5 + 0.5 * (1 - tau);

  return { t_fwd, t_ret };
}

export function buildMonotonicKeyTimes(events) {
  const sorted = events.slice().sort((a, b) => a.time - b.time);
  const cleanTimes = [0];
  const cleanValues = [sorted[0] ? sorted[0].value : "0"];

  let lastFormatted = 0;
  for (const ev of sorted) {
    let t = Math.max(0.0001, Math.min(0.9999, ev.time));
    let tRounded = Number(t.toFixed(4));
    if (tRounded <= lastFormatted) {
      tRounded = Number((lastFormatted + 0.0002).toFixed(4));
    }
    if (tRounded > lastFormatted && tRounded < 1) {
      cleanTimes.push(tRounded);
      cleanValues.push(ev.value);
      lastFormatted = tRounded;
    }
  }
  cleanTimes.push(1);
  cleanValues.push(cleanValues[cleanValues.length - 1] || "0");

  return {
    keyTimes: cleanTimes.map(t => t.toFixed(4)).join("; "),
    values: cleanValues.join("; ")
  };
}

export function selectTargets(cells) {
  // 1. Group active cells (count > 0 and non-empty color) by column, finding the maximum contribution cell per column
  const byCol = new Map();
  for (const c of cells) {
    if (c.count > 0 && c.color !== THEME.palette[0] && c.row >= 3 && c.row <= 5) {
      const rowDistance = Math.abs(c.row - 4);
      const prev = byCol.get(c.col);
      if (!prev || rowDistance < Math.abs(prev.row - 4) || (rowDistance === Math.abs(prev.row - 4) && c.count > prev.count)) {
        byCol.set(c.col, c);
      }
    }
  }

  // If no contributions exist, return empty targets list immediately (never fabricate fake cells)
  if (byCol.size === 0) {
    return [];
  }

  // 2. Sort candidate column cells by count descending (largest contributions first), then by column
  const candidates = Array.from(byCol.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.col - b.col;
  });

  // 3. Greedily select top high-value targets while enforcing a minimum 3-column spacing
  const selectedCols = [];
  const MAX_TARGETS = 8;
  const MIN_SPACING = 3;

  for (const cand of candidates) {
    if (selectedCols.length >= MAX_TARGETS) break;
    const tooClose = selectedCols.some(c => Math.abs(c - cand.col) < MIN_SPACING);
    if (!tooClose) {
      selectedCols.push(cand.col);
    }
  }

  // 4. Sort selected columns ascending to ensure monotonic forward and return timelines
  selectedCols.sort((a, b) => a - b);

  return selectedCols.map(col => {
    const cell = byCol.get(col);
    const cx = cell.x + CELL / 2;
    const cy = cell.y + CELL / 2;

    const { t_fwd, t_ret } = columnToTimeFraction(col, COLS - 1);
    const k_hit_fwd = t_fwd;
    const k_lock_fwd = Math.max(0.0001, t_fwd - 0.014);
    const k_settle_fwd = Math.min(0.4990, t_fwd + 0.008);

    const k_hit_ret = t_ret;
    const k_lock_ret = Math.max(0.5001, t_ret - 0.014);
    const k_settle_ret = Math.min(0.9990, t_ret + 0.008);

    return {
      col,
      row: cell.row,
      x: cell.x,
      y: cell.y,
      cx,
      cy,
      count: cell.count,
      color: cell.color,
      k_lock_fwd,
      k_hit_fwd,
      k_settle_fwd,
      k_lock_ret,
      k_hit_ret,
      k_settle_ret
    };
  });
}

export function buildGrid(cells, targets = []) {
  const targetMap = new Map();
  targets.forEach(t => targetMap.set(`${t.x},${t.y}`, t));

  let svg = "";
  for (const c of cells) {
    const key = `${c.x},${c.y}`;
    const isTarget = targetMap.has(key);
    const isLevel0 = c.color === THEME.palette[0];
    const stroke = isLevel0 ? THEME.cellEmptyBorder : "#32432c";
    const fill = c.color;
    if (isTarget) {
      const t = targetMap.get(key);
      const timeline = buildMonotonicKeyTimes([
        { time: 0, value: fill },
        { time: Math.max(0, t.k_hit_fwd - .001), value: fill },
        { time: t.k_hit_fwd, value: "#b3fff2" },
        { time: Math.min(.4999, t.k_hit_fwd + .018), value: fill },
        { time: .5, value: fill },
        { time: Math.max(.5001, t.k_hit_ret - .001), value: fill },
        { time: t.k_hit_ret, value: "#b3fff2" },
        { time: Math.min(.9999, t.k_hit_ret + .018), value: fill },
        { time: 1, value: fill }
      ]);
      svg += `  <g><rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" fill="${fill}" stroke="${stroke}" stroke-width="1"><animate attributeName="fill" dur="${LOOP_DUR}s" repeatCount="indefinite" values="${timeline.values}" keyTimes="${timeline.keyTimes}"/><title>${c.count} contributions on ${c.date || "untracked"}</title></rect><path d="M${c.x + 2} ${c.y + 3}h4M${c.x + 8} ${c.y + 3}h4M${c.x + 3} ${c.y + 8}v4M${c.x + 10} ${c.y + 7}v4" stroke="#d7eaa4" stroke-width="1" opacity=".72"/></g>\n`;
    } else {
      svg += `  <g><rect x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" fill="${fill}" stroke="${stroke}" stroke-width="1"><title>${c.count} contributions on ${c.date || "untracked"}</title></rect></g>\n`;
    }
  }
  return svg;
}

export function buildTargetLockBrackets(targets = []) {
  let svg = '<g id="target-lock-brackets">\n';
  for (const t of targets) {
    const lockEvents = [
      { time: 0, value: "0" },
      { time: t.k_lock_fwd, value: "0" },
      { time: Math.min(0.4998, t.k_lock_fwd + 0.002), value: "1" },
      { time: t.k_hit_fwd, value: "1" },
      { time: t.k_settle_fwd, value: "0" },
      { time: 0.5, value: "0" },
      { time: t.k_lock_ret, value: "0" },
      { time: Math.min(0.9998, t.k_lock_ret + 0.002), value: "1" },
      { time: t.k_hit_ret, value: "1" },
      { time: t.k_settle_ret, value: "0" },
      { time: 1, value: "0" }
    ];
    const lockTimeline = buildMonotonicKeyTimes(lockEvents);

    svg += `  <g class="lock-bracket" opacity="0">\n`;
    svg += `    <path d="M${t.cx - 10} ${t.cy - 6} V${t.cy - 10} H${t.cx - 6} M${t.cx + 6} ${t.cy - 10} H${t.cx + 10} V${t.cy - 6} M${t.cx + 10} ${t.cy + 6} V${t.cy + 10} H${t.cx + 6} M${t.cx - 6} ${t.cy + 10} H${t.cx - 10} V${t.cy + 6}" fill="none" stroke="#FACC15" stroke-width="1.5"/>\n`;
    svg += `    <circle cx="${t.cx}" cy="${t.cy}" r="2" fill="#FACC15"/>\n`;
    svg += `    <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="${lockTimeline.values}" keyTimes="${lockTimeline.keyTimes}"/>\n`;
    svg += `  </g>\n`;
  }
  svg += '</g>\n';
  return svg;
}

export function buildProminentRailguns(targets = []) {
  let svg = '<g id="world-space-railguns">\n';
  for (const t of targets) {
    const beamEvents = [
      { time: 0, value: "0" },
      { time: Math.max(0.0001, t.k_hit_fwd - 0.001), value: "0" },
      { time: t.k_hit_fwd, value: "1" },
      { time: t.k_settle_fwd, value: "1" },
      { time: Math.min(0.4999, t.k_settle_fwd + 0.002), value: "0" },
      { time: 0.5, value: "0" },
      { time: Math.max(0.5001, t.k_hit_ret - 0.001), value: "0" },
      { time: t.k_hit_ret, value: "1" },
      { time: t.k_settle_ret, value: "1" },
      { time: Math.min(0.9999, t.k_settle_ret + 0.002), value: "0" },
      { time: 1, value: "0" }
    ];
    const beamTimeline = buildMonotonicKeyTimes(beamEvents);

    svg += `  <g class="railgun-lance" opacity="0">\n`;
    svg += `    <line x1="${t.cx - 3.5}" y1="${JET_Y - 14}" x2="${t.cx - 3.5}" y2="${t.cy}" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>\n`;
    svg += `    <line x1="${t.cx - 3.5}" y1="${JET_Y - 14}" x2="${t.cx - 3.5}" y2="${t.cy}" stroke="#38BDF8" stroke-width="4.5" stroke-opacity="0.45" stroke-linecap="round"/>\n`;
    svg += `    <line x1="${t.cx + 3.5}" y1="${JET_Y - 14}" x2="${t.cx + 3.5}" y2="${t.cy}" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>\n`;
    svg += `    <line x1="${t.cx + 3.5}" y1="${JET_Y - 14}" x2="${t.cx + 3.5}" y2="${t.cy}" stroke="#38BDF8" stroke-width="4.5" stroke-opacity="0.45" stroke-linecap="round"/>\n`;
    svg += `    <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="${beamTimeline.values}" keyTimes="${beamTimeline.keyTimes}"/>\n`;
    svg += `  </g>\n`;
  }
  svg += '</g>\n';
  return svg;
}

export function buildExplosiveImpacts(targets = []) {
  let svg = '<g id="explosive-impacts">\n';
  for (const t of targets) {
    const impactEvents = [
      { time: 0, value: "0" },
      { time: Math.max(0.0001, t.k_hit_fwd - 0.001), value: "0" },
      { time: t.k_hit_fwd, value: "1" },
      { time: t.k_settle_fwd, value: "0" },
      { time: 0.5, value: "0" },
      { time: Math.max(0.5001, t.k_hit_ret - 0.001), value: "0" },
      { time: t.k_hit_ret, value: "1" },
      { time: t.k_settle_ret, value: "0" },
      { time: 1, value: "0" }
    ];
    const impactTimeline = buildMonotonicKeyTimes(impactEvents);

    const radiusEvents = [
      { time: 0, value: "0" },
      { time: Math.max(0.0001, t.k_hit_fwd - 0.001), value: "0" },
      { time: t.k_hit_fwd, value: "3" },
      { time: t.k_settle_fwd, value: "14" },
      { time: 0.5, value: "0" },
      { time: Math.max(0.5001, t.k_hit_ret - 0.001), value: "0" },
      { time: t.k_hit_ret, value: "3" },
      { time: t.k_settle_ret, value: "14" },
      { time: 1, value: "0" }
    ];
    const radiusTimeline = buildMonotonicKeyTimes(radiusEvents);

    svg += `  <g class="explosive-impact">\n`;
    svg += `    <circle cx="${t.cx}" cy="${t.cy}" r="0" fill="none" stroke="#FACC15" stroke-width="1.8" class="shockwave-primary" opacity="0">\n`;
    svg += `      <animate attributeName="r" dur="18s" repeatCount="indefinite" values="${radiusTimeline.values}" keyTimes="${radiusTimeline.keyTimes}"/>\n`;
    svg += `      <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="${impactTimeline.values}" keyTimes="${impactTimeline.keyTimes}"/>\n`;
    svg += `    </circle>\n`;
    svg += `    <circle cx="${t.cx}" cy="${t.cy}" r="4" fill="#FFFFFF" opacity="0">\n`;
    svg += `      <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="${impactTimeline.values}" keyTimes="${impactTimeline.keyTimes}"/>\n`;
    svg += `    </circle>\n`;
    svg += `  </g>\n`;
  }
  svg += '</g>\n';
  return svg;
}

export function buildDynamicReticle(targets = []) {
  return `<g id="boresight-reticle">
  <!-- Projected Sighting Guide -->
  <line x1="0" y1="-8" x2="0" y2="-180" stroke="#22D3EE" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.6" class="sighting-laser"/>

  <!-- Forward Gun-Sight Ring -->
  <circle cx="0" cy="-60" r="16" fill="none" stroke="#22D3EE" stroke-width="1.4" opacity="0.75"/>
  <circle cx="0" cy="-60" r="24" fill="none" stroke="#38BDF8" stroke-width="1" stroke-dasharray="6 3" opacity="0.5"/>

  <!-- Directional Crosshair Ticks -->
  <line x1="0" y1="-74" x2="0" y2="-66" stroke="#22D3EE" stroke-width="1.5"/>
  <line x1="0" y1="-54" x2="0" y2="-46" stroke="#22D3EE" stroke-width="1.5"/>
  <line x1="-14" y1="-60" x2="-6" y2="-60" stroke="#22D3EE" stroke-width="1.5"/>
  <line x1="6" y1="-60" x2="14" y2="-60" stroke="#22D3EE" stroke-width="1.5"/>

  <!-- Flashing Center Pip -->
  <circle cx="0" cy="-60" r="2" fill="#FACC15">
    <animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite"/>
  </circle>
</g>`;
}

export function buildMonthLabels(cells = []) {
  let svg = "";
  const monthCols = [];
  let lastMonth = -1;
  let lastCol = -10;

  // Find column positions where month changes across GitHub's rolling calendar.
  for (let col = 0; col < COLS; col++) {
    const colCells = cells.filter(c => c.col === col && c.date);
    if (colCells.length === 0) continue;
    const dateStr = colCells[0].date;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;

    const m = d.getUTCMonth();
    if (m !== lastMonth) {
      // Ensure at least 2 columns separation between adjacent month labels
      if (col - lastCol >= 2) {
        monthCols.push({ col, label: MONTH_NAMES[m] });
        lastCol = col;
      }
      lastMonth = m;
    }
  }

  // Fallback if no valid dates exist in input
  if (monthCols.length === 0) {
    const defaultMonthCols = [0, 4, 9, 13, 17, 22, 26, 30, 35, 39, 43, 48];
    defaultMonthCols.forEach((col, idx) => {
      monthCols.push({ col, label: MONTH_NAMES[idx % MONTH_NAMES.length] });
    });
  }

  for (const { col, label } of monthCols) {
    const x = GRID_X + col * STEP;
    svg += `  <text x="${x}" y="74" class="axis-label">${label}</text>\n`;
  }

  return svg;
}

export function buildDayLabels() {
  let svg = "";
  DAY_NAMES.forEach(({ label, row }) => {
    const y = GRID_Y + row * STEP + 10.5;
    svg += `  <text x="80" y="${y}" class="axis-label" text-anchor="end">${label}</text>\n`;
  });
  return svg;
}

export function buildCrosshairs() {
  return "";
}

export function buildStars() {
  return `<g id="overworld-silhouette" opacity=".78">
  <path d="M0 81h84V68h26V55h20V46h19v18h27v17h90V70h22V52h20V40h21V28h19v38h22v15h104V65h28V48h19V34h20V25h20v41h18v15h92V70h24V55h25V41h24V30h20v39h25v12h124v-9h28V57h23V43h23V31h22v42h25v8h92v166H0z" fill="#273c34"/>
  <path d="M0 112h70v-11h18v11h113V99h19v13h155v-9h23v9h119v-13h20v13h185v-11h20v11h180v-8h18v8h160v132H0z" fill="#263128"/>
  <path d="M0 130h57v-7h12v7h98v-6h10v6h146v-8h13v8h164v-7h12v7h128v-6h12v6h190v-8h13v8h104v-7h11v7h142v118H0z" fill="#202a21"/>
</g>`;
}

export function buildLegend() {
  let svg = `<g transform="translate(${GRID_X}, ${HEIGHT - 20})">\n`;
  svg += `  <text x="0" y="8" class="legend-text">CONTRIBUTIONS</text>\n`;
  THEME.palette.forEach((color, i) => {
    const x = 115 + i * 14;
    const stroke = color === THEME.palette[0] ? ` stroke="${THEME.cellEmptyBorder}" stroke-width="0.75"` : "";
    svg += `  <rect x="${x}" y="0" width="10" height="10" fill="${color}"${stroke}/>\n`;
  });
  svg += `  <text x="${115 + 5 * 14 + 4}" y="8" class="legend-text">MORE</text>\n`;
  svg += `</g>\n`;
  return svg;
}

export function buildMiningSparks(targets = []) {
  return targets.map((target, index) => {
    const pulses = buildMonotonicKeyTimes([
      { time: 0, value: "0" },
      { time: Math.max(0.0001, target.k_hit_fwd - .002), value: "0" },
      { time: target.k_hit_fwd, value: "1" },
      { time: Math.min(.9998, target.k_hit_fwd + .02), value: "0" },
      { time: Math.max(.5001, target.k_hit_ret - .002), value: "0" },
      { time: target.k_hit_ret, value: "1" },
      { time: Math.min(.9999, target.k_hit_ret + .02), value: "0" },
      { time: 1, value: "0" }
    ]);
    const drift = buildMonotonicKeyTimes([
      { time: 0, value: "0 0" },
      { time: Math.max(0.0001, target.k_hit_fwd - .002), value: "0 0" },
      { time: target.k_hit_fwd, value: "-4 -4" },
      { time: Math.min(.9998, target.k_hit_fwd + .02), value: "-8 -9" },
      { time: Math.max(.5001, target.k_hit_ret - .002), value: "0 0" },
      { time: target.k_hit_ret, value: "4 -5" },
      { time: Math.min(.9999, target.k_hit_ret + .02), value: "8 -10" },
      { time: 1, value: "0 0" }
    ]);
    return `<g id="mining-impact-${index}" transform="translate(${target.cx} ${target.cy})" opacity="0" shape-rendering="crispEdges">
  <rect x="-7" y="-3" width="3" height="3" fill="#9bf9ed"/><rect x="4" y="-6" width="3" height="3" fill="#55d8ce"/>
  <rect x="-3" y="4" width="3" height="3" fill="#e9d68d"/><rect x="6" y="3" width="2" height="2" fill="#c6fff4"/>
  <animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" values="${pulses.values}" keyTimes="${pulses.keyTimes}"/>
  <animateTransform attributeName="transform" type="translate" additive="sum" dur="${LOOP_DUR}s" repeatCount="indefinite" values="${drift.values}" keyTimes="${drift.keyTimes}"/>
</g>`;
  }).join("\n");
}

export function buildMinecraftSteve() {
  const spriteScale = 1.35;
  return `<g id="steve-mining" shape-rendering="crispEdges">
  <g id="steve-sprite" transform="translate(${MINER_X_START} ${MINER_Y})">
    <animateTransform attributeName="transform" type="translate" dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" values="${MINER_X_START} ${MINER_Y};${MINER_X_END} ${MINER_Y};${MINER_X_START} ${MINER_Y}"/>
    <g transform="scale(${spriteScale})">
      <g id="steve-bob" transform="translate(0 0)">
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0;0 -1;0 0" dur=".72s" repeatCount="indefinite"/>
        <!-- Wide, faceted diamond head and a wooden handle that meets Steve's grip -->
        <g id="diamond-pickaxe" transform="rotate(-24 31 43)">
          <path d="M30 44L45 12" stroke="#68462d" stroke-width="5" stroke-linecap="square"/>
          <path d="M30 43L45 13" stroke="#a47b45" stroke-width="1.5"/>
          <path d="M29 11l6-7 5 5 6-7 6 7 6-6 10 10-7 7-5-4-6 7-6-6-6 7-6-6-5 5-7-7z" fill="#126d78"/>
          <path d="M31 9l4-5 5 5 6-7 6 6 6-6 8 8-6 6-5-4-6 7-6-6-6 7-6-6-4 4-5-5z" fill="#37d7ce"/>
          <path d="M35 6l5 3 6-7 5 5 6-6 4 4-6 1-5 6-5-4-6 7-5-5-4 3-3-3z" fill="#b4fff0"/>
          <path d="M31 12l5 2 4-4 5 5-6 7-6-6-5 4-4-4zM50 14l6-6 5 4 5-4 5 5-6 6-5-4-6 7-5-5z" fill="#1ba3a4"/>
          <path d="M43 10l4-5 5 5-4 5z" fill="#d7fff4"/>
          <animateTransform attributeName="transform" type="rotate" values="-28 31 43;12 31 43;-28 31 43" dur=".72s" repeatCount="indefinite"/>
        </g>

        <!-- Back arm and squared shirt retain the existing outfit colors -->
        <path d="M2 29h7v19H2z" fill="#b8794c"/>
        <path d="M2 29h3v19H2z" fill="#bf8053"/>
        <path d="M4 25h27v27H4z" fill="#397da0"/>
        <path d="M4 25h6v27H4zM25 25h6v27h-6z" fill="#2b6383"/>
        <path d="M10 25h15v3H10z" fill="#397da0"/>

        <!-- Classic square Steve face: brown hair, blue eyes, nose and beard -->
        <rect x="2" y="0" width="29" height="25" fill="#bf8053"/>
        <path d="M2 0h29v5H8v4H2zM27 5h4v10h-4z" fill="#4d3527"/>
        <path d="M2 5h5v4H2zM25 5h2v4h-2z" fill="#4d3527"/>
        <rect x="7" y="10" width="7" height="5" fill="#f3ead5"/>
        <rect x="20" y="10" width="7" height="5" fill="#f3ead5"/>
        <rect x="10" y="10" width="4" height="5" fill="#4c91a5"/>
        <rect x="20" y="10" width="4" height="5" fill="#4c91a5"/>
        <path d="M14 16h5v4h-5z" fill="#a76543"/>
        <path d="M10 18h5v3h-5zM18 18h5v3h-5zM8 21h17v4H8zM5 18h4v7H5zM25 18h4v7h-4z" fill="#6f4633"/>
        <rect x="14" y="21" width="5" height="2" fill="#a76543"/>

        <!-- Forearm and hand sit over the haft to make the grip read clearly -->
        <path d="M28 28h7v9h-7z" fill="#b8794c"/>
        <path d="M29 35h8v8h-8z" fill="#d3915e"/>
        <path d="M28 36h4v7h-4z" fill="#bf8053"/>
        <path d="M26 35h5v8h-5z" fill="#397da0"/>

        <!-- Split blue trousers and the same dark boots, with a subtle walking cycle -->
        <g id="left-leg" transform="rotate(-4 10 52)">
          <path d="M4 51h12v18H4z" fill="#354d83"/>
          <path d="M4 51h5v18H4z" fill="#405c96"/>
          <path d="M2 68h14v7H2z" fill="#49372c"/>
          <animateTransform attributeName="transform" type="rotate" values="-8 10 52;8 10 52;-8 10 52" dur=".72s" repeatCount="indefinite"/>
        </g>
        <g id="right-leg" transform="rotate(4 22 52)">
          <path d="M17 51h12v18H17z" fill="#405c96"/>
          <path d="M24 51h5v18h-5z" fill="#354d83"/>
          <path d="M16 68h14v7H16z" fill="#49372c"/>
          <animateTransform attributeName="transform" type="rotate" values="8 22 52;-8 22 52;8 22 52" dur=".72s" repeatCount="indefinite"/>
        </g>

        <!-- Contact pulse lands on the same contribution column as the tool -->
        <g id="tool-impact" transform="translate(46 13)" opacity="0">
          <path d="M0 -5v-4M-5 0h-4M0 5v4M5 0h4" stroke="#d7fff4" stroke-width="2"/>
          <rect x="-8" y="-8" width="2" height="2" fill="#56e2d2"/>
          <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.36;.44;.58;1" dur=".72s" repeatCount="indefinite"/>
        </g>
      </g>
    </g>
  </g>
</g>`;
}

export function buildArcadeStarfighter(targets = []) {
  return `<g id="starfighter">
  <!-- Forward Boresight Sighting Laser Guide -->
  ${buildDynamicReticle(targets)}

  <!-- Dual-Hull Arcade Starfighter Chassis -->
  <g transform="translate(0,0)">
    <!-- Expanding Ion Particle Glow -->
    <ellipse cx="0" cy="18" rx="14" ry="3" fill="url(#ionGlow)" opacity="0.7">
      <animate attributeName="rx" values="12;18;13;17" dur="0.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0.85;0.4;0.9" dur="0.2s" repeatCount="indefinite"/>
    </ellipse>

    <!-- Twin Wingtip Plasma Railgun Cannons -->
    <rect x="-21" y="-8" width="2.5" height="18" rx="1" fill="#7DD3FC"/>
    <rect x="18.5" y="-8" width="2.5" height="18" rx="1" fill="#7DD3FC"/>
    <circle cx="-19.75" cy="-8" r="1.8" fill="#22D3EE">
      <animate attributeName="opacity" values="0.6;1;0.6" dur="0.6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="19.75" cy="-8" r="1.8" fill="#22D3EE">
      <animate attributeName="opacity" values="0.6;1;0.6" dur="0.6s" repeatCount="indefinite"/>
    </circle>

    <!-- Port & Starboard Twin Fuselage Pods -->
    <polygon points="-14,-16 -7,-16 -5,9 -16,9" fill="#38BDF8" stroke="#0284C7" stroke-width="1.2"/>
    <polygon points="7,-16 14,-16 16,9 5,9" fill="#38BDF8" stroke="#0284C7" stroke-width="1.2"/>

    <!-- Center Deck Armor & Delta Wing Bridge -->
    <polygon points="-7,-7 7,-7 18,9 5,6 -5,6 -18,9" fill="#0284C7"/>
    <polygon points="0,-12 6,4 0,1 -6,4" fill="#0F172A"/>

    <!-- Crystalline Pilot Canopy -->
    <ellipse cx="0" cy="-3" rx="3.2" ry="5.8" fill="#E0F2FE" opacity="0.95"/>
    <ellipse cx="0" cy="-4.5" rx="1.5" ry="2.6" fill="#FFFFFF"/>

    <!-- Twin High-Frequency Plasma Thruster Flames -->
    <g id="twin-thrusters">
      <!-- Left Thruster Flame -->
      <polygon points="-13,9 -8,9 -10.5,26" fill="url(#plasmaFlame)">
        <animate attributeName="opacity" values="0.75;1;0.6;0.95;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
      <polygon points="-12,9 -9,9 -10.5,15" fill="#FFFFFF">
        <animate attributeName="opacity" values="0.8;1;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>

      <!-- Right Thruster Flame -->
      <polygon points="8,9 13,9 10.5,26" fill="url(#plasmaFlame)">
        <animate attributeName="opacity" values="0.75;1;0.6;0.95;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
      <polygon points="9,9 12,9 10.5,15" fill="#FFFFFF">
        <animate attributeName="opacity" values="0.8;1;0.7;1" dur="0.16s" repeatCount="indefinite"/>
      </polygon>
    </g>
  </g>

  <!-- Smooth Spline Horizontal Patrol Kinematics -->
  <animateTransform attributeName="transform" attributeType="XML" type="translate"
    dur="${LOOP_DUR}s" repeatCount="indefinite" calcMode="spline"
    keyTimes="0; 0.5; 1"
    keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
    values="${JET_X_START},${JET_Y}; ${JET_X_END},${JET_Y}; ${JET_X_START},${JET_Y}"/>
</g>`;
}

export function buildSvg(weeks, options = {}) {
  const { mock = false, username = USERNAME, cols = COLS } = options;
  if (mock || !weeks || weeks.length === 0) weeks = generateMockWeeks(cols);

  const cells = buildCells(weeks, cols);
  const activeTargets = selectTargets(cells);
  const stats = computeStats(cells);
  const title = options.title || `OVERWORLD // ${sanitizeText(username).toUpperCase()}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#344c58"/><stop offset="1" stop-color="#718174"/></linearGradient>
  <style>
    .hud-label { font-family: 'Courier New', Consolas, monospace; font-size: 13px; fill: #d1d8c2; font-weight: bold; }
    .hud-value { font-family: 'Courier New', Consolas, monospace; font-size: 14px; fill: #fff2d6; font-weight: bold; }
    .axis-label { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: #e0e6d0; font-weight: bold; }
    .legend-text { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: #e0e6d0; font-weight: bold; }
    .hud-meta { font-family: 'Courier New', Consolas, monospace; font-size: 11px; fill: #d5ddca; }
    text { white-space: pre; }
  </style>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sky)"/>
<rect width="${WIDTH}" height="44" fill="#1c241d"/>
<rect y="44" width="${WIDTH}" height="3" fill="#6f9c48"/>
<text x="24" y="28" class="hud-value">${sanitizeText(title)}</text>
<text x="390" y="28" class="hud-label">CONTRIBUTIONS <tspan class="hud-value">${stats.total.toLocaleString("en-US")}</tspan></text>
<text x="660" y="28" class="hud-label">ACTIVE DAYS <tspan class="hud-value">${stats.activeDays}</tspan></text>
<text x="1000" y="28" class="hud-label">DIAMOND PICKAXE</text>
<line x1="20" y1="47" x2="1160" y2="47" stroke="#384334" stroke-width="1"/>
${buildStars()}
<rect x="${GRID_X - 12}" y="66" width="${COLS * STEP - GAP + 24}" height="159" fill="#222c27" opacity=".76"/>
<rect x="${GRID_X - 8}" y="70" width="${COLS * STEP - GAP + 16}" height="151" fill="#202a27" opacity=".45"/>
<g id="month-labels">${buildMonthLabels(cells)}</g>
<g id="day-labels">${buildDayLabels()}</g>
<g id="contribution-blocks">${buildGrid(cells, activeTargets.slice(0, 3))}</g>
<g id="terrain" shape-rendering="crispEdges">
  <rect y="248" width="${WIDTH}" height="92" fill="#63462f"/>
  <rect y="248" width="${WIDTH}" height="8" fill="#719b43"/>
  <rect y="256" width="${WIDTH}" height="5" fill="#526f34"/>
  <path d="M0 277h48v12h38v-12h51v12h26v-12h114v12h38v-12h127v12h35v-12h140v12h24v-12h173v12h31v-12h130v12h47v-12h72v63H0z" fill="#765238"/>
  <path d="M0 311h76v-12h24v12h136v-12h22v12h158v-12h34v12h125v-12h23v12h202v-12h30v12h146v-12h27v12h97v29H0z" fill="#553d2c"/>
</g>
${buildLegend()}
<text x="${WIDTH - 24}" y="${HEIGHT - 12}" class="hud-meta" text-anchor="end">Mined over the last 52 weeks</text>
${buildMinecraftSteve()}
${buildMiningSparks(activeTargets)}
<rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" fill="none" stroke="#111811" stroke-width="2"/>
</svg>`;
}

const QUERY = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount color}}}}}}`;

export async function fetchWeeks(username = USERNAME, token = TOKEN) {
  const endpoint = "https://api.github.com/graphql";
  if (!validateApiEndpoint(endpoint)) {
    throw new Error("Invalid GraphQL endpoint configuration");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login: username } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error("GraphQL query execution failed: " + JSON.stringify(json.errors));
  }
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
    const level = Number(levelText);
    days.push({ date, contributionCount, color: THEME.palette[level] });
  }

  if (days.length < 350) throw new Error(`GitHub returned an incomplete contribution calendar (${days.length} days)`);
  days.sort((a, b) => a.date.localeCompare(b.date));

  const weeksBySunday = new Map();
  for (const day of days) {
    const date = new Date(`${day.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    const sunday = date.toISOString().slice(0, 10);
    if (!weeksBySunday.has(sunday)) weeksBySunday.set(sunday, []);
    weeksBySunday.get(sunday).push(day);
  }

  const weeks = [...weeksBySunday.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sunday, contributionDays]) => {
    const byWeekday = new Map(contributionDays.map(day => [new Date(`${day.date}T00:00:00Z`).getUTCDay(), day]));
    const start = new Date(`${sunday}T00:00:00Z`);
    const completeDays = Array.from({ length: ROWS }, (_, weekday) => {
      const existing = byWeekday.get(weekday);
      if (existing) return existing;
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + weekday);
      return { date: date.toISOString().slice(0, 10), contributionCount: 0, color: THEME.palette[0] };
    });
    return { contributionDays: completeDays };
  });
  return weeks;
}

export async function fetchPublicContributionWeeks(username = USERNAME) {
  if (!validateUsername(username)) throw new Error("Invalid GitHub username");
  const endpoint = `https://github.com/users/${encodeURIComponent(username)}/contributions`;
  const response = await fetch(endpoint, { headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`GitHub profile returned HTTP ${response.status}`);
  return parsePublicContributionCalendar(await response.text());
}

export async function main() {
  console.log("=================================================");
  console.log("Initializing Minecraft GitHub Profile Generator");
  console.log("=================================================");

  // 1. Load configuration from profile.config.json
  const { loadProfileConfig, fetchAvatarDataUri, buildProfileSvg } = await import("./profile.mjs");
  const config = loadProfileConfig("profile.config.json");
  const effectiveUsername = process.env.GH_USERNAME || config.username || USERNAME;

  console.log(`Target Profile User: @${effectiveUsername}`);

  // 2. Fetch avatar if auto or URL configured
  let avatarDataUri = "";
  if (config.avatar?.auto !== false) {
    console.log(`Fetching avatar for @${effectiveUsername}...`);
    try {
      avatarDataUri = await fetchAvatarDataUri(effectiveUsername, config.avatar?.url);
      if (avatarDataUri) {
        console.log(`Retrieved avatar (${Math.round(avatarDataUri.length / 1024)} KB base64 payload).`);
      } else {
        console.log("No avatar stream retrieved; using the pixel frame without a portrait.");
      }
    } catch (e) {
      console.warn(`Avatar fetch notice: ${e.message}`);
    }
  }

  // 3. Generate Dark & Light Profile SVG Cards
  console.log("Building Dark & Light Overworld Profile Cards...");
  const darkSvg = buildProfileSvg(config, { theme: "dark", avatarDataUri });
  const lightSvg = buildProfileSvg(config, { theme: "light", avatarDataUri });

  fs.writeFileSync(path.resolve("dark.svg"), darkSvg, "utf8");
  fs.writeFileSync(path.resolve("light.svg"), lightSvg, "utf8");
  console.log(`Generated dark.svg (${Buffer.byteLength(darkSvg, "utf8")} bytes)`);
  console.log(`Generated light.svg (${Buffer.byteLength(lightSvg, "utf8")} bytes)`);

  // 4. Generate the animated Overworld contribution SVG
  console.log("Building the live Overworld contribution heatmap...");
  let weeks;
  if (TOKEN && effectiveUsername) {
    try {
      console.log(`Querying live GitHub contributions for @${effectiveUsername}...`);
      weeks = await fetchWeeks(effectiveUsername, TOKEN);
      console.log(`Successfully retrieved ${weeks.length} weeks from the GitHub API.`);
    } catch (err) {
      console.warn(`GitHub API fetch failed (${err.message}); reading the public contribution graph instead.`);
    }
  }
  if (!weeks) {
    console.log(`Reading the public contribution graph for @${effectiveUsername}...`);
    weeks = await fetchPublicContributionWeeks(effectiveUsername);
    console.log(`Successfully retrieved ${weeks.length} weeks from GitHub's public graph.`);
  }

  const heatmapTitle = config.heatmap?.title || `OVERWORLD // ${effectiveUsername.toUpperCase()}`;
  const svg = buildSvg(weeks, { username: effectiveUsername, title: heatmapTitle });
  const outPath = path.resolve(OUTPUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`Wrote ${outPath} (${Buffer.byteLength(svg, "utf8")} bytes)`);

  // Also sync to root github-jet.svg if writing to dist/
  if (OUTPUT.includes("dist")) {
    const rootSvg = path.resolve("github-jet.svg");
    fs.writeFileSync(rootSvg, svg, "utf8");
    console.log(`Synced to ${rootSvg}`);
  }

  console.log("=================================================");
  console.log("All profile assets generated & synchronized cleanly!");
  console.log("=================================================");
}

// Only auto-execute main() if invoked directly from CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  main().catch(err => {
    console.error("FATAL:", err.message);
    process.exit(1);
  });
}
