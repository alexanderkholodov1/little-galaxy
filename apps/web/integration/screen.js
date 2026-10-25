import qrcode from 'qrcode-generator';
import './screen.css';
export function setupScreen({world,labels}){
  if(!location.pathname.replace(/\/$/,'').endsWith('/screen'))return;
  document.body.dataset.booth='true';labels.setMode('all');
  const join=new URL(import.meta.env.BASE_URL,location.origin).href;
  const code=qrcode(0,'M');code.addData(join);code.make();
  const aside=document.createElement('aside');aside.id='boothPlaque';
  aside.innerHTML=`<a id="boothJoin" href="${join}">${code.createSvgTag({cellSize:3,margin:3,scalable:true})}<span>Little Galaxy<small>Make a star · Crea tu astro</small></span></a><button id="boothFullscreen" type="button">Fullscreen · Pantalla completa</button>`;
  document.body.append(aside);
  const fullscreen=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{ /* Browser fullscreen requires a user gesture. */ }};
  document.getElementById('boothFullscreen').onclick=fullscreen;
  addEventListener('keydown',event=>{if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey)fullscreen();});
  try{const view=JSON.parse(localStorage.getItem('little-galaxy.booth-view'));if(view)world.restoreView(view);}catch{ /* First booth visit uses the finding chart's default view. */ }
  const save=()=>{try{localStorage.setItem('little-galaxy.booth-view',JSON.stringify(world.viewState()));}catch{ /* Camera persistence is optional. */ }};
  addEventListener('pagehide',save);addEventListener('galaxy:selection',save);
  addEventListener('pointermove',()=>{document.body.classList.remove('booth-idle');clearTimeout(aside.idle);aside.idle=setTimeout(()=>document.body.classList.add('booth-idle'),2500);});
}
