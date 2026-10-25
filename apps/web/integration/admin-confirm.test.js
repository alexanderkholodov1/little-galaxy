import {beforeEach,expect,it} from 'vitest';
import {confirmSheet} from './admin-confirm.js';
let dialog;
const texts={title:'Open “Fair” to the public?',body:'Every phone reloads.',confirm:'Open to public',cancel:'Cancel'};
beforeEach(()=>{
  document.body.innerHTML='<dialog id="ad-dialog"></dialog>';dialog=document.getElementById('ad-dialog');
  // jsdom has no modal dialog; mirror the browser's open/close behaviour.
  dialog.showModal=function(){this.setAttribute('open','');};
  dialog.close=function(){this.removeAttribute('open');this.dispatchEvent(new Event('close'));};
});
it('says what happens and confirms with one tap',async()=>{
  const answer=confirmSheet(dialog,texts);
  expect(dialog.open).toBe(true);expect(dialog.textContent).toContain('Every phone reloads.');
  dialog.querySelector('#ad-confirm').click();
  expect(await answer).toBe(true);expect(dialog.open).toBe(false);
});
it('cancels with Esc or the cancel button',async()=>{
  let answer=confirmSheet(dialog,texts);
  dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(await answer).toBe(false);expect(dialog.open).toBe(false);
  answer=confirmSheet(dialog,texts);dialog.querySelector('#ad-cancel').click();
  expect(await answer).toBe(false);
});
