import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

/**
 * Default fallback configuration
 */
export const DEFAULT_CONFIG = {
  username: "somyacodes07",
  name: "Somyajeet",
  commandTitle: "somya@overworld ~ % ./profile.sh --live",
  role: "AI/ML Engineer · Full Stack",
  education: "CSE (AIML)",
  status: "Building · Learning · Shipping",
  avatar: {
    auto: true,
    url: "",
    borderGlow: "#70C44A",
    badgeText: "MINER // ONLINE"
  },
  skills: {
    "ToolChain": "Hermes / Codex / Claude Code, Docker, Obsidian",
    "Core.Lang": "Python, Rust, JS, TS, Java, Kotlin",
    "Core.Frontend": "React, Next.js, Tailwind, Vite",
    "Core.Backend": "Node.js, FastAPI, Redis",
    "Core.Database": "PostgreSQL, MongoDB, Supabase",
    "Core.Infra": "Docker, GitHub Actions, Vercel"
  },
  contacts: {
    "Portfolio": "github.com/somyacodes07",
    "LinkedIn": "somyajeetsingh",
    "GitHub": "somyacodes07"
  },
  heatmap: {
    "title": "OVERWORLD // SOMYACODES07"
  }
};

/**
 * Loads configuration from profile.config.json or returns default
 */
