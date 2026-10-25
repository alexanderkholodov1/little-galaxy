// Local-only, galaxy-scoped telemetry. No IP, device or cross-site identity.
export const METRICS_KEY = 'fogata.metrics.v1';
const day = n => new Date(n).toISOString().slice(0, 10);
export function track(event, data = {}) {
  if (!['visit','player_new','launch','toss','session_ping'].includes(event)) throw new Error('Unknown metric event');
  const db = JSON.parse(localStorage.getItem(METRICS_KEY) || '{"version":1,"galaxies":{}}');
  const selection = JSON.parse(localStorage.getItem('fogata.galaxies.v1') || '{}');
  const galaxyId = data.galaxyId || selection.activePublicGalaxyId || 'fogata';
  const at = data.at ?? Date.now();
  if (!Number.isFinite(at)) throw new Error('Invalid metric time');
  db.galaxies = Object.assign(Object.create(null), db.galaxies);
  const g = db.galaxies[galaxyId] ||= {days:{}, members:{}, sessions:{}};
  g.members = Object.assign(Object.create(null), g.members);
  g.sessions = Object.assign(Object.create(null), g.sessions);
  const id = data.memberId || data.playerId;
  const d = g.days[day(at)] ||= {visits:0, players:[], launches:0, types:{}, hours:Array(24).fill(0), tosses:0, kinds:{}, active:[], launchers:{}};
  d.types=Object.assign(Object.create(null),d.types); d.kinds=Object.assign(Object.create(null),d.kinds); d.launchers=Object.assign(Object.create(null),d.launchers);
  const add = (a, v) => { if(v && !a.includes(v)) a.push(v); };
  if (id) {
    const m = g.members[id] ||= {memberId:id, displayName:'', firstSeen:at, lastSeen:at, launches:0, registered:false};
    if (data.displayName !== undefined || data.byName !== undefined) m.displayName = Array.from(String(data.displayName ?? data.byName).trim()).slice(0,24).join('');
    m.firstSeen = Math.min(m.firstSeen, at); m.lastSeen = Math.max(m.lastSeen, at);
    add(d.active, id);
    if(event === 'player_new' && !m.registered) { m.registered = true; add(d.players, id); }
    if(event === 'launch') { m.launches++; d.launchers[id] = (d.launchers[id] || 0) + 1; }
  }
  if(event === 'visit') {
    // One visit per foreground session after 30 minutes of inactivity; max six/day/member.
    const s = id ? (g.sessions[id] ||= {last:0, day:day(at), count:0}) : null;
    if(s && s.day !== day(at)) { s.day=day(at); s.count=0; }
    if(!s || ((!s.last || at-s.last >= 1800000) && s.count < 6)) { d.visits++; if(s) s.count++; }
    if(s) s.last = Math.max(s.last, at);
  } else if(id && g.sessions[id]) g.sessions[id].last = Math.max(g.sessions[id].last, at);
  if(event === 'launch') { d.launches++; const type=String(data.type || data.kind || 'unknown'); d.types[type]=(d.types[type]||0)+1; d.hours[new Date(at).getUTCHours()]++; }
  if(event === 'toss') { d.tosses++; const kind=String(data.kind || 'unknown'); d.kinds[kind]=(d.kinds[kind]||0)+1; }
  // Opportunistic retention: keep aggregate days, discard granular day/session entries after 30 days.
  const cutoff=day(at-30*86400000);
  for(const value of Object.values(db.galaxies)) {
    for(const [date,bucket] of Object.entries(value.days)) if(date<cutoff) { bucket.active=[]; bucket.players=[]; bucket.launchers={}; }
    for(const [memberId,session] of Object.entries(value.sessions)) if(session.day<cutoff) delete value.sessions[memberId];
  }
  localStorage.setItem(METRICS_KEY, JSON.stringify(db));
}
export async function flush() { /* track persists synchronously; future transports batch here. */ }
export function aggregateMetrics(db, {from, to, galaxyId, now = Date.now()} = {}) {
  const start = from ? day(new Date(from).getTime()) : '0000';
  const end = to ? day(new Date(to).getTime()) : day(now);
  const out = {visits:0, players:0, named:0, anonymous:0, activeNow:0, activeToday:0, activeWeek:0, launches:0, tosses:0, types:{}, hours:Array(24).fill(0), topLaunchers:[], members:[], sparkline:[], busiestHour:null};
  const daily={}, tops=Object.create(null), today=new Set(), week=new Set();
  for(const [gid,g] of Object.entries(db.galaxies || {})) {
    if(galaxyId && gid!==galaxyId) continue;
    for(const m of Object.values(g.members)) {
      const record={...m, galaxyId:gid, active:m.lastSeen<=now && m.lastSeen>=now-300000};
      out.members.push(record);
      if(m.registered) { out.players++; m.displayName ? out.named++ : out.anonymous++; }
      if(record.active) out.activeNow++;
    }
    for(const [date,d] of Object.entries(g.days)) {
      if(date===day(now)) for(const id of d.active) today.add(gid+':'+id);
      if(date>=day(now-6*86400000) && date<=day(now)) for(const id of d.active) week.add(gid+':'+id);
      daily[date]=(daily[date]||0)+d.launches;
      if(date<start || date>end) continue;
      out.visits+=d.visits; out.launches+=d.launches; out.tosses+=d.tosses;
      for(const [k,v] of Object.entries(d.types)) Object.defineProperty(out.types,k,{value:(Object.hasOwn(out.types,k)?out.types[k]:0)+v,writable:true,enumerable:true,configurable:true});
      d.hours.forEach((v,i)=>out.hours[i]+=v);
      for(const [id,v] of Object.entries(d.launchers)) {
        const name=g.members[id]?.displayName || '';
        tops[name]=(tops[name]||0)+v;
      }
    }
  }
  out.activeToday=today.size; out.activeWeek=week.size;
  out.topLaunchers=Object.entries(tops).map(([displayName,count])=>({displayName,count})).sort((a,b)=>b.count-a.count);
  out.busiestHour=out.launches ? out.hours.indexOf(Math.max(...out.hours)) : null;
  for(let i=13;i>=0;i--) { const date=day(now-i*86400000); out.sparkline.push({date,count:daily[date]||0}); }
  return out;
}
