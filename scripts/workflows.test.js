import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

it('runs the same fast local check in a single CI job, retaining rehearsal verdicts', async () => {
  const ci=await read('.github/workflows/ci.yml'), checks=await read('.github/workflows/checks.yml');
  expect(ci).toContain('preview:');expect(ci).toContain('needs: check');expect(ci).toContain('pull-requests: write');expect(ci).toContain('channelId: pr-${{ github.event.pull_request.number }}');expect(checks).toContain('name: galaxy-dist');expect(checks).toContain('playwright install --with-deps chromium');expect(checks).not.toContain('test:rules');
  expect(checks).toContain('run: pnpm check');expect(checks).toContain('verdict.json');expect(ci).toContain("branches: ['rehearsal/**']");
});

it('publishes alpha releases as prereleases then dispatches the exact tag to portfolio', async () => {
  const workflow = await read('.github/workflows/release.yml');
  expect(workflow).toContain('needs: [guard, build, candidate, deploy-rules]');
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
  expect(merge).toContain('run: node scripts/check-release-version.js --allocate');
  expect(merge).toContain("if: needs.tag.outputs.create == 'true'");
  expect(merge).toContain('uses: ./.github/workflows/release.yml');
  expect(merge).toContain('pull-requests: read');
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

it.each([['release-on-merge.yml', 'tag'], ['release.yml', 'guard']])(
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

});

it('disables data Hosting, preserves its auth helper and probes the admin after portfolio is live',async()=>{
 const workflow=await read('.github/workflows/release.yml');
 const deploy=workflow.split('\n  deploy-rules:')[1];
 expect(workflow).not.toContain('firebase deploy --only hosting');
 expect(deploy).toContain('firebase hosting:disable --site little-galaxy --project little-galaxy --force');
 expect(deploy).toContain('node scripts/verify-disabled-hosting.mjs');
 expect(deploy.indexOf('hosting:disable')).toBeLessThan(deploy.indexOf('src/index.ts release-sky'));
 const publish=workflow.split('\n  publish:')[1].split('\n  deploy-rules:')[0];
 expect(publish.indexOf('node scripts/verify-admin-release.mjs')).toBeGreaterThan(publish.indexOf('node scripts/verify-live-version.js'));
 expect(JSON.parse(await read('firebase.json'))).not.toHaveProperty('hosting');
});
it('selects a new-kernel sandbox only after its matching production client is live',async()=>{
 const workflow=await read('.github/workflows/release.yml');
 const publish=workflow.split('\n  publish:')[1].split('\n  deploy-rules:')[0];
 expect(publish.indexOf('Dispatch the exact')).toBeLessThan(publish.indexOf('Confirm the released commit'));
 expect(publish.indexOf('Confirm the released commit')).toBeLessThan(publish.indexOf('src/index.ts open-sandbox'));
 expect(publish).toContain('Remove sandbox credentials');
 expect(workflow.split('\n  deploy-rules:')[1]).not.toContain('open-sandbox');
});

it('gates rules and live publication on the exact candidate launch and always cleans before dropping credentials',async()=>{
 const workflow=await read('.github/workflows/release.yml');
 const candidate=workflow.split('\n  candidate:')[1].split('\n  publish:')[0];
 expect(candidate).toContain('node scripts/verify-preview-version.mjs');
 expect(candidate.indexOf('node scripts/verify-preview-version.mjs')).toBeLessThan(candidate.indexOf('pnpm accept:live'));
 expect(candidate).toContain('pnpm accept:live "$PREVIEW_URL"');expect(candidate).toContain('LIVE_PROBE_REPORT: .tmp/release-launch.json');
 expect(candidate).toContain("if: always() && steps.credentials.outcome == 'success'");
 expect(candidate.indexOf('scripts/cleanup-live-probe.mjs')).toBeLessThan(candidate.indexOf('Remove probe credentials'));
 expect(candidate).not.toContain('path: .tmp/live-launch-private.json');expect(candidate).not.toContain('open-sandbox');
 expect(candidate).not.toContain('pnpm run build');expect(candidate).toContain('sha256sum --check SHA256SUMS');
 expect(workflow.split('\n  deploy-rules:')[1]).toContain('needs: [guard, build, candidate]');
 expect(workflow.split('\n  publish:')[1]).toContain('needs: [guard, build, candidate, deploy-rules]');
});
