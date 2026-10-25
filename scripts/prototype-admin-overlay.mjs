import {replace} from './prototype-overlay.mjs';
export function adminOverlay(file,source){
  if(file==='js/admin/store.js')return "export {default} from '../../integration/admin-store.js';\n";
  if(file==='js/admin/config.js')return '// Google Auth and Firestore rules protect the shared ledger.\n';
  if(file==='js/admin/app.js'){
    source="import {setupTheme} from '../../integration/theme.js';\nsetupTheme();\n"+source;
    source=source.replace("import {PASSPHRASE_SHA256} from './config.js';\n",'').replace("let lang='es'", "let lang='en'");
    const gate=source.indexOf('function gate(){'),render=source.indexOf('\nasync function render(){',gate);
    source=source.slice(0,gate)+`function gate(){
      root.innerHTML=\`<section class="ad-gate glass"><h1>\${t('gate')}</h1><button id="ad-google" class="ad-primary">\${t('google')}</button><p class="ad-note">\${t('local')}</p></section>\`;
      document.querySelector('#ad-google').onclick=safe(async()=>{await store.signIn();unlocked=true;await render();});
    }`+source.slice(render);
    source=replace(source,"document.querySelector('#ad-logout').onclick=()=>{unlocked=false;", "document.querySelector('#ad-logout').onclick=async()=>{await store.signOut();unlocked=false;");
    source=replace(source, "await ({galaxies:renderGalaxies,bodies:renderBodies,metrics:renderMetrics}[tab])();", "const tabs=[...root.querySelectorAll('[data-tab]')];tabs.forEach(b=>b.disabled=true);try{await ({galaxies:renderGalaxies,bodies:renderBodies,metrics:renderMetrics}[tab])();}finally{tabs.forEach(b=>b.disabled=false);}");
    source="let activityTimer;\n"+source;
    source=replace(source, 'async function render(){chrome();', 'async function render(){clearInterval(activityTimer);chrome();');
    source=replace(source, 'async function renderMetrics(){', 'async function renderMetrics(){clearInterval(activityTimer);');
    source=replace(source, '<div class="ad-reading"><b>${v}', '<div class="ad-reading" data-reading="${k}"><b>${v}');
    source=replace(source, '<td class="${p.active?', '<td data-seen="${p.lastSeen}" class="${p.active?');
    source=replace(source, " document.querySelector('#ad-filters').onsubmit", ` const observed=performance.now();
 function expireActivity(){
  if(document.hidden)return;
  const now=m.observedAt+performance.now()-observed;
  const active=seen=>seen<=now&&seen>=now-300000;
  const reading=document.querySelector('[data-reading="now"] b');if(reading)reading.textContent=m.members.filter(p=>active(p.lastSeen)).length;
  document.querySelectorAll('[data-seen]').forEach(cell=>{const current=active(Number(cell.dataset.seen));cell.classList.toggle('ad-live',current);cell.textContent=t(current?'online':'offline');});
 }
 activityTimer=setInterval(expireActivity,15000);
 document.querySelector('#ad-filters').onsubmit`);
    // B1's immutable log and export replace the local destructive clear/restore and timed undo.
    source=replace(source, "${btn('backup','data-action=\"backup\"')}", "${g.state!=='archived'?btn('certify','data-action=\"certify\"'):''}${btn('backup','data-action=\"backup\"')}");
    source=replace(source, '(galaxies.length>=3?', '(!canCreate?');
    source=replace(source, 'const galaxies=await store.listGalaxies(), selection=await store.getSelection();', 'const galaxies=await store.listGalaxies(), selection=await store.getSelection(),canCreate=await store.canCreate();');
    source=replace(source,"const lists=await Promise.all(galaxies.map(g=>store.listBackups(g.id)));",'');
    source=replace(source,'galaxies.map((g,i)=>','galaxies.map(g=>');
    const a=source.indexOf('<div class="ad-backups">'),b=source.indexOf('</article>',a);
    if(a<0||b<0)throw new Error('Admin backup panel seam changed');source=source.slice(0,a)+source.slice(b);
    source=source.replace("{backup:card.querySelector('select').value}", "{backup:''}");
    source=replace(source, 'const current=(await store.listGalaxies())', 'await store.refresh();const current=(await store.listGalaxies())');
    source=replace(source,"document.querySelector('#ad-refresh').onclick=safe(renderMetrics)", "document.querySelector('#ad-refresh').onclick=safe(async()=>{await store.refresh();await renderMetrics();})");
    source=replace(source,'<b>${v}</b>','<b>${v??\'—\'}</b>');
    source=source.replace("render().catch(e=>notify(e.message,true));", "store.resume().then(()=>{unlocked=true;return render();}).catch(()=>render()).catch(e=>notify(e.message));");
    // Switching the public galaxy reloads every phone and freezing makes a galaxy read-only: confirm first.
    source=replace(source, "let result;if(action==='active')", "if(['active','freeze'].includes(action)&&!await confirmSheet(dialog,{title:t(action+'Title',{name:g.name}),body:t(action+'Confirm',{name:g.name}),confirm:t(action==='active'?'setActive':'freeze'),cancel:t('cancel')}))return;\n let result;if(action==='active')");
    source="import {confirmSheet} from '../../integration/admin-confirm.js';\n"+source;
  }
  if(file==='js/strings/admin.js')source+=`\nObject.assign(en, {
    'admin.certify':'Save verified sky', 'admin.google':'Sign in with Google', 'admin.subtitle':'Observatory · keeper’s ledger',
    'admin.local':'Verified Google account on the private keeper’s allowlist. Permissions are checked by Firestore.',
    'admin.limit':'Three galaxies per account. Start fresh by creating another galaxy; history is retained.',
    'admin.warning':'An export is verified and downloaded before this operation. Keep it on your own media. The accepted history is retained.',
    'admin.deleteExplain':'Remove {count} bodies from “{name}” ({id}). The accepted log and a downloaded export retain their history. Hosts with companions cannot be removed.',
    'admin.metricNote':'Memberships, not unique people. Activity is sampled over five minutes. Visits and cosmetic throws are not collected. The charts cover accepted launches; imported bodies have no launch-time history.',
    'admin.backup':'Export history', 'admin.backupId':'Export / result', 'admin.removed':'Removal recorded; history retained.'
  });
  Object.assign(es, {
    'admin.certify':'Guardar cielo verificado', 'admin.google':'Entrar con Google', 'admin.subtitle':'Observatorio · registro del guardián',
    'admin.local':'Cuenta de Google verificada en la lista privada del guardián. Firestore comprueba los permisos.',
    'admin.limit':'Tres galaxias por cuenta. Crea otra para empezar de nuevo; el historial se conserva.',
    'admin.warning':'Antes de cambiarla se verifica y descarga una exportación. Guárdala en tus propios medios. El historial se conserva.',
    'admin.deleteExplain':'Retirar {count} cuerpos de “{name}” ({id}). El registro y la exportación conservan su historia. No se pueden retirar anfitriones con compañeros.',
    'admin.metricNote':'Membresías, no personas únicas. Actividad muestreada cada cinco minutos. No se registran visitas ni juegos efímeros. Los gráficos cuentan lanzamientos aceptados; los cuerpos importados no tienen ese historial.',
    'admin.backup':'Exportar historial', 'admin.backupId':'Exportación / resultado', 'admin.removed':'Retiro registrado; historial conservado.'
  });\n`+`Object.assign(en, {
    'admin.activeTitle':'Open “{name}” to the public?',
    'admin.activeConfirm':'Every phone playing now reloads into “{name}”, and new visitors join it. Drafts in hand are kept. You can switch back later.',
    'admin.freezeTitle':'Freeze “{name}”?',
    'admin.freezeConfirm':'“{name}” becomes read-only: nobody can launch, edit or remove bodies until you reopen it. Its sky is then certified. Visitors can still watch it.'
  });
  Object.assign(es, {
    'admin.activeTitle':'¿Abrir “{name}” al público?',
    'admin.activeConfirm':'Cada teléfono que juega ahora se recarga en “{name}” y los nuevos visitantes entran ahí. Los borradores en mano se conservan. Puedes volver a cambiarla después.',
    'admin.freezeTitle':'¿Congelar “{name}”?',
    'admin.freezeConfirm':'“{name}” queda de solo lectura: nadie puede lanzar, editar ni retirar cuerpos hasta que la reabras. Luego se certifica su cielo. Los visitantes aún pueden mirarla.'
  });
`;
  return source;
}