export function loadProfileConfig(configPath = "profile.config.json") {
  try {
    const resolvedPath = path.resolve(configPath);
    if (fs.existsSync(resolvedPath)) {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        avatar: { ...DEFAULT_CONFIG.avatar, ...(parsed.avatar || {}) },
        skills: parsed.skills ? { ...parsed.skills } : { ...DEFAULT_CONFIG.skills },
        contacts: parsed.contacts ? { ...parsed.contacts } : { ...DEFAULT_CONFIG.contacts },
        heatmap: { ...DEFAULT_CONFIG.heatmap, ...(parsed.heatmap || {}) }
      };
    }
  } catch (err) {
    console.warn(`Could not read config at ${configPath}, using defaults: ${err.message}`);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Escapes XML/SVG special characters
 */
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

/**
 * Fetches user avatar as Base64 Data URI with redirect handling and multi-tier fallbacks
 */
export async function fetchAvatarDataUri(username, customUrl = "") {
  const targetUrl = customUrl || (username ? `https://github.com/${username}.png` : "");
  if (!targetUrl) return "";

  // 1. Try global fetch (Node 18+, GitHub Actions)
  if (typeof fetch === "function") {
    try {
      const res = await fetch(targetUrl, {
        headers: { "User-Agent": "github-profile-card-generator" },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const mime = res.headers.get("content-type") || "image/png";
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch (e) {
      // Continue to next fallback
    }
  }

  // 2. Try curl CLI (Built-in on Windows, macOS, Linux)
  try {
    const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
    const buf = execFileSync(curlBin, ["-sL", targetUrl], {
      timeout: 5000,
      maxBuffer: 15 * 1024 * 1024
    });
    if (buf && buf.length > 100) {
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch (e) {
    // Continue to node:https fallback
  }

  // 3. Fallback using node:https
  return new Promise((resolve) => {
    function fetchUrl(currentUrl, redirects = 0) {
      if (redirects > 5) return resolve("");
      try {
        const parsed = new URL(currentUrl);
        const transport = parsed.protocol === "https:" ? https : http;
        const req = transport.get(
          currentUrl,
          {
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 4000,
            family: 4
          },
          (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              res.resume();
              const nextUrl = new URL(res.headers.location, currentUrl).toString();
              return fetchUrl(nextUrl, redirects + 1);
            }
            if (res.statusCode !== 200) {
              res.resume();
              return resolve("");
            }
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              const buf = Buffer.concat(chunks);
              const mime = res.headers["content-type"] || "image/png";
              resolve(`data:${mime};base64,${buf.toString("base64")}`);
            });
            res.on("error", () => resolve(""));
          }
        );
        req.on("timeout", () => {
          req.destroy();
          resolve("");
        });
        req.on("error", () => resolve(""));
      } catch (err) {
        resolve("");
      }
    }
    fetchUrl(targetUrl);
  });
}

/**
 * Helper to produce perfectly aligned 28-character monospace prefixes
 */
export function makeDots(key) {
  const numDots = Math.max(1, 23 - key.length);
  return ": " + ".".repeat(numDots) + " ";
}

/**
 * Builds formatted dotted lines for terminal system info
 */
export function buildInfoLines(config) {
  const lines = [];

  // The command prompt is already shown in the card titlebar.
  // Subject / Name
  lines.push({
    type: "kv",
    key: "Subject",
    dots: makeDots("Subject"),
    value: config.name || config.username
  });

  // Line 2: Role
  if (config.role) {
    lines.push({
      type: "kv",
      key: "Role",
      dots: makeDots("Role"),
      value: config.role
    });
  }

  // Divider
  lines.push({ type: "empty" });

  // Education
  if (config.education) {
    lines.push({
      type: "kv",
      key: "Education",
      dots: makeDots("Education"),
      value: config.education
    });
  }

  // Status
  if (config.status) {
    lines.push({
      type: "kv",
      key: "Status",
      dots: makeDots("Status"),
      value: config.status
    });
  }

  // Skills
  if (config.skills && typeof config.skills === "object") {
    for (const [k, v] of Object.entries(config.skills)) {
      lines.push({
        type: "kv",
        key: k,
        dots: makeDots(k),
        value: String(v)
      });
    }
  }

  // Divider
  lines.push({ type: "empty" });

  // Contact Header
  lines.push({
    type: "section",
    accent: "- Tools & Links",
    sep: " -————————————————————————————————————————————-—-"
  });

  lines.push({ type: "empty" });

  // Contacts
  if (config.contacts && typeof config.contacts === "object") {
    for (const [k, v] of Object.entries(config.contacts)) {
      lines.push({
        type: "kv",
        key: k,
        dots: makeDots(k),
        value: String(v)
      });
    }
  }

  // Divider
  lines.push({ type: "empty" });

  // Live Stats Header
  lines.push({
    type: "section",
    accent: "- Contribution World",
    sep: " -————————————————————————————————————————————-—-"
  });

  lines.push({
    type: "note",
    value: "Watch Steve mine this GitHub contribution world below ↓"
  });

  return lines;
}

/**
 * Builds SVG clip-paths and animated text elements for terminal lines
 */
export function renderTerminalLines(lines, theme = "dark") {
  const lineYStart = 66;
  const lineStep = 20;
  let clipPaths = "";
  let textElements = "";

  const isDark = theme === "dark";
  const textColor = isDark ? "#e3e8d6" : "#22291e";
  const keyColor = isDark ? "#9bd469" : "#4e852f";
  const valColor = isDark ? "#f2f0df" : "#292e25";
  const ccColor = isDark ? "#596451" : "#b2b99f";
  const headColor = isDark ? "#b8e385" : "#557d34";
  const accentColor = isDark ? "#e0b76b" : "#88612f";
  const noteColor = isDark ? "#a4ae97" : "#67715d";

  lines.forEach((line, i) => {
    const clipId = `lc${i}`;
    const yPos = lineYStart + i * lineStep;
    const animDelay = (0.75 + i * 0.11).toFixed(2);

    clipPaths += `  <clipPath id="${clipId}"><rect x="500" y="${(yPos - 16).toFixed(2)}" width="0" height="22"><animate attributeName="width" from="0" to="644" dur="0.38s" begin="${animDelay}s" fill="freeze"/></rect></clipPath>\n`;

    let lineInner = "";
    const valueFontSize = line.type === "kv"
      ? Math.min(13.5, Math.max(10.5, ((628 - (2 + line.key.length + line.dots.length) * 8.1) / Math.max(1, line.value.length)) * 1.8))
      : 13.5;
    if (line.type === "header") {
      lineInner = `<tspan x="520" y="${yPos}" class="head" fill="${headColor}">${escapeXml(line.head)}</tspan><tspan class="cc" fill="${ccColor}">${escapeXml(line.sep)}</tspan>`;
    } else if (line.type === "kv") {
      lineInner = `<tspan x="520" y="${yPos}" class="cc">. </tspan><tspan class="key">${escapeXml(line.key)}</tspan><tspan class="cc">${escapeXml(line.dots)}</tspan><tspan class="value" font-size="${valueFontSize.toFixed(1)}px" fill="${valColor}">${escapeXml(line.value)}</tspan>`;
    } else if (line.type === "section") {
      lineInner = `<tspan x="520" y="${yPos}" class="accent" fill="${accentColor}">${escapeXml(line.accent)}</tspan><tspan class="cc" fill="${ccColor}">${escapeXml(line.sep)}</tspan>`;
    } else if (line.type === "note") {
      lineInner = `<tspan x="520" y="${yPos}" class="cc" fill="${ccColor}">. </tspan><tspan class="value" fill="${noteColor}">${escapeXml(line.value)}</tspan>`;
    } else {
      lineInner = `<tspan x="520" y="${yPos}" class="cc" fill="${ccColor}">. </tspan>`;
    }

    textElements += `  <g clip-path="url(#${clipId})"><text x="520" y="0" fill="${textColor}">${lineInner}</text></g>\n`;
  });

  const lastLineY = lineYStart + (lines.length - 1) * lineStep;
  const cursorDelay = (0.75 + lines.length * 0.11 + 0.1).toFixed(2);
  const cursorElement = `  <rect x="522" y="${lastLineY - 14}" width="9" height="16" class="cursor-blink" opacity="0" fill="${isDark ? '#22C55E' : '#059669'}">\n    <animate attributeName="opacity" values="0;0;1;0;1;0;1;0" keyTimes="0;0.01;0.02;0.3;0.5;0.7;0.85;1" dur="1.4s" begin="${cursorDelay}s" repeatCount="indefinite"/>\n  </rect>\n`;

  return { clipPaths, textElements, cursorElement };
}

/**
 * Renders the profile portrait in a block-built Overworld frame
 */
export function renderAvatarHud(config, avatarDataUri = "", theme = "dark") {
  const isDark = theme === "dark";
  const grass = config.avatar?.borderGlow || (isDark ? "#70C44A" : "#4e852f");
  const stone = isDark ? "#8b9182" : "#68705e";
  const badgeText = config.avatar?.badgeText || "MINER // ONLINE";
  const usernameUpper = (config.username || "PILOT").toUpperCase();
  const avatarHref = avatarDataUri || config.avatar?.url || `https://avatars.githubusercontent.com/${config.username}?size=400`;

  return `
  <!-- Pixel framed player portrait -->
  <g transform="translate(0, 18)">
    <rect x="14" y="0" width="488" height="490" fill="${isDark ? '#20261e' : '#d9dec8'}" stroke="${stone}" stroke-width="4"/>
    <rect x="18" y="4" width="480" height="18" fill="${grass}"/>
    <text x="32" y="17" font-family="'Courier New', monospace" font-size="10px" font-weight="bold" fill="#172113">PLAYER SKIN</text>
    <rect x="74" y="42" width="368" height="290" fill="${isDark ? '#343a31' : '#c2c7b5'}" stroke="${stone}" stroke-width="4"/>
    <rect x="82" y="50" width="352" height="274" fill="${isDark ? '#252b24' : '#e5e7da'}"/>
    <image x="94" y="62" width="328" height="250" href="${avatarHref}" xlink:href="${avatarHref}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="74" y="344" width="368" height="32" fill="${isDark ? '#171b16' : '#eef0e7'}" stroke="${stone}" stroke-width="3"/>
    <rect x="86" y="354" width="12" height="12" fill="${grass}"/>
    <text x="108" y="365" font-family="'Courier New', monospace" font-size="12px" font-weight="bold" fill="${isDark ? '#dce8c8' : '#27321f'}">@${escapeXml(usernameUpper)}</text>
    <rect x="74" y="390" width="368" height="30" fill="${isDark ? '#171b16' : '#eef0e7'}" stroke="${stone}" stroke-width="3"/>
    <text x="92" y="410" font-family="'Courier New', monospace" font-size="11px" font-weight="bold" fill="${isDark ? '#a6d77a' : '#4e852f'}">${escapeXml(badgeText)}</text>
    <g transform="translate(198 444)">
      <rect x="0" y="0" width="26" height="26" fill="${isDark ? '#383e35' : '#c9cebb'}" stroke="${stone}" stroke-width="3"/>
      <path d="M5 19L19 5M14 5h6v6" stroke="${isDark ? '#cf9a55' : '#946532'}" stroke-width="4" stroke-linecap="square"/>
      <rect x="36" y="0" width="26" height="26" fill="${isDark ? '#383e35' : '#c9cebb'}" stroke="${stone}" stroke-width="3"/>
      <path d="M41 18l5-10 5 7 4-5 4 8z" fill="${grass}"/>
      <rect x="72" y="0" width="26" height="26" fill="${isDark ? '#383e35' : '#c9cebb'}" stroke="${stone}" stroke-width="3"/>
      <path d="M77 8h16M77 14h16M77 20h16" stroke="${isDark ? '#d7d2bb' : '#747968'}" stroke-width="3"/>
    </g>
  </g>
`;
}

/**
 * Builds the complete profile card SVG (Dark or Light)
 */
export function buildProfileSvg(config = DEFAULT_CONFIG, options = {}) {
  const theme = options.theme || "dark";
  const avatarDataUri = options.avatarDataUri || "";
  const isDark = theme === "dark";

  const lines = buildInfoLines(config);
  const { clipPaths, textElements, cursorElement } = renderTerminalLines(lines, theme);
  const avatarHudSvg = renderAvatarHud(config, avatarDataUri, theme);

  const commandLabel = config.commandTitle || `${config.username}@overworld ~ % ./profile.sh --live`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1180" height="586" viewBox="0 0 1180 586">
<defs>
${clipPaths}
  <style>
    .key    { font-family: 'Courier New', Consolas, monospace; font-size: 13.5px; font-weight: bold; fill: ${isDark ? '#9bd469' : '#4e852f'}; }
    .value  { font-family: 'Courier New', Consolas, monospace; font-size: 13.5px; font-weight: 500; }
    .cc     { font-family: 'Courier New', Consolas, monospace; font-size: 13.5px; fill: ${isDark ? '#75816a' : '#a0a88d'}; }
    .head   { font-family: 'Courier New', Consolas, monospace; font-size: 15px; font-weight: bold; }
    .accent { font-family: 'Courier New', Consolas, monospace; font-size: 13.5px; font-weight: bold; }
    text, tspan { white-space: pre; }
    
    .term-label { font-family: 'Courier New', Consolas, monospace; font-size: 12px; fill: ${isDark ? '#e2e6d7' : '#283020'}; font-weight: bold; }
    .scan-label { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: ${isDark ? '#a5d575' : '#4e852f'}; }
    .panel-title-blue { font-family: 'Courier New', Consolas, monospace; font-size: 11px; fill: ${isDark ? '#d2a45d' : '#80552c'}; font-weight: bold; }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: 11px; fill: ${isDark ? '#a5d575' : '#4e852f'}; font-weight: bold; }
  </style>
</defs>

<rect width="1180" height="586" fill="${isDark ? '#171b16' : '#e7eadf'}"/>
<rect x="0" y="0" width="1180" height="8" fill="${isDark ? '#6fa84b' : '#5b8d38'}"/>
<rect x="0" y="8" width="1180" height="4" fill="${isDark ? '#446b32' : '#82aa55'}"/>

<g id="titlebar">
  <rect x="12" y="18" width="1156" height="30" fill="${isDark ? '#242a21' : '#d0d5c3'}" stroke="${isDark ? '#646b5c' : '#9ca38d'}" stroke-width="2"/>
  <rect x="22" y="27" width="12" height="12" fill="${isDark ? '#80b952' : '#5b8d38'}"/>
  <text x="590" y="38" text-anchor="middle" class="term-label">${escapeXml(commandLabel)}</text>
  <rect x="1090" y="27" width="10" height="10" fill="${isDark ? '#80b952' : '#5b8d38'}"/>
  <text x="1108" y="37" class="scan-label">ONLINE</text>
</g>

<g transform="translate(0,44)">
  ${avatarHudSvg}

  <!-- Inventory style player information panel -->
  <rect x="508" y="8" width="655" height="518" fill="${isDark ? '#20261e' : '#d9dec8'}" stroke="${isDark ? '#747b69' : '#9ca38d'}" stroke-width="4"/>
  <rect x="520" y="16" width="631" height="30" fill="${isDark ? '#30372b' : '#c4cbb3'}"/>
  <text x="532" y="36" class="panel-title">PLAYER INVENTORY</text>
  <text x="30" y="14" class="panel-title-blue">WORLD // OVERWORLD</text>

${textElements}
${cursorElement}
</g>

<rect x="4" y="4" width="1172" height="578" fill="none" stroke="${isDark ? '#646b5c' : '#9ca38d'}" stroke-width="4"/>
</svg>`;
}
