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
  expect(workflow).toContain('needs: [guard, build, deploy-rules]');
  expect(workflow).toContain('options+=(--prerelease --latest=false)');
  expect(workflow).toContain('--arg tag "$RELEASE_TAG"');
  expect(workflow).toContain('{event_type: "galaxy-release", client_payload: {tag: $tag}}');
  expect(workflow).toContain('repos/alexanderkholodov1/portfolio/dispatches');
  expect(workflow).toContain('GH_TOKEN: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}');
  expect(workflow.indexOf('gh release create')).toBeLessThan(workflow.indexOf('portfolio/dispatches'));
});

it('releases token-created tags through the reusable workflow and preserves external tag pushes', async () => {
  const merge = await read('.github/workflows/release-on-merge.yml');
  const release = await read('.github/workflows/release.yml');
  expect(merge).toContain('branches: [main]');
  expect(merge).toContain('run: node scripts/verify-release.js --plan');
  expect(merge).toContain("if: needs.tag.outputs.create == 'true'");
  expect(merge).toContain('uses: ./.github/workflows/release.yml');
  expect(merge).toContain('-f "sha=$GITHUB_SHA"');
  expect(release).toContain("tags: ['v*']");
  expect(release).toContain('workflow_call:');
  expect(release).toContain('ref: ${{ needs.guard.outputs.commit }}');
  expect(release).not.toContain('$GITHUB_REF_NAME');
});
it('serializes reviewed sky operations and always recovers flags before removing credentials', async () => {
  const release = await read('.github/workflows/release.yml');
  const controls = await read('.github/workflows/operate-sky.yml');
  for (const workflow of [release, controls]) {
    expect(workflow).toContain('environment: little-galaxy-rules');
    expect(workflow).toContain('group: galaxy-sky-admin');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('if: always()');
  }
  expect(release).toContain('src/index.ts release-sky');
  expect(release).toContain('src/index.ts restore-season');
  expect(release).toContain('SEASON RESTORATION FAILED');
  expect(release.indexOf('src/index.ts restore-season')).toBeLessThan(release.indexOf('rm -f'));
  expect(controls).toContain("if: github.ref == 'refs/heads/main'");
  expect(controls).toContain('SKY_KEY: ${{ inputs.key }}');
  expect(controls).toContain('src/index.ts github-control');
});
