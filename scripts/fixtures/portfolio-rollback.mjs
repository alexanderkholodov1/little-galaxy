/**
 * Minimal fixture for portfolio rollback CLI dry-run contract.
 * Used when running standalone drills without a sibling portfolio checkout.
 */
export async function rollback(argv = [], { log = console.log } = {}) {
  const flags = argv.includes('--dry-run') ? { 'dry-run': true } : {};
  if (flags['dry-run']) {
    log('[dry-run] would require GOOGLE_APPLICATION_CREDENTIALS (outside the repository or in private/)');
    log('[dry-run] GET alexanderkholodov-web/live channel (current release) and its releases (all pages, ordered by releaseTime)');
    log('[dry-run] would show the live version and the previous version, then ask for the word "rollback" (or --yes)');
    log('[dry-run] POST live channel release with versionName = previous version');
    log('Hint: Run `pnpm run rollback -- --yes` to execute without confirmation.');
    return { dryRun: true };
  }
  return { aborted: true };
}
