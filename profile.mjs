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
  commandTitle: "somya@codes ~ % ./profile.sh --live",
  role: "AI/ML Engineer · Full Stack",
  education: "CSE (AIML)",
  status: "Building · Learning · Shipping",
  avatar: {
    auto: true,
    url: "",
    borderGlow: "#22C55E",
    badgeText: "PILOT // ONLINE"
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
    "title": "[ARCADE DEFENSE GRID // SECTOR: SOMYACODES07]"
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
 * Builds formatted dotted lines for terminal system info
 */
export function buildInfoLines(config) {
  const lines = [];

  // Line 0: Header
  const title = config.commandTitle ? config.commandTitle.split("~")[0].trim() : `${config.username}@codes`;
  lines.push({
    type: "header",
    head: title,
    sep: " -——————————————————————————————————————————-—-"
  });

  // Line 1: Subject / Name
  lines.push({
    type: "kv",
    key: "Subject",
    dots: " ................ ",
    value: config.name || config.username
  });

  // Line 2: Role
  if (config.role) {
    lines.push({
      type: "kv",
      key: "Role",
      dots: " ................... ",
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
      dots: " .............. ",
      value: config.education
    });
  }

  // Status
  if (config.status) {
    lines.push({
      type: "kv",
      key: "Status",
      dots: " ................. ",
      value: config.status
    });
  }

  // Skills
  if (config.skills && typeof config.skills === "object") {
    for (const [k, v] of Object.entries(config.skills)) {
      const padLen = Math.max(2, 20 - k.length);
      const dots = " " + ".".repeat(padLen) + " ";
      lines.push({
        type: "kv",
        key: k,
        dots,
        value: String(v)
      });
    }
  }

  // Divider
  lines.push({ type: "empty" });

  // Contact Header
  lines.push({
    type: "section",
    accent: "- Contact",
    sep: " -————————————————————————————————————————————-—-"
  });

  lines.push({ type: "empty" });

  // Contacts
  if (config.contacts && typeof config.contacts === "object") {
    for (const [k, v] of Object.entries(config.contacts)) {
      const padLen = Math.max(2, 20 - k.length);
      const dots = " " + ".".repeat(padLen) + " ";
      lines.push({
        type: "kv",
        key: k,
        dots,
        value: String(v)
      });
    }
  }

  // Divider
  lines.push({ type: "empty" });

  // Live Stats Header
  lines.push({
    type: "section",
    accent: "- Live Stats",
    sep: " -————————————————————————————————————————————-—-"
  });

  lines.push({
    type: "note",
    value: "See live GitHub stats & contribution defense grid below ↓"
  });

  return lines;
}

/**
 * Builds SVG clip-paths and animated text elements for terminal lines
 */
export function renderTerminalLines(lines, theme = "dark") {
  const lineYStart = 42;
  const lineStep = 22;
  let clipPaths = "";
  let textElements = "";

  const isDark = theme === "dark";
  const textColor = isDark ? "#dbeafe" : "#1E293B";
  const keyColor = isDark ? "#4ADE80" : "#047857";
  const valColor = isDark ? "#FFFFFF" : "#0F172A";
  const ccColor = isDark ? "#1E3A2F" : "#CBD5E1";
  const headColor = isDark ? "#22C55E" : "#059669";
  const accentColor = isDark ? "#34D399" : "#0284C7";
  const noteColor = isDark ? "#94A3B8" : "#64748B";

  lines.forEach((line, i) => {
    const clipId = `lc${i}`;
    const yPos = lineYStart + i * lineStep;
    const animDelay = (0.75 + i * 0.11).toFixed(2);

    clipPaths += `  <clipPath id="${clipId}"><rect x="500" y="${(yPos - 16).toFixed(2)}" width="0" height="24"><animate attributeName="width" from="0" to="690" dur="0.38s" begin="${animDelay}s" fill="freeze"/></rect></clipPath>\n`;

    let lineInner = "";
    if (line.type === "header") {
      lineInner = `<tspan x="520" y="${yPos}" class="head" fill="${headColor}">${escapeXml(line.head)}</tspan><tspan class="cc" fill="${ccColor}">${escapeXml(line.sep)}</tspan>`;
    } else if (line.type === "kv") {
      lineInner = `<tspan x="520" y="${yPos}" class="cc" fill="${ccColor}">. </tspan><tspan class="key" fill="${keyColor}">${escapeXml(line.key)}</tspan><tspan class="cc" fill="${ccColor}">${escapeXml(line.dots)}</tspan><tspan class="value" fill="${valColor}">${escapeXml(line.value)}</tspan>`;
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
 * Renders the Cyberpunk Holographic Avatar HUD in the left panel
 */
export function renderAvatarHud(config, avatarDataUri = "", theme = "dark") {
  const isDark = theme === "dark";
  const glowColor = config.avatar?.borderGlow || (isDark ? "#22C55E" : "#059669");
  const cyanColor = isDark ? "#38BDF8" : "#0284C7";
  const badgeText = config.avatar?.badgeText || "PILOT // ONLINE";
  const usernameUpper = (config.username || "PILOT").toUpperCase();
  const avatarHref = avatarDataUri || config.avatar?.url || `https://avatars.githubusercontent.com/${config.username}?size=400`;

  return `
  <!-- Left Panel: Cyberpunk Holographic Avatar & Biometric HUD -->
  <g transform="translate(0, 18)">
    <!-- Tech Frame Background -->
    <rect x="14" y="0" width="488" height="490" rx="14" fill="${isDark ? '#0B1120' : '#FFFFFF'}" fill-opacity="${isDark ? '0.45' : '0.85'}" stroke="url(#borderGrad)" stroke-width="1" opacity="${isDark ? '0.45' : '0.9'}"/>
    
    <!-- Outer Holographic Rotating HUD Ring -->
    <circle cx="258" cy="195" r="132" stroke="url(#borderGrad)" stroke-width="2" stroke-dasharray="14 10 4 10" fill="none" opacity="0.85">
      <animateTransform attributeName="transform" type="rotate" from="0 258 195" to="360 258 195" dur="24s" repeatCount="indefinite"/>
    </circle>

    <!-- Inner Counter-Rotating Reticle Ring -->
    <circle cx="258" cy="195" r="122" stroke="${cyanColor}" stroke-width="1.5" stroke-dasharray="8 20 40 20" fill="none" opacity="0.6">
      <animateTransform attributeName="transform" type="rotate" from="360 258 195" to="0 258 195" dur="18s" repeatCount="indefinite"/>
    </circle>

    <!-- 4 Cyber Corner Reticles -->
    <!-- Top-Left -->
    <path d="M 125 72 L 115 72 L 115 102" fill="none" stroke="${glowColor}" stroke-width="2.5" opacity="0.9"/>
    <!-- Top-Right -->
    <path d="M 391 72 L 401 72 L 401 102" fill="none" stroke="${glowColor}" stroke-width="2.5" opacity="0.9"/>
    <!-- Bottom-Left -->
    <path d="M 115 288 L 115 318 L 125 318" fill="none" stroke="${glowColor}" stroke-width="2.5" opacity="0.9"/>
    <!-- Bottom-Right -->
    <path d="M 401 288 L 401 318 L 391 318" fill="none" stroke="${glowColor}" stroke-width="2.5" opacity="0.9"/>

    <!-- Avatar Image (Clipped to Rounded Cyber Octagon / Circle) -->
    <clipPath id="avatarClip">
      <circle cx="258" cy="195" r="110"/>
    </clipPath>

    <!-- Avatar Background Glow / Fallback Placeholder -->
    <circle cx="258" cy="195" r="110" fill="${isDark ? '#0F172A' : '#E2E8F0'}"/>

    <!-- Vector Cyber Pilot Avatar Placeholder (Behind Image) -->
    <g transform="translate(258, 195) scale(0.9)" opacity="0.8">
      <circle cx="0" cy="-25" r="38" fill="none" stroke="${cyanColor}" stroke-width="3"/>
      <path d="M -24 -28 Q 0 -42 24 -28 Q 0 -14 -24 -28" fill="${glowColor}" opacity="0.75"/>
      <path d="M -50 55 C -50 15, 50 15, 50 55" fill="none" stroke="${cyanColor}" stroke-width="3"/>
      <circle cx="-12" cy="-26" r="3" fill="#FFFFFF"/>
      <circle cx="12" cy="-26" r="3" fill="#FFFFFF"/>
    </g>

    <!-- User Profile Picture with Smooth Fade-in -->
    <image x="148" y="85" width="220" height="220" clip-path="url(#avatarClip)" href="${avatarHref}" xlink:href="${avatarHref}" preserveAspectRatio="xMidYMid slice" opacity="0.95">
      <animate attributeName="opacity" values="0.85;1;0.85" dur="4s" repeatCount="indefinite"/>
    </image>

    <!-- Biometric Laser Scanner Line Sweeping across Avatar -->
    <line x1="148" y1="85" x2="368" y2="85" stroke="${glowColor}" stroke-width="2.5" opacity="0.85">
      <animate attributeName="y1" values="85;305;85" dur="3.2s" repeatCount="indefinite"/>
      <animate attributeName="y2" values="85;305;85" dur="3.2s" repeatCount="indefinite"/>
    </line>

    <!-- Glowing Cyber Hexagonal Outer Border Overlay -->
    <circle cx="258" cy="195" r="111" fill="none" stroke="${glowColor}" stroke-width="2.5" opacity="0.8"/>

    <!-- Bottom Telemetry HUD Data Badges -->
    <!-- Pilot Identity Badge -->
    <rect x="74" y="340" width="368" height="30" rx="6" fill="${isDark ? '#050816' : '#F1F5F9'}" stroke="url(#borderGrad)" stroke-width="1" fill-opacity="0.9"/>
    <circle cx="94" cy="355" r="4" fill="${glowColor}">
      <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
    </circle>
    <text x="110" y="360" font-family="'Courier New', Consolas, monospace" font-size="12px" font-weight="bold" fill="${isDark ? '#86EFAC' : '#047857'}" letter-spacing="1.5px">[IDENT: @${escapeXml(usernameUpper)}]</text>

    <!-- Status & System Telemetry Badges -->
    <rect x="74" y="380" width="180" height="26" rx="5" fill="${isDark ? '#0B1120' : '#F8FAFC'}" stroke="${cyanColor}" stroke-width="1" opacity="0.9"/>
    <text x="86" y="397" font-family="'Courier New', Consolas, monospace" font-size="10.5px" font-weight="bold" fill="${cyanColor}" letter-spacing="1px">${escapeXml(badgeText)}</text>

    <rect x="262" y="380" width="180" height="26" rx="5" fill="${isDark ? '#0B1120' : '#F8FAFC'}" stroke="${glowColor}" stroke-width="1" opacity="0.9"/>
    <text x="274" y="397" font-family="'Courier New', Consolas, monospace" font-size="10.5px" font-weight="bold" fill="${isDark ? '#34D399' : '#059669'}" letter-spacing="1px">SYS.VER // v2.4</text>

    <!-- Animated Equalizer Signal Wave Bars -->
    <g transform="translate(185, 422)">
      <rect x="0" y="0" width="4" height="14" rx="2" fill="${glowColor}"><animate attributeName="height" values="4;16;6;14;4" dur="1.1s" repeatCount="indefinite"/><animate attributeName="y" values="10;-2;8;0;10" dur="1.1s" repeatCount="indefinite"/></rect>
      <rect x="8" y="0" width="4" height="14" rx="2" fill="${cyanColor}"><animate attributeName="height" values="12;4;16;8;12" dur="0.9s" repeatCount="indefinite"/><animate attributeName="y" values="2;10;-2;6;2" dur="0.9s" repeatCount="indefinite"/></rect>
      <rect x="16" y="0" width="4" height="14" rx="2" fill="${glowColor}"><animate attributeName="height" values="8;18;4;14;8" dur="1.3s" repeatCount="indefinite"/><animate attributeName="y" values="6;-4;10;0;6" dur="1.3s" repeatCount="indefinite"/></rect>
      <rect x="24" y="0" width="4" height="14" rx="2" fill="${cyanColor}"><animate attributeName="height" values="16;6;12;4;16" dur="1.0s" repeatCount="indefinite"/><animate attributeName="y" values="-2;8;2;10;-2" dur="1.0s" repeatCount="indefinite"/></rect>
      <rect x="32" y="0" width="4" height="14" rx="2" fill="${glowColor}"><animate attributeName="height" values="6;14;8;18;6" dur="1.2s" repeatCount="indefinite"/><animate attributeName="y" values="8;0;6;-4;8" dur="1.2s" repeatCount="indefinite"/></rect>
      <text x="46" y="12" font-family="'Courier New', Consolas, monospace" font-size="10px" fill="${isDark ? '#94A3B8' : '#64748B'}" letter-spacing="1px">LIVE BIOMETRIC TELEMETRY</text>
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

  const commandLabel = config.commandTitle || `${config.username}@codes ~ % ./profile.sh --live`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1180" height="586" viewBox="0 0 1180 586">
<defs>
  <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${isDark ? '#22C55E' : '#059669'}"/>
    <stop offset="50%" stop-color="${isDark ? '#10B981' : '#0284C7'}"/>
    <stop offset="100%" stop-color="${isDark ? '#34D399' : '#0D9488'}"/>
  </linearGradient>
  <radialGradient id="bgGlow" cx="30%" cy="20%" r="80%">
    <stop offset="0%" stop-color="${isDark ? '#0B1120' : '#FFFFFF'}"/>
    <stop offset="100%" stop-color="${isDark ? '#050816' : '#F1F5F9'}"/>
  </radialGradient>
  <linearGradient id="scanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="${isDark ? '#22C55E' : '#059669'}" stop-opacity="0"/>
    <stop offset="45%" stop-color="${isDark ? '#22C55E' : '#059669'}" stop-opacity="0.06"/>
    <stop offset="50%" stop-color="${isDark ? '#86EFAC' : '#34D399'}" stop-opacity="0.4"/>
    <stop offset="55%" stop-color="${isDark ? '#22C55E' : '#059669'}" stop-opacity="0.06"/>
    <stop offset="100%" stop-color="${isDark ? '#10B981' : '#0284C7'}" stop-opacity="0"/>
  </linearGradient>
  <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="1" fill="${isDark ? '#7DD3FC' : '#94A3B8'}" opacity="${isDark ? '0.04' : '0.03'}"/>
  </pattern>
${clipPaths}
  <style>
    .key    { font-family: 'Courier New', Consolas, monospace; font-size: 15px; font-weight: bold; }
    .value  { font-family: 'Courier New', Consolas, monospace; font-size: 15px; font-weight: 500; }
    .cc     { font-family: 'Courier New', Consolas, monospace; font-size: 15px; }
    .head   { font-family: 'Courier New', Consolas, monospace; font-size: 17px; font-weight: bold; }
    .accent { font-family: 'Courier New', Consolas, monospace; font-size: 15px; font-weight: bold; }
    text, tspan { white-space: pre; }
    
    .term-label { font-family: 'Courier New', Consolas, monospace; font-size: 12px; fill: ${isDark ? '#86EFAC' : '#0F172A'}; letter-spacing: 0.5px; opacity: 0.9; }
    .scan-label { font-family: 'Courier New', Consolas, monospace; font-size: 10px; fill: #F87171; letter-spacing: 1px; }
    .panel-title-blue { font-family: 'Courier New', Consolas, monospace; font-size: 11px; fill: ${isDark ? '#38BDF8' : '#0284C7'}; letter-spacing: 2px; opacity: 0.9; font-weight: bold; }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: 11px; fill: ${isDark ? '#22C55E' : '#059669'}; letter-spacing: 2px; opacity: 0.9; font-weight: bold; }
  </style>
</defs>

<rect width="1180" height="586" rx="18" fill="url(#bgGlow)"/>
<rect width="1180" height="586" rx="18" fill="url(#scanlines)"/>

<g id="titlebar">
  <rect x="3" y="3" width="1174" height="34" rx="16" fill="${isDark ? '#0B1120' : '#E2E8F0'}" fill-opacity="${isDark ? '0.85' : '0.95'}"/>
  <circle cx="24" cy="20" r="5" fill="#EF4444"><animate attributeName="opacity" values="1;0.55;1" dur="4s" repeatCount="indefinite"/></circle>
  <circle cx="42" cy="20" r="5" fill="#F59E0B"><animate attributeName="opacity" values="1;0.55;1" dur="4s" begin="0.3s" repeatCount="indefinite"/></circle>
  <circle cx="60" cy="20" r="5" fill="#10B981"><animate attributeName="opacity" values="1;0.55;1" dur="4s" begin="0.6s" repeatCount="indefinite"/></circle>
  <text x="590" y="25" text-anchor="middle" class="term-label">${escapeXml(commandLabel)}</text>
  <circle cx="1070" cy="20" r="4" fill="#F87171">
    <animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite"/>
  </circle>
  <text x="1080" y="24" class="scan-label">ONLINE</text>
</g>

<g transform="translate(0,44)">
  ${avatarHudSvg}

  <!-- Right Panel: System Info & Skill Matrix -->
  <rect x="508" y="8" width="655" height="518" rx="14" fill="${isDark ? '#0B1120' : '#FFFFFF'}" fill-opacity="${isDark ? '0.45' : '0.85'}" stroke="url(#borderGrad)" stroke-width="1" opacity="${isDark ? '0.45' : '0.9'}"/>
  <text x="30" y="14" class="panel-title-blue">AVATAR.HUD // BIOMETRIC</text>
  <text x="524" y="6" class="panel-title">SYSTEM.INFO</text>

${textElements}
${cursorElement}
</g>

<rect x="0" y="-70" width="1180" height="70" fill="url(#scanGrad)" opacity="0.7" style="mix-blend-mode:${isDark ? 'screen' : 'multiply'}">
  <animateTransform attributeName="transform" type="translate" from="0 -70" to="0 630" dur="4.2s" repeatCount="indefinite"/>
</rect>

<rect x="3" y="3" width="1174" height="580" rx="16" fill="none" stroke="url(#borderGrad)" stroke-width="2" opacity="0.85">
  <animate attributeName="opacity" values="0.6;0.95;0.6" dur="3.2s" repeatCount="indefinite"/>
</rect>
</svg>`;
}
