// Fail closed before transmission. Firestore uses POST for reads/listens as well as writes.
export function isReadOnlyRequest(method, address) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  const url = new URL(address);
  return method === 'POST' && url.hostname === 'firestore.googleapis.com' &&
    (/\/google\.firestore\.v1\.Firestore\/Listen\/channel$/.test(url.pathname) ||
     /\/documents:(batchGet|runQuery|runAggregationQuery)$/.test(url.pathname));
}
export async function installReadOnlyRoutes(context) {
  const blocked = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (isReadOnlyRequest(request.method(), request.url())) await route.continue();
    else { blocked.push(`${request.method()} ${new URL(request.url()).pathname}`); await route.abort('blockedbyclient'); }
  });
  return blocked;
}
