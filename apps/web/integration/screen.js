import qrcode from 'qrcode-generator';
import './screen.css';
export function setupScreen({world,labels}){
  if(!location.pathname.replace(/\/$/,'').endsWith('/screen'))return;
  document.body.dataset.booth='true';
  const join=new URL(import.meta.env.BASE_URL,location.origin).href;
  const code=qrcode(0,'M');code.addData(join);code.make();
  const aside=document.createElement('aside');aside.id='boothPlaque';
  aside.innerHTML=`<a id="boothJoin" href="${join}">${code.createSvgTag({cellSize:3,margin:3,scalable:true})}<span>Little Galaxy<small>Make a star · Crea tu astro</small></span></a><div><button id="boothFullscreen" type="button">Fullscreen · Pantalla completa</button> <button id="boothNames" type="button"></button></div>`;
  document.body.append(aside);
  // Names come from visitors; the keeper can hide them all (N) and the TV remembers it.
  const NAMES='little-galaxy.booth-names',names=document.getElementById('boothNames');
  let shown=true;try{shown=localStorage.getItem(NAMES)!=='hidden';}catch{ /* Names are shown by default. */ }
  const showNames=value=>{
    shown=value;labels.setMode(shown?'all':'none');
    names.setAttribute('aria-pressed',String(shown));names.textContent=shown?'Names: on · Nombres (N)':'Names: off · Nombres (N)';
    try{localStorage.setItem(NAMES,shown?'shown':'hidden');}catch{ /* Persistence is optional. */ }
  };
  showNames(shown);names.onclick=()=>showNames(!shown);
  const fullscreen=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{ /* Browser fullscreen requires a user gesture. */ }};
  document.getElementById('boothFullscreen').onclick=fullscreen;
  addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const key=event.key.toLowerCase();
    if(key==='f')fullscreen();else if(key==='n')showNames(!shown);
  });
  try{const view=JSON.parse(localStorage.getItem('little-galaxy.booth-view'));if(view)world.restoreView(view);}catch{ /* First booth visit uses the finding chart's default view. */ }
  const save=()=>{try{localStorage.setItem('little-galaxy.booth-view',JSON.stringify(world.viewState()));}catch{ /* Camera persistence is optional. */ }};
  addEventListener('pagehide',save);addEventListener('galaxy:selection',save);
  addEventListener('pointermove',()=>{document.body.classList.remove('booth-idle');clearTimeout(aside.idle);aside.idle=setTimeout(()=>document.body.classList.add('booth-idle'),2500);});
}
