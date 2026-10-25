const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** A confirm sheet for consequential but reversible keeper actions: one tap confirms, Esc cancels. */
export function confirmSheet(dialog,{title,body,confirm,cancel}){
  dialog.innerHTML=`<h2 id="ad-dialog-title">${esc(title)}</h2><p>${esc(body)}</p><div class="ad-actions"><button type="button" id="ad-cancel">${esc(cancel)}</button><button type="button" id="ad-confirm" class="ad-primary">${esc(confirm)}</button></div>`;
  return new Promise(resolve=>{
    const finish=value=>{dialog.onclose=null;dialog.oncancel=null;dialog.onkeydown=null;if(dialog.open)dialog.close();resolve(value);};
    dialog.querySelector('#ad-confirm').onclick=()=>finish(true);
    dialog.querySelector('#ad-cancel').onclick=()=>finish(false);
    dialog.oncancel=event=>{event.preventDefault();finish(false);};
    dialog.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}};
    dialog.onclose=()=>finish(false);
    dialog.showModal();dialog.querySelector('#ad-confirm').focus();
  });
}
