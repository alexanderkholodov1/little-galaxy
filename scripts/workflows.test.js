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
  expect(merge).toContain('run: node scripts/check-release-version.js');
  expect(merge).toContain("if: needs.tag.outputs.create == 'true'");
  expect(merge).toContain('uses: ./.github/workflows/release.yml');
  expect(merge).toContain('-f "sha=$GITHUB_SHA"');
  expect(release).toContain("tags: ['v*']");
  expect(release).toContain('workflow_call:');
  expect(release).toContain('ref: ${{ needs.guard.outputs.commit }}');
  expect(release).not.toContain('$GITHUB_REF_NAME');
});
it('protects reviewed controls and cleans credentials even after failure', async () => {
  const release = await read('.github/workflows/release.yml');
  const controls = await read('.github/workflows/operate-sky.yml');
  for (const workflow of [release, controls]) {
    expect(workflow).toContain('environment: little-galaxy-rules');
    expect(workflow).toContain('if: always()');
  }
  expect(controls).toContain("if: github.ref == 'refs/heads/main'");
  expect(controls).toContain('SKY_KEY: ${{ inputs.key }}');
  expect(controls).toContain('src/index.ts github-control');
});

it.each([['ci.yml', 'release-version'], ['release-on-merge.yml', 'tag'], ['release.yml', 'guard']])(
  '%s fetches tags explicitly for its %s job', async (file, job) => {
    const workflow = await read('.github/workflows/' + file);
    const body = workflow.split('\n  ' + job + ':\n')[1].split(/\n {2}[a-z-]+:\n/u)[0];
    const checkout = body.split('uses: actions/checkout@')[1].split('\n      - ')[0];
    expect(checkout).toContain('fetch-depth: 0');
    expect(checkout).toContain('fetch-tags: true');
  },
);

it('passes the release tag through Turbo to Vite and confirms production with the same tag', async () => {
  const release = await read('.github/workflows/release.yml');
  expect(release.match(/RELEASE_TAG: \$\{\{ needs.guard.outputs.tag \}\}/gu).length).toBeGreaterThanOrEqual(7);
  expect(JSON.parse(await read('turbo.json')).tasks.build.env).toContain('RELEASE_TAG');
  expect(await read('.github/workflows/ci.yml')).toContain('node scripts/check-release-version.js --preview');
});
