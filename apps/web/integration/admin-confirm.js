const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** A confirm sheet for consequential but reversible keeper actions: one tap confirms, Esc cancels. */
export function confirmSheet(dialog,{title,body,confirm,cancel}){
  dialog.innerHTML=`<h2 id="keeper-dialog-title">${esc(title)}</h2><p>${esc(body)}</p><div class="keeper-actions"><button type="button" id="keeper-cancel">${esc(cancel)}</button><button type="button" id="keeper-confirm" class="keeper-primary">${esc(confirm)}</button></div>`;
  return new Promise(resolve=>{
    const finish=value=>{dialog.onclose=null;dialog.oncancel=null;dialog.onkeydown=null;if(dialog.open)dialog.close();resolve(value);};
    dialog.querySelector('#keeper-confirm').onclick=()=>finish(true);
    dialog.querySelector('#keeper-cancel').onclick=()=>finish(false);
    dialog.oncancel=event=>{event.preventDefault();finish(false);};
    dialog.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();finish(false);}};
    dialog.onclose=()=>finish(false);
    dialog.showModal();dialog.querySelector('#keeper-confirm').focus();
  });
}
