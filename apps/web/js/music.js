// Fogata: an endless, seeded score. No DOM or AudioContext is needed by compose().
export const PIECES = Object.freeze([
  {id:'embers', name:{es:'Brasas lentas', en:'Slow embers'}, bpm:48, minutes:5, metre:4},
  {id:'steps', name:{es:'Pasitos de madera', en:'Little wooden steps'}, bpm:76, minutes:6, metre:4},
  {id:'cradle', name:{es:'Cuna en órbita', en:'Orbiting cradle'}, bpm:60, minutes:5.5, metre:3},
  {id:'air', name:{es:'Vidrio y aliento', en:'Glass and breath'}, bpm:0, minutes:5, metre:0},
  {id:'hearth', name:{es:'Pulso de hogar', en:'Hearth pulse'}, bpm:68, minutes:6.5, metre:4},
].map(p => Object.freeze({...p, name:Object.freeze(p.name)})));
const FADE = 8, AHEAD = 1.5, TICK = 200;
const CHORDS = [[-5,-2,0,2,3],[-6,-1,0,2,3],[-4,-1,0,3,6],[-7,-4,-1,2,3]];
const SECTIONS = ['kindle','wander','shimmer','home'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function random(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function mix(seed, a, b=0) { return (Math.imul(seed ^ 0x9e3779b9, 1664525) ^ Math.imul(a+1, 1013904223) ^ Math.imul(b+1, 2246822519)) >>> 0; }
function score(seed) {
  const rng = random(seed), recent = []; let bag = [], index=0, start=0;
  return () => {
    let id;
    if(!index) id='embers';
    else {
      if(!bag.length) bag=PIECES.map(p=>p.id).filter(id=>index!==1 || id!=='embers');
      const choices=bag.filter(id=>!recent.slice(-2).includes(id));
      // A remaining bag item can be one of the last two at a bag boundary. Pick from
      // the other pieces in that case and leave it for a later turn.
      const pool=choices.length ? choices : PIECES.map(p=>p.id).filter(id=>!recent.slice(-2).includes(id));
      id=pool[Math.floor(rng()*pool.length)];
      const at=bag.indexOf(id); if(at>=0) bag.splice(at,1);
    }
    const p=PIECES.find(p=>p.id===id), visit={...p, index, start, end:start+p.minutes*60, seed:mix(seed,index)};
    start=visit.end-FADE; index++; recent.push(id); if(recent.length>2) recent.shift();
    return visit;
  };
}
const barLength = p => p.bpm ? 60/p.bpm*p.metre : 8;
const sectionAt = (p,t) => SECTIONS[Math.min(3,Math.floor(Math.max(0,t-p.start)/(p.minutes*60)*4))];
function phraseEvents(p, bar) {
  const length=barLength(p), offset=bar*length, rng=random(mix(p.seed,bar));
  const section=Math.min(3, Math.floor(offset/(p.minutes*60)*4));
  const lift=[.82,1,1.1,.88][section], beat=p.bpm ? 60/p.bpm : 1;
  const root=CHORDS[(Math.floor(bar/(p.id==='embers'?2:4))+Math.floor(rng()*2))%4];
  const events=[];
  function add(instrument, pos, degree, gain, duration, attack=.012) {
    // Every phrase has new pitch/rhythm decisions, microtiming, articulation and
    // dynamics. Humanisation is seeded, never read from wall time or Math.random.
    const time=p.start+offset+pos+(pos===0 ? 0 : rng()*.026);
    if(time>=p.end-.06) return;
    events.push({time, instrument, degree, gain:gain*lift*(.88+rng()*.24), duration,
      attack:Math.max(.008,attack), piece:p.id, visit:p.index, section:SECTIONS[section],
      bar, pan:(rng()-.5)*.65});
  }
  function pad(duration, gain=.037) {
    root.forEach((deg,i)=>add('pad', i*.021, deg, gain*(i===0?1:.47), duration, 3.2));
  }
  if(p.id==='embers') {
    // The inherited five-note, ±6-cent pad and drifting upper-register kalimba.
    if(bar%2===0) pad(length*2+2);
    let degree=5+Math.floor(rng()*7);
    const n=section===0?2:3+Math.floor(rng()*3);
    for(let i=0;i<n;i++) { degree=clamp(degree+[-2,-1,1,2][Math.floor(rng()*4)],5,13); add('kalimba',.7+i*(.42+rng()*.55),degree,.045,1.4); }
  } else if(p.id==='steps') {
    if(bar%4===0) pad(length*4+1,.031);
    const motif=[0,2,3,5,3,2,4,2], rotate=Math.floor(rng()*5), base=root[0]+5;
    for(let i=0;i<8;i++) if(i===0 || rng()>.13) add('kalimba',(i*.5+(i%2?.045:0))*beat,base+motif[(i+rotate)%8]+(rng()<.17?5:0),i%2?.043:.052,.75+rng()*.4);
    if(bar%2===1) add('bell',(2+rng())*beat,8+Math.floor(rng()*5),.026,2.3);
  } else if(p.id==='cradle') {
    if(bar%4===0) pad(length*4+1,.033);
    add('kalimba',0,root[0]+5,.058,1.6);
    add('kalimba',beat,root[2]+5+Math.floor(rng()*2),.041,1.5);
    add('kalimba',2*beat,root[3]+5+Math.floor(rng()*2),.038,1.6);
    if(rng()>.28) add('bell',(1.5+rng())*beat,7+Math.floor(rng()*6),.030,2.7);
  } else if(p.id==='air') {
    // Eight-second bookkeeping cells, no audible pulse or recurring metre.
    if(bar%2===0) pad(19,.042);
    add('breath',rng()*2,null,.040,4+rng()*2,1.3);
    add('bell',.3+rng()*2,5+Math.floor(rng()*9),.060,4+rng()*2);
    add('bell',4+rng()*2,7+Math.floor(rng()*7),.046,3+rng()*3);
  } else {
    if(bar%4===0) pad(length*4+1,.029);
    add('thump',0,-10,.095,.65,.018);
    add('thump',2*beat,-10+(rng()<.3?3:0),.070,.6,.018);
    for(let i=0;i<4;i++) add('brush',(i+.5)*beat,null,i%2?.044:.031,.25+rng()*.12,.035);
    for(let i=0;i<4;i++) if(i===0 || rng()>.23) add('kalimba',(i+.25+(i%2?.10:0))*beat,root[1]+5+Math.floor(rng()*5),.046,1.05);
    if(section===2) add('bell',3.5*beat,10+Math.floor(rng()*4),.025,2);
  }
  return events;
}
function rangeEvents(p, from, to) {
  const length=barLength(p), events=[];
  for(let b=Math.max(0,Math.floor((from-p.start)/length)-1); b*length<p.minutes*60 && p.start+b*length<to; b++) {
    for(const e of phraseEvents(p,b)) if(e.time>=from && e.time<to) events.push(e);
  }
  return events.sort((a,b)=>a.time-b.time);
}
/** Pure deterministic event list; seconds is score time, starting at zero. */
export function compose(seed, seconds) {
  if(!Number.isFinite(seconds) || seconds<0) throw new RangeError('seconds must be finite and non-negative');
  const next=score(seed>>>0), events=[];
  for(let p=next(); p.start<seconds; p=next()) events.push(...rangeEvents(p,0,seconds));
  return events.sort((a,b)=>a.time-b.time || a.visit-b.visit);
}

/** Shared renderer used by the live player and the offline listening checks.
 * The core instruments mirror audio.js, with explicit lifetime cleanup, a 4 kHz
 * ceiling and all attacks >= 8 ms. Routing is post-fader to ONE env.verb.
 */
export function createMusicRenderer(env) {
  const {ctx}=env, active=new Set(); let noiseBuffer;
  function voice(e, when, bus, freq, gain, duration, attack, type='sine', cutoff=2600, detune=0) {
    const source=ctx.createOscillator(); source.type=type; source.frequency.value=freq; source.detune.value=detune;
    const filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=Math.min(4000,cutoff); filter.Q.value=.4;
    const amp=ctx.createGain(), t=when, a=Math.max(.008,attack);
    amp.gain.setValueAtTime(0,t); amp.gain.linearRampToValueAtTime(gain,t+a);
    if(e.instrument==='pad') { amp.gain.setValueAtTime(gain,t+Math.max(a,duration-1)); amp.gain.linearRampToValueAtTime(0,t+duration+3); }
    else amp.gain.exponentialRampToValueAtTime(.00001,t+a+duration);
    source.connect(filter); filter.connect(amp); amp.connect(bus);
    track(source,[filter,amp],when,t+(e.instrument==='pad'?duration+3:a+duration)+.05);
  }
  function track(source,nodes,when,end) {
    const item={source,nodes,end}; active.add(item);
    source.onended=()=>{source.disconnect(); for(const n of nodes)n.disconnect(); active.delete(item);};
    source.start(when); source.stop(end);
  }
  function play(e,when,bus=env.out) {
    const f=e.degree===null?0:env.hz(e.degree), g=e.gain, d=e.duration, a=e.attack;
    if(e.instrument==='pad') {
      for(const det of [-6,6]) voice(e,when,bus,f,g*.64,d,a,e.degree< -3?'sine':'triangle',e.degree< -3?760:1100,det);
    } else if(e.instrument==='kalimba') {
      voice(e,when,bus,f,g,d,a,'sine',3200);
      voice(e,when,bus,f*3,g*.22,d*.18,.008,'sine',4000);
      voice(e,when,bus,f*2,g*.35,.06,.008,'triangle',3800);
    } else if(e.instrument==='bell') {
      voice(e,when,bus,f,g,d,.010,'sine',4000);
      voice(e,when,bus,f*2,g*.4,d*.6,.010,'sine',4000,4);
      voice(e,when,bus,f*3,g*.18,d*.3,.010,'sine',4000,-5);
    } else if(e.instrument==='thump') voice(e,when,bus,f,g,d,a,'sine',350);
    else {
      if(!noiseBuffer) {
        noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
        const data=noiseBuffer.getChannelData(0), rng=random(0xBEE5);
        for(let i=0;i<data.length;i++) data[i]=rng()*2-1;
      }
      const source=ctx.createBufferSource(); source.buffer=noiseBuffer; source.loop=true;
      const filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.Q.value=.5;
      filter.frequency.setValueAtTime(e.instrument==='brush'?1900:1200,when);
      filter.frequency.exponentialRampToValueAtTime(e.instrument==='brush'?700:350,when+d);
      const amp=ctx.createGain(); amp.gain.setValueAtTime(0,when); amp.gain.linearRampToValueAtTime(g,when+a);
      amp.gain.exponentialRampToValueAtTime(.00001,when+Math.max(d,a+.01));
      source.connect(filter); filter.connect(amp); amp.connect(bus);
      track(source,[filter,amp],when,when+d+.05);
    }
  }
  return {play, active:()=>active.size,
    stopAfter(time=ctx.currentTime) { for(const item of active) if(item.end>time) { item.end=time; try{item.source.stop(time);}catch{} } },
    dispose() { for(const item of active) { try{item.source.stop();}catch{} item.source.disconnect(); for(const n of item.nodes)n.disconnect(); } active.clear(); noiseBuffer=null; }
  };
}

export function createMusic(env) {
  const {ctx,out,verb}=env;
  if(!ctx || !out || typeof env.hz!=='function') throw new TypeError('createMusic needs ctx, out and hz');
  const seed=env.seed===undefined?1:env.seed>>>0;
  // Optional review clock only: pitch, instrument envelopes and lookahead
  // still use real AudioContext seconds; score transitions accelerate too. Production defaults to rate 1.
  const rate=clamp(Number(env.rate)||1,1,3);
  const renderer=createMusicRenderer(env), output=ctx.createGain(), volume=ctx.createGain();
  output.gain.value=0; volume.gain.value=.8; output.connect(volume); volume.connect(out);
  const send=ctx.createGain(); send.gain.value=.38; if(verb) { volume.connect(send); send.connect(verb); }
  let nextVisit=score(seed), itineraryShift=0, visits=[], buses=new Map(), timer=null, running=false, disposed=false;
  let position=0, anchor=ctx.currentTime, cursor=0, lastTick=anchor, pausedPosition=null;
  let requestedVolume=.8, skipped=0, maxSources=0, tickCount=0;
  function at(t=ctx.currentTime) { return running ? position+Math.max(0,t-anchor)*rate : position; }
  function takeVisit() { const p=nextVisit(); return {...p,start:p.start+itineraryShift,end:p.end+itineraryShift}; }
  function plan(to) {
    if(!visits.length) visits.push(takeVisit());
    while(visits[visits.length-1].end-FADE<=to) visits.push(takeVisit());
    // Keep only current overlap and the next visit, even after hours of playback.
    while(visits.length>2 && visits[0].end<at()-FADE) visits.shift();
  }
  function ramp(param,value,time,duration) {
    if(param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
    else { const old=param.value; param.cancelScheduledValues(time); param.setValueAtTime(old,time); }
    param.linearRampToValueAtTime(value,time+Math.max(.008,duration));
  }
  function busFor(p,now) {
    let entry=buses.get(p.index); if(entry) return entry.node;
    const node=ctx.createGain(), pos=at(now), fade=p.index===0?4:FADE;
    const local=pos-p.start, end=p.end-pos;
    node.gain.setValueAtTime(clamp(local/fade,0,1),now);
    if(local<fade) {
      if(local<0) node.gain.setValueAtTime(0,now-local/rate);
      node.gain.linearRampToValueAtTime(1,now+(fade-local)/rate);
    }
    const fadeStart=now+(end-FADE)/rate, fadeEnd=now+end/rate;
    if(fadeStart>now) node.gain.setValueAtTime(1,fadeStart);
    else node.gain.setValueAtTime(clamp(end/FADE,0,1),now);
    node.gain.linearRampToValueAtTime(0,Math.max(now+.008,fadeEnd)); node.connect(output);
    entry={node,end:p.end}; buses.set(p.index,entry); return node;
  }
  function retireBuses(now,fade) {
    const old=[...buses.values()]; buses=new Map();
    for(const b of old) { ramp(b.node.gain,0,now,fade); b.cleanupAt=now+fade+.02; buses.set(Symbol(),b); }
  }
  function clearBuses() { for(const {node} of buses.values())node.disconnect(); buses.clear(); }
  function tick() {
    if(disposed || !running) return;
    const now=ctx.currentTime;
    if(ctx.state && ctx.state!=='running') return;
    const pos=at(now);
    // Never replay the backlog. Bounded work is proportional to the future
    // window, independent of how long JS or the audio device was asleep.
    if(now-lastTick>AHEAD || cursor<pos-.05) { skipped++; cursor=pos+.025*rate; }
    lastTick=now; tickCount++;
    const to=pos+AHEAD*rate; plan(to);
    const events=[];
    for(const p of visits) if(p.end>=pos && p.start<to) events.push(...rangeEvents(p,Math.max(cursor,pos),to));
    events.sort((a,b)=>a.time-b.time);
    for(const e of events) {
      const p=visits.find(p=>p.index===e.visit);
      renderer.play(e,now+Math.max(.008,(e.time-pos)/rate),busFor(p,now));
    }
    cursor=to;
    for(const [id,b] of buses) if(b.cleanupAt!==undefined ? now>=b.cleanupAt : b.end<pos) { b.node.disconnect(); buses.delete(id); }
    maxSources=Math.max(maxSources,renderer.active());
  }
  function reanchor() {
    if(!running || disposed) return;
    const now=ctx.currentTime;
    position=pausedPosition===null?at(now):pausedPosition; pausedPosition=null; anchor=now;
    cursor=position+.025*rate; lastTick=now; renderer.stopAfter(now+.06); retireBuses(now,.05);
    // Long notes that started before the new anchor are replaced by a gentle
    // current chord; missed melody and percussion are discarded.
    plan(position+AHEAD*rate);
    for(const p of visits) if(p.start<=position && p.end>position) {
      const bar=Math.floor((position-p.start)/barLength(p));
      const chord=CHORDS[Math.floor(bar/4)%4];
      for(const degree of chord) renderer.play({instrument:'pad',degree,gain:.022,duration:8,attack:1.1},now+.04,busFor(p,now));
    }
    tick();
  }
  function stateChange() {
    if(!running) return;
    if(ctx.state==='running') reanchor();
    else { pausedPosition=at(); position=pausedPosition; anchor=ctx.currentTime; }
  }
  ctx.addEventListener?.('statechange',stateChange);
  function start() {
    if(disposed || running) return;
    const now=ctx.currentTime;
    renderer.stopAfter(now+.03); retireBuses(now,.025);
    running=true; anchor=now; cursor=position; lastTick=now; pausedPosition=null;
    ramp(output.gain,1,now,4);
    if(position>0) reanchor(); else tick();
    timer=setInterval(tick,TICK);
  }
  function stop(fade=.6) {
    if(disposed || !running) return;
    const now=ctx.currentTime, duration=Number.isFinite(fade)?Math.max(.008,fade):.6;
    position=at(); anchor=now; running=false; pausedPosition=null;
    clearInterval(timer); timer=null;
    ramp(output.gain,0,now,duration);
    renderer.stopAfter(now+duration);
    // Disconnect without a wall-clock timeout: onended cleans source graphs.
  }
  function advanceTo(target) {
    if(disposed) return;
    const now=ctx.currentTime, old=at(now); plan(old);
    // Preserve the outgoing layer while the incoming piece fades in for 8 s.
    retireBuses(now,FADE);
    // Force a visit boundary at target, keeping deterministic shuffled order.
    let candidate=visits.find(p=>p.start>old+.001);
    if(!candidate) candidate=takeVisit();
    const shift=target-candidate.start;
    candidate={...candidate,start:target,end:candidate.end+shift};
    // Rebase the remaining deterministic itinerary onto this manual boundary.
    itineraryShift+=shift;
    visits=[candidate]; position=target; anchor=now; cursor=target; lastTick=now;
    if(running) tick();
  }
  function next() { advanceTo(at()); }
  // Review-only seek: use the same score, not a second composer or fake ctx.
  function seek(seconds) {
    if(disposed || !Number.isFinite(seconds) || seconds<0) return;
    const now=ctx.currentTime;
    nextVisit=score(seed); itineraryShift=0; visits=[]; position=seconds; anchor=now; plan(seconds);
    cursor=seconds; renderer.stopAfter(now+.06); retireBuses(now,.05);
    if(running) reanchor();
  }
  return {
    start, stop, next, resume:reanchor, seek,
    setVolume(v) { if(disposed) return; requestedVolume=clamp(Number(v)||0,0,1); ramp(volume.gain,requestedVolume,ctx.currentTime,.12); },
    state() {
      const pos=at(); plan(pos); const p=[...visits].reverse().find(p=>p.start<=pos)||visits[0];
      return {piece:p.id,section:sectionAt(p,pos),elapsed:pos,scheduledAhead:running?Math.max(0,(cursor-pos)/rate):0,
        pieceElapsed:pos-p.start,running,context:ctx.state,activeSources:renderer.active(),maxSources,skipped,ticks:tickCount,volume:requestedVolume,rate};
    },
    dispose() { if(disposed) return; stop(.008); disposed=true; clearInterval(timer); renderer.dispose(); clearBuses(); output.disconnect(); volume.disconnect(); send.disconnect(); ctx.removeEventListener?.('statechange',stateChange); }
  };
}
