import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeText,
  buildCells,
  buildSvg,
  generateMockWeeks,
  parsePublicContributionCalendar,
  computeStats,
  longestStreak,
  weeklyTotals,
  buildTracePath,
  buildMonthLabels,
  COLS,
  ROWS,
  LEVEL_ALPHA
} from '../generate.mjs';
import { tokensFor } from '../sheet.mjs';

const date = new Date('2026-11-25T00:00:00Z');

describe('contribution sheet 02', () => {
  it('sanitizes markup and inline handlers', () => {
    const s = sanitizeText('<svg onload="x">&');
    assert.ok(!s.includes('<svg'));
    assert.ok(!s.includes('onload='));
  });

  it('computes totals from weeks and from cells', () => {
    const weeks = [{ contributionDays: [{ contributionCount: 2 }, { contributionCount: 0 }, { contributionCount: 5 }] }];
    assert.deepEqual(computeStats(weeks), { total: 7, activeDays: 2, maxDay: 5 });
    assert.deepEqual(computeStats([{ count: 3 }, { count: 0 }]), { total: 3, activeDays: 1, maxDay: 3 });
  });

  it('parses the public graph with dates, counts and levels', () => {
    let html = '';
    const start = new Date('2025-11-23T00:00:00Z');
    for (let i = 0; i < 364; i++) {
      const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const n = i % 5;
      html += `<td role="gridcell" data-date="${ds}" id="c${i}" data-level="${Math.min(n, 4)}"></td><tool-tip for="c${i}">${n ? `${n} contributions` : 'No contributions'} on ${ds}</tool-tip>`;
    }
    const weeks = parsePublicContributionCalendar(html);
    assert.equal(weeks.length, 52);
    assert.equal(weeks[0].contributionDays[1].contributionCount, 1);
    assert.equal(weeks[0].contributionDays[1].level, 1);
  });

  it('rejects incomplete calendars', () => {
    assert.throws(() => parsePublicContributionCalendar('<td role="gridcell"></td>'), /incomplete/);
  });

  it('builds a 53x7 grid and derives levels when GitHub gives none', () => {
    const weeks = [{ contributionDays: [{ contributionCount: 10, date: '2026-11-22' }, { contributionCount: 1, date: '2026-11-23' }] }];
    const cells = buildCells(weeks);
    assert.equal(cells.length, COLS * ROWS);
    const last = cells.filter(c => c.col === COLS - 1);
    assert.equal(last[0].level, 4);
    assert.equal(last[1].level, 1);
    assert.equal(last[2].level, 0);
  });

  it('maps GraphQL contributionLevel enums', () => {
    const cells = buildCells([{ contributionDays: [{ contributionCount: 1, contributionLevel: 'THIRD_QUARTILE', date: '2026-11-22' }] }]);
    assert.equal(cells.find(c => c.col === COLS - 1 && c.row === 0).level, 3);
  });

  it('finds the longest run of active days', () => {
    const cells = ['01', '02', '03', '05', '06'].map((d, i) => ({ date: `2026-01-${d}`, count: 1, col: 0, row: i }))
      .concat([{ date: '2026-01-04', count: 0, col: 0, row: 6 }]);
    assert.equal(longestStreak(cells), 3);
  });

  it('sums weeks and draws a stepped trace across the grid', () => {
    const cells = buildCells(generateMockWeeks(COLS, date));
    const totals = weeklyTotals(cells);
    assert.equal(totals.length, COLS);
    assert.equal(totals.reduce((a, b) => a + b, 0), computeStats(cells).total);
    const d = buildTracePath(totals);
    assert.ok(d.startsWith('M'));
    assert.equal((d.match(/V/g) || []).length, COLS - 1);
  });

  it('labels about a year of months', () => {
    const svg = buildMonthLabels(buildCells(generateMockWeeks(COLS, date)), tokensFor('dark'));
    const n = (svg.match(/<text /g) || []).length;
    assert.ok(n >= 10 && n <= 13, `got ${n}`);
  });

  it('renders dark and light sheets with stats, grid, trace and title block', () => {
    for (const theme of ['dark', 'light']) {
      const svg = buildSvg([], { mock: true, theme, date });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.ok(svg.includes('viewBox="0 0 1180 420"'));
      assert.ok(svg.includes(`fill="${tokensFor(theme).bg}"`));
      assert.ok(svg.includes('id="contribution-blocks"'));
      assert.ok(svg.includes('id="signal-trace"'));
      assert.ok(svg.includes('<animateMotion'));
      assert.ok(svg.includes('longest streak'));
      assert.ok(svg.includes('updated 2026-11-25'));
      assert.ok(svg.includes(`fill-opacity="${LEVEL_ALPHA[4]}"`));
    }
  });
});
