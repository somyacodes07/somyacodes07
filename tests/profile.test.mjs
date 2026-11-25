import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  loadProfileConfig,
  escapeXml,
  wrapText,
  clip,
  iso,
  buildCallouts,
  buildSpecTable,
  buildProfileSvg
} from '../profile.mjs';
import { tokensFor, revStamp } from '../sheet.mjs';

const t = tokensFor('dark');
const date = new Date('2026-11-25T00:00:00Z');

describe('profile sheet 01', () => {
  it('falls back to defaults when the config file is missing', () => {
    const config = loadProfileConfig('nonexistent-config.json');
    assert.equal(config.username, DEFAULT_CONFIG.username);
    assert.ok(Array.isArray(config.specs));
  });

  it('loads the repo config with specs and callouts', () => {
    const config = loadProfileConfig('profile.config.json');
    assert.equal(config.name, 'Somyajeet Singh');
    assert.ok(config.specs.some(s => s.live));
    assert.ok(config.callouts.every(c => c.part && c.text));
  });

  it('escapes XML and disarms inline handlers', () => {
    const clean = escapeXml('<tag> "hi" & \'x\' onload="bad()"');
    assert.ok(!clean.includes('<tag>'));
    assert.ok(clean.includes('&lt;tag&gt;'));
    assert.ok(!clean.includes('onload='));
  });

  it('wraps and clips text to character budgets', () => {
    const lines = wrapText('one two three four five six seven', 10);
    assert.ok(lines.every(l => l.length <= 10));
    assert.equal(lines.join(' '), 'one two three four five six seven');
    assert.equal(clip('abcdefgh', 5), 'abcd…');
    assert.equal(clip('abc', 5), 'abc');
  });

  it('projects isometric points: +x goes right-down, +z goes up', () => {
    const [x0, y0] = iso(0, 0, 0);
    const [x1, y1] = iso(10, 0, 0);
    const [, yz] = iso(0, 0, 10);
    assert.ok(x1 > x0 && y1 > y0);
    assert.ok(yz < y0);
  });

  it('renders one leader per known callout and skips unknown parts', () => {
    const svg = buildCallouts(t, [
      { part: 'lid', text: 'lid: a' },
      { part: 'die', text: 'die: b' },
      { part: 'nope', text: 'x: c' }
    ]);
    assert.equal((svg.match(/class="pen"/g) || []).length, 2);
    assert.ok(!svg.includes('x: c'));
  });

  it('keeps leader lines from crossing', () => {
    const svg = buildCallouts(t, DEFAULT_CONFIG.callouts.concat({ part: 'ram', text: 'ram: 1 commits' }));
    const segs = [...svg.matchAll(/H([\d.]+)L([\d.]+) ([\d.]+)"/g)].map((m, i) => ({ y: i, ex: +m[1], ax: +m[2], ay: +m[3] }));
    // shared elbow column, anchor angles ascending with label order
    assert.equal(new Set(segs.map(s => s.ex)).size, 1);
    const angles = segs.map(s => Math.atan2(s.ay, s.ex - s.ax));
    for (let i = 1; i < angles.length; i++) assert.ok(angles[i] >= angles[i - 1] - 0.2);
  });

  it('marks live spec rows with a status dot', () => {
    const svg = buildSpecTable(t, [{ label: 'status', value: 'open', live: true }, { label: 'based', value: 'x' }]);
    assert.equal((svg.match(/<circle/g) || []).length, 1);
    assert.ok(svg.includes(t.live));
  });

  it('builds dark and light sheets with embedded fonts and no remote resources', () => {
    for (const theme of ['dark', 'light']) {
      const svg = buildProfileSvg(DEFAULT_CONFIG, { theme, commits: 652, date });
      const tk = tokensFor(theme);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.ok(svg.includes('viewBox="0 0 1180 586"'));
      assert.ok(svg.includes(`fill="${tk.bg}"`));
      assert.ok(svg.includes("font-family:'Archivo'"));
      assert.ok(svg.includes('data:font/woff2;base64,'));
      assert.ok(svg.includes('ram:</tspan> 652 commits in 52 weeks'));
      assert.ok(svg.includes(`rev ${revStamp(date)}`));
      assert.ok(!/(?:href|src)=["']https?:/.test(svg), 'no external fetches');
      assert.ok(svg.length < 120000, `size ${svg.length}`);
    }
  });

  it('escapes hostile config values', () => {
    const svg = buildProfileSvg({ ...DEFAULT_CONFIG, name: '<script>x</script>', specs: [{ label: 'a', value: '<img onerror=1>' }] }, { date });
    assert.ok(!svg.includes('<script>'));
    assert.ok(!svg.includes('<img'));
  });
});
