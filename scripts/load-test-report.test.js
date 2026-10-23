import { describe, expect, it } from 'vitest';
import { generateQuotaReportMarkdown } from './load-test.ts';

describe('generateQuotaReportMarkdown', () => {
  it('renders FAIL statuses from budget booleans and reports failures', () => {
    const md = generateQuotaReportMarkdown({
      transactionAttempts: 700,
      commitRequests: 700,
      projections: [],
      totalVisitors: 100,
      successfulVisitors: 0,
      failedVisitors: 100,
      totalDurationMs: 1000,
      writes: {
        total: 0,
        objectWrites: 0,
        userWrites: 0,
        eventWrites: 0,
        standSnapshotWrites: 0,
        standMemoryWrites: 0,
        standMeteorWrites: 0,
        perVisitorAvg: 21,
        perVisitorBreakdown: 'test',
      },
      reads: {
        total: 0,
        phoneTransactionReads: 0,
        screenObjectReads: 0,
        screenEventReads: 0,
        standReads: 0,
        rulesReads: 0,
        perVisitorAvg: 24,
      },
      budgetValidation: {
        dailyWriteLimit: 20000,
        dailyReadLimit: 50000,
        fairDayProjectedWrites300: 25000,
        fairDayProjectedReads300: 60000,
        writeBudgetPass: false,
        readBudgetPass: false,
      },
    });

    expect(md).toContain('100 failed');
    expect(md).toMatch(/\|\s*\*\*Writes\*\*.*\*\*FAIL\*\*/);
    expect(md).toMatch(/\|\s*\*\*Reads\*\*.*\*\*FAIL\*\*/);
    expect(md).not.toMatch(/\|\s*\*\*Writes\*\*.*\*\*PASS\*\*/);
    expect(md).toContain('25,000');
    expect(md).toContain('Pacific time');
  });

  it('renders PASS when budgets succeed and all visitors complete', () => {
    const md = generateQuotaReportMarkdown({
      transactionAttempts: 700,
      commitRequests: 700,
      projections: [],
      totalVisitors: 100,
      successfulVisitors: 100,
      failedVisitors: 0,
      totalDurationMs: 5000,
      writes: {
        total: 2100,
        objectWrites: 200,
        userWrites: 100,
        eventWrites: 1000,
        standSnapshotWrites: 2,
        standMemoryWrites: 5,
        standMeteorWrites: 0,
        perVisitorAvg: 21,
        perVisitorBreakdown: 'launch1: 4, edit: 3, … = 21',
      },
      reads: {
        total: 4000,
        phoneTransactionReads: 1600,
        screenObjectReads: 200,
        screenEventReads: 100,
        standReads: 50,
        rulesReads: 800,
        perVisitorAvg: 24,
      },
      budgetValidation: {
        dailyWriteLimit: 20000,
        dailyReadLimit: 50000,
        fairDayProjectedWrites300: 7292,
        fairDayProjectedReads300: 12424,
        writeBudgetPass: true,
        readBudgetPass: true,
      },
    });

    expect(md).toContain('All completed');
    expect(md).toMatch(/\|\s*\*\*Writes\*\*.*\*\*PASS\*\*/);
    expect(md).toMatch(/\|\s*\*\*Reads\*\*.*\*\*PASS\*\*/);
  });
});
