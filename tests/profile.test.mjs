import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  loadProfileConfig,
  escapeXml,
  buildInfoLines,
  renderTerminalLines,
  renderAvatarHud,
  buildProfileSvg
} from '../profile.mjs';

describe('Profile System & Central Config Suite', () => {

  describe('Configuration Loading & Sanitization', () => {
    it('should fallback gracefully to DEFAULT_CONFIG if file does not exist', () => {
      const config = loadProfileConfig('nonexistent-config.json');
      assert.strictEqual(config.username, DEFAULT_CONFIG.username);
      assert.strictEqual(config.name, DEFAULT_CONFIG.name);
      assert.ok(typeof config.skills === 'object');
    });

    it('should correctly escape special XML/SVG characters', () => {
      const dirty = '<tag> "hello" & \'world\' onload="bad()"';
      const clean = escapeXml(dirty);
      assert.strictEqual(clean.includes('<tag>'), false);
      assert.strictEqual(clean.includes('&lt;tag&gt;'), true);
      assert.strictEqual(clean.includes('&amp;'), true);
      assert.strictEqual(clean.includes('onload='), false);
    });
  });

  describe('Dynamic Terminal Lines Builder', () => {
    it('should map config fields into structured terminal key-value pairs', () => {
      const customConfig = {
        username: 'octocat',
        name: 'Mona Lisa',
        commandTitle: 'mona@terminal ~ % ./profile.sh',
        role: 'Chief Mascot',
        education: 'GitHub University',
        status: 'Shipping code',
        skills: {
          'Languages': 'JavaScript, Ruby',
          'Database': 'PostgreSQL'
        },
        contacts: {
          'Website': 'github.com'
        }
      };

      const lines = buildInfoLines(customConfig);
      assert.ok(lines.length > 5);

      const subjectLine = lines.find(l => l.key === 'Subject');
      assert.strictEqual(subjectLine.value, 'Mona Lisa');

      const roleLine = lines.find(l => l.key === 'Role');
      assert.strictEqual(roleLine.value, 'Chief Mascot');

      const langLine = lines.find(l => l.key === 'Languages');
      assert.strictEqual(langLine.value, 'JavaScript, Ruby');
    });

    it('should render clip-paths and animated text elements for dark & light themes', () => {
      const lines = buildInfoLines(DEFAULT_CONFIG);
      const darkRender = renderTerminalLines(lines, 'dark');
      assert.ok(darkRender.clipPaths.includes('<clipPath id="lc0">'));
      assert.ok(darkRender.textElements.includes('<tspan'));
      assert.ok(darkRender.cursorElement.includes('cursor-blink'));

      const lightRender = renderTerminalLines(lines, 'light');
      assert.ok(lightRender.clipPaths.includes('<clipPath id="lc0">'));
      assert.ok(lightRender.textElements.includes('fill="#1E293B"'));
    });
  });

  describe('Biometric Avatar HUD & Profile SVG Rendering', () => {
    it('should generate holographic avatar HUD with custom badges and image target', () => {
      const hudSvg = renderAvatarHud(DEFAULT_CONFIG, 'data:image/png;base64,TEST_DATA', 'dark');
      assert.ok(hudSvg.includes('<image'));
      assert.ok(hudSvg.includes('data:image/png;base64,TEST_DATA'));
      assert.ok(hudSvg.includes('AVATAR.HUD // BIOMETRIC') || hudSvg.includes('IDENT: @'));
      assert.ok(hudSvg.includes('PILOT // ONLINE'));
    });

    it('should fallback to GitHub avatar URL if data URI is not provided', () => {
      const hudSvg = renderAvatarHud(DEFAULT_CONFIG, '', 'dark');
      assert.ok(hudSvg.includes('avatars.githubusercontent.com'));
    });

    it('should compile valid dark and light SVGs with correct dimensions and theme tokens', () => {
      const darkSvg = buildProfileSvg(DEFAULT_CONFIG, { theme: 'dark' });
      assert.ok(darkSvg.startsWith('<svg'));
      assert.ok(darkSvg.endsWith('</svg>'));
      assert.ok(darkSvg.includes('width="1180"'));
      assert.ok(darkSvg.includes('height="586"'));
      assert.ok(darkSvg.includes('#0B1120'));

      const lightSvg = buildProfileSvg(DEFAULT_CONFIG, { theme: 'light' });
      assert.ok(lightSvg.startsWith('<svg'));
      assert.ok(lightSvg.endsWith('</svg>'));
      assert.ok(lightSvg.includes('#FFFFFF') || lightSvg.includes('#F8FAFC'));
    });
  });

});
