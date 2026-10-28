import './theme.css';
import {t} from '../js/i18n.js';
export function setupTheme(){
 let theme;try{theme=localStorage.getItem('little-galaxy.ui-theme')||localStorage.getItem('galaxy.theme');}catch{ /* Use the observatory's night panels. */ }
 if(!['light','dark'].includes(theme))theme='dark';
 const button=document.createElement('button');button.id='panelTheme';button.type='button';button.className='pill glass';
 const render=()=>{document.documentElement.dataset.uiTheme=theme;const label=t(theme==='dark'?'theme.light':'theme.dark');button.innerHTML='<svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor"/></svg>';button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(theme==='light'));};
 button.onclick=()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('little-galaxy.ui-theme',theme);}catch{ /* The choice still applies to this tab. */ }render();};
 (document.querySelector('.top-actions')||document.querySelector('.keeper-header .keeper-actions')).append(button);render();
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
