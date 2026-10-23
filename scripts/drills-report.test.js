import { describe, expect, it } from 'vitest';
import { generateDrillsMarkdown } from './drills.ts';
import { rollback } from './fixtures/portfolio-rollback.mjs';

describe('drills reporting and fixtures', () => {
  it('generates markdown with passed and failed counts', () => {
    const md = generateDrillsMarkdown([
      {
        drillId: 'DRILL-01',
        name: 'Orbit determinism',
        status: 'PASSED',
        observedBehavior: 'Deterministic coordinates computed.',
        details: {},
      },
      {
        drillId: 'DRILL-05',
        name: 'Rollback dry-run',
        status: 'PASSED',
        observedBehavior: 'Dry-run logged 5 steps using vendored rollback fixture.',
        details: { isFixture: true },
      },
    ]);

    expect(md).toContain('2 passed, 0 failed');
    expect(md).toContain('DRILL-01');
    expect(md).toContain('DRILL-05');
    expect(md).toContain('vendored rollback fixture');
  });

  it('vendored rollback fixture satisfies the rollback CLI contract', async () => {
    const logs = [];
    const res = await rollback(['--dry-run'], { log: (msg) => logs.push(msg) });
    expect(res.dryRun).toBe(true);
    expect(logs.some((l) => l.includes('POST live channel release'))).toBe(true);
  });
});
