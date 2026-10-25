/** P2 operating envelope: 300 visitors, 125 resumes, 100 replay readers, one keeper and one TV. */
export function galaxyQuotaModel({ mutations = 400, genesisChunks = 11, certifiedGalaxies = 1, keeperHours = 12 } = {}) {
  const pages = Math.ceil(mutations / 64), meanPages = Math.ceil((pages + 1) / 2);
  // Ten-minute runs, each per certified galaxy: manifest + open log page reads, then one commit of
  // certification + pointer whose rules read the allowlist, head and the new certification.
  const runs = keeperHours * 6 * certifiedGalaxies;
  const rows = [
    {name:`${mutations} accepted mutations; 18 explicit/dependency reads plus 3% retries`,reads:Math.ceil(mutations*18*1.03),writes:mutations*6},
    // Clock config, selection, manifest, head, private member, unsigned cache probe,
    // certification pointer and current live-page bootstrap. Pages/genesis are additional.
    {name:`300 joins: 8 metadata/listener reads + ${meanPages} pages + ${genesisChunks} genesis chunks`,reads:300*(8+meanPages+genesisChunks),writes:0},
    {name:`125 resumes: 8 metadata/listener reads + ${pages} pages + ${genesisChunks} genesis chunks`,reads:125*(8+pages+genesisChunks),writes:0},
    {name:'Hot page deliveries: one TV + two mean foreground phones',reads:mutations*3,writes:0},
    {name:'300 name/profile admissions + 100 five-minute foreground samples',reads:800,writes:400},
    // Replay readers have no membership/checkpoint/live-page read: they need the complete history.
    {name:`100 timelapse readers: config, selection, manifest, head + ${pages} pages + ${genesisChunks} genesis chunks`,reads:100*(4+pages+genesisChunks),writes:0},
    {name:'Two booth cold starts: seven public metadata/listener reads + complete history',reads:2*(7+pages+genesisChunks),writes:0},
    {name:'Keeper login, three galaxy cards, player dashboard and two explicit refreshes',reads:1100,writes:0},
    {name:`Keeper page open ${keeperHours} h: automatic certification every 10 min of ${certifiedGalaxies} galaxy(ies), 5 reads per run + 25-read bootstrap each`,reads:runs*5+25*certifiedGalaxies,writes:runs*2},
    {name:'Ten admin operations/exports, certifications, parents, retries and other reserve',reads:500,writes:100},
  ];
  return {rows,reads:rows.reduce((n,r)=>n+r.reads,0),writes:rows.reduce((n,r)=>n+r.writes,0),readLimit:25000,writeLimit:10000};
}
export function idleGalaxyQuotaModel(days = 7, leasedStands = false) {
  return {readsPerDay:50+(leasedStands?1932:0),writesPerDay:leasedStands?962:0,
    reads:days*(50+(leasedStands?1932:0)),writes:days*(leasedStands?962:0)};
}
/** Preserve 1,000 reads of margin under half the daily ceiling, and 300 first contributions. */
export function fairMutationLimit(genesisChunks: number) {
  return [600,550,500,450,400,350,300].find(mutations=>{
    const model=galaxyQuotaModel({mutations,genesisChunks});
    return model.reads<model.readLimit-1000&&model.writes<model.writeLimit;
  })??null;
}
