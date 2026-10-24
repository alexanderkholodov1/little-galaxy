import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

it('hands the preview credential only to the locked firebase-tools version', async () => {
  const locked = (await read('pnpm-lock.yaml')).match(/^ {2}firebase-tools@(\d+\.\d+\.\d+):\r?$/mu)?.[1];
  const pinned = (await read('.github/workflows/ci.yml')).match(/^ +firebaseToolsVersion: (\d+\.\d+\.\d+)\r?$/mu)?.[1];
  expect(locked).toMatch(/^\d+\.\d+\.\d+$/u);
  expect(pinned).toBe(locked);
});

it('publishes alpha releases as prereleases then dispatches the exact tag to portfolio', async () => {
  const workflow = await read('.github/workflows/release.yml');
  expect(workflow).toContain('needs: [build, deploy-rules]');
  expect(workflow).toContain('options+=(--prerelease --latest=false)');
  expect(workflow).toContain('--arg tag "$GITHUB_REF_NAME"');
  expect(workflow).toContain('{event_type: "galaxy-release", client_payload: {tag: $tag}}');
  expect(workflow).toContain('repos/alexanderkholodov1/portfolio/dispatches');
  expect(workflow).toContain('GH_TOKEN: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}');
  expect(workflow.indexOf('gh release create')).toBeLessThan(workflow.indexOf('portfolio/dispatches'));
});
