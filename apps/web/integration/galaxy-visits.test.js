import {expect,it,vi} from 'vitest';
import {galaxyVisits} from './galaxy-visits.js';
it('explains a recorded fair and offers an accessible return to the open sandbox in both languages',()=>{
 for(const lang of ['en','es']){
  document.body.innerHTML='<div id="hud"></div>';document.documentElement.lang=lang;
  const store={galaxyId:'bad-2026',loaded:()=>({galaxy:{id:'bad-2026',name:'BAD 2026',status:'frozen'}})};
  HTMLDialogElement.prototype.showModal=vi.fn(function(){this.open=true;});HTMLDialogElement.prototype.close=vi.fn(function(){this.open=false;});
  const nav=galaxyVisits({store,replayMode:true,base:'/little-galaxy/'});
  expect(document.querySelector('#backToSandbox').textContent).toBe(lang==='es'?'Galaxia abierta':'Open Galaxy');
  expect(document.querySelector('#backToFair').textContent).toMatch(/fair|feria/iu);
  expect(document.querySelector('#backToFair svg')).not.toBeNull();
  document.querySelector('#aboutRecordedGalaxy').click();const dialog=document.querySelector('#recordInformation');
  expect(dialog.open).toBe(true);expect(dialog.getAttribute('aria-labelledby')).toBe('recordInformationTitle');
  expect(dialog.textContent).toContain('USFQ');expect(dialog.textContent).toContain(lang==='es'?'apodos':'nicknames');
  dialog.querySelector('button').click();expect(dialog.open).toBe(false);nav.dispose();expect(document.querySelector('dialog')).toBeNull();
 }
});

it('updates recorded navigation and preserves the author across freeze, language change and reopening',()=>{
 const previous=location.href;history.replaceState(null,'','?lang=en');
 document.body.innerHTML='<div id="hud"><div class="home-footer"><button id="btnCredits">Author</button></div></div>';
 document.documentElement.lang='en';
 const galaxy={id:'test',status:'active',writePolicy:'public'},store={galaxyId:'test',loaded:()=>({galaxy})};
 const nav=galaxyVisits({store,replayMode:false,base:'/little-galaxy/'});
 galaxy.status='frozen';nav.render();
 expect(document.querySelector('#openTimelapse')).not.toBeNull();
 expect(document.querySelector('#galaxyVisits #btnCredits')).not.toBeNull();
 document.documentElement.lang='es';nav.render();
 expect(document.querySelector('#backToSandbox').getAttribute('aria-label')).toBe('Volver a la Galaxia abierta para crear un astro');
 expect(new URL(document.querySelector('#openTimelapse').href).searchParams.get('lang')).toBe('es');
 galaxy.status='active';nav.render();
 expect(document.querySelector('#openNav > #btnCredits')).not.toBeNull();
 expect(document.querySelector('#backToSandbox')).toBeNull();nav.dispose();history.replaceState(null,'',previous);
});
