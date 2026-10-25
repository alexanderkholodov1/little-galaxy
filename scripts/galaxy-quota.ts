/** B1 scenario model; project-wide, not a per-galaxy or hostile-traffic guarantee. */
export function galaxyQuotaModel({ mutations = 600, genesisChunks = 14 } = {}) {
  const pages = Math.ceil(mutations / 64),
    meanPages = Math.ceil((pages + 1) / 2);
  const rows = [
    {
      name: `${mutations} accepted mutations, including 3% transaction retry reads`,
      reads: Math.ceil(mutations * (7 + 9) * 1.03),
      writes: mutations * 6,
    },
    {
      name: `300 joins: four metadata/dependency reads + ${meanPages} mean pages`,
      reads: 300 * (4 + meanPages),
      writes: 0,
    },
    {
      name: `125 reconnects: four metadata/dependency reads + ${pages} pages`,
      reads: 125 * (4 + pages),
      writes: 0,
    },
    {
      name: 'Hot page deliveries: TV and two mean foreground phones',
      reads: mutations * 3,
      writes: 0,
    },
    {
      name: `${genesisChunks} imported genesis chunks per join/reconnect`,
      reads: 425 * genesisChunks,
      writes: 0,
    },
    { name: 'Rare selection pointer listener bootstrap/resume', reads: 425, writes: 0 },
    { name: 'Private player inventory bootstrap/resume', reads: 425, writes: 0 },
    {
      name: '300 name/profile admissions and 100 five-minute activity samples',
      reads: 800,
      writes: 400,
    },
    { name: 'One bounded admin player-list read', reads: 300, writes: 0 },
    {
      name: 'Moon parents, page boundaries, switches and other operations reserve',
      reads: 300,
      writes: 100,
    },
  ];
  return {
    rows,
    reads: rows.reduce((n, r) => n + r.reads, 0),
    writes: rows.reduce((n, r) => n + r.writes, 0),
    readLimit: 25_000,
    writeLimit: 10_000,
  };
}
export function idleGalaxyQuotaModel(days = 7, leasedStands = false) {
  return {
    readsPerDay: 50 + (leasedStands ? 1932 : 0),
    writesPerDay: leasedStands ? 962 : 0,
    reads: days * (50 + (leasedStands ? 1932 : 0)),
    writes: days * (leasedStands ? 962 : 0),
  };
}
