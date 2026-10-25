import {replace} from './prototype-overlay.mjs';
export function sharedOverlay(file,source){
  if(file==='js/store.js')return "export {createSharedStore as createLocalStore} from '../integration/store.js';\n";
  if(file==='js/main.js'){
    source="import {setupScreen} from '../integration/screen.js';\n"+source;
    source="import {startSharedWorld} from '../integration/shared-world.js';\n"+source;
    source=replace(source, 'const QS = new URLSearchParams(location.search);', 'const QS = new URLSearchParams(location.search);\nconst ROUTE = location.pathname.replace(/\\/$/, \'\');');
    source=replace(source, "galaxyId: QS.get('galaxy') || null", "galaxyId: QS.get('g') || QS.get('galaxy') || null");
    source=replace(source, "from './metrics.js'", "from '../integration/metrics.js'");
    source=replace(source,"booth: QS.has('booth')", "booth: QS.has('booth') || ROUTE.endsWith('/screen'), replay: ROUTE.endsWith('/timelapse'), readOnly: ROUTE.endsWith('/timelapse') || ROUTE.endsWith('/screen') || QS.get('smoke') === 'readonly'");
    source=replace(source,"const loaded = await store.loadGalaxy().catch(() => ({player:null, state:null}));", "const loaded = await store.loadGalaxy();\n  world.owner = store.owner();");
    const start=source.indexOf('  if(saved){ try{ world.loadGalaxy');
    const end=source.indexOf('\n\n  splitSplash();',start);
    if(start<0||end<0)throw new Error('Prototype load seam changed');
    source=source.slice(0,start)+`  world.shared = true;
  try{ const draft = JSON.parse(localStorage.getItem('little-galaxy.workshop')); if(draft){S.design = normDesign(draft.design); S.name = draft.name;} }catch(_){}
`+source.slice(end);
    source=replace(source, '  setupShake();', '  setupShake();\n  setupScreen({world,labels});');
    source=replace(source,"  wireWorldEvents();", "  wireWorldEvents();\n  startSharedWorld({world,store,S,loaded,normDesign,toast,updateCount,saveDraft:saveSky});\n  world.on('shared-pending', () => {aimTitle(() => getLang() === 'es' ? 'Lanzando…' : 'Launching…'); aimStats(() => getLang() === 'es' ? 'Esperando el cielo compartido' : 'Waiting for the shared sky');});\n  world.on('shared-denied', () => {aimTitle(() => getLang() === 'es' ? 'Todavía está en tu mano' : 'Still in your hand');});");
    source=replace(source,'  watchVersion(saveSky);','');
    source=source.replace("import {watchVersion} from '../integration/version.js';\n",'');
    source=replace(source,'  if(S.frozen) freezeUi();','');
    const a=source.indexOf('    const sb = res.entry.sb;\n    store.launch(');
    const b=source.indexOf("    metric('launch'",a);
    if(a<0||b<0)throw new Error('Prototype launch notification seam changed');
    source=source.slice(0,a)+source.slice(b);
    source=replace(source,"  try{ store.save(world.serialize()); }catch(_){}", "  try{ localStorage.setItem('little-galaxy.workshop', JSON.stringify({design:S.design,name:S.name})); }catch(_){}");
    // Refuse a frozen launch even if the lifecycle changes while the workshop is already open.
    source=replace(source,'function goLaunch(){','function goLaunch(){\n  if(S.frozen || store.readOnly){toast(t(\'shared.frozen\')); return;}');
  }
  if(file==='js/world.js'){
    source=replace(source,'  const sim = new Sim({seed: opts.seed ?? 1});','  const sim = new Sim({seed: opts.seed ?? 1});\n  const toySim = new Sim({seed:1});');
    source=replace(source,'    else sb = sim.add(spec);','    else sb = toy && W.shared ? toySim.add(spec) : sim.add(spec);');
    source=replace(source,'e.body.dispose(); sim.remove(e.sb);', 'e.body.dispose(); (e.toy && W.shared ? toySim : sim).remove(e.sb);');
    source=replace(source,'    sim.advance(dt);','    if(W.shared) toySim.advance(dt); else sim.advance(dt);');
    source=replace(source,'    // presupuestos (R7):', `    if(W.shared && !W.padToy){
      if(W.readOnly){ emit('shared-denied'); return null; }
      const p0 = restPos(new THREE.Vector3());
      W.benchState = 'launching';
      emit('shared-pending');
      W.requestLaunch({design:{...b.d}, origin:[p0.x,p0.z], velocity:[aim.vel.x,aim.vel.z],
        system:launchHost().id, strength:aim.strength, el:aim.pred.el, outcome:aim.pred.outcome, compact:!!aim.pred.compact});
      return null;
    }
    // presupuestos (R7):`);
    const methods=`  function applySharedState(state, norm, owner){
    const ids = new Set(state.entries.map(e=>e.id));
    for(const e of [...W.entries]) if(!e.toy && !ids.has(e.id)) removeEntry(e);
    sim.restore(state.sim);
    W.sharedHomes = new Map(state.homes);
    for(const m of state.entries){
      let e = W.entries.find(e=>!e.toy && e.id===m.id);
      const design = norm(m.design);
      if(!e){ e = makeEntry(sim.byId(m.id), {...m, design, mine:m.owner===owner}); }
      else {
        e.sb = sim.byId(m.id);
        if(JSON.stringify(e.design)!==JSON.stringify(design)){ e.body.setDesign(design); e.design=design; }
      }
      e.logical=m.logical; e.home=m.home;
    }
    return W.entries.filter(e=>!e.toy);
  }
  function completeSharedLaunch(entry,res){
    if(W.benchBody){scene.remove(W.benchBody.root); W.benchBody.dispose();}
    W.benchBody=null; W.benchState='gone'; W.lastLaunched=entry;
    sparks(entry.body.root.position, '#ff8a5b', 34, 3.2);
    emit('launch', {...res,entry,entries:[entry],toy:false});
  }
  function failSharedLaunch(){W.benchState='pad'; settleBack=.3; emit('shared-denied');}
`;
    source=replace(source,'  function serialize(){',methods+'  function serialize(){');
    source=replace(source, '    frame, resize, setMode,', `    viewState: () => ({az:rig.goal.az,el:rig.goal.el,dist:rig.goal.dist,target:rig.goal.target.toArray()}),\n    restoreView: o => {if([o.az,o.el,o.dist,...(o.target||[])].every(Number.isFinite) && o.target?.length===3) snapTo({...views().home,...o,target:new THREE.Vector3(...o.target)});},\n    frame, resize, setMode,`);
    source=replace(source,'    addEntry, removeEntry, orbitOf,','    applySharedState, completeSharedLaunch, failSharedLaunch,\n    addEntry, removeEntry, orbitOf,');
  }
  if(file==='js/strings/galaxy.js'){
    // The shared transport messages live beside the prototype catalogs.
    source += "\n";
  }
  return source;
}
