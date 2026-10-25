import './theme.css';
export function setupTheme(){
 let theme;try{theme=localStorage.getItem('little-galaxy.ui-theme')||localStorage.getItem('galaxy.theme');}catch{ /* Use the observatory's night panels. */ }
 if(!['light','dark'].includes(theme))theme='dark';
 const button=document.createElement('button');button.id='panelTheme';button.type='button';button.className='pill glass';
 const render=()=>{const es=document.documentElement.lang==='es';document.documentElement.dataset.uiTheme=theme;button.textContent=theme==='dark'?(es?'Paneles claros':'Light panels'):(es?'Paneles oscuros':'Dark panels');button.setAttribute('aria-label',button.textContent);button.title=button.textContent;button.innerHTML='<svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor"/></svg>';button.setAttribute('aria-pressed',String(theme==='light'));};
 button.onclick=()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('little-galaxy.ui-theme',theme);}catch{ /* The choice still applies to this tab. */ }render();};
 (document.querySelector('.top-actions')||document.querySelector('.ad-header .ad-actions')).append(button);render();
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
