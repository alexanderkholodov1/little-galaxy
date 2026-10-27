import './timelapse.css';
import {recordedStories} from './recorded-stories.js';
export class Playback {
  constructor(duration,now=()=>performance.now()) {this.duration=duration;this.now=now;this.position=0;this.anchor=now();this.speed=1;this.playing=false;}
  tick(){
    const tick=this.position+(this.playing?(this.now()-this.anchor)*.12*this.speed:0);
    if(tick>=this.duration){this.position=this.duration;this.playing=false;return this.duration;}
    return Math.floor(tick);
  }
  play(){if(this.position>=this.duration)this.position=0;this.anchor=this.now();this.playing=true;}
  pause(){this.position=this.tick();this.anchor=this.now();this.playing=false;}
  setSpeed(speed){if(!(speed>0&&speed<=120))throw new Error('Invalid playback speed');this.position=this.tick();this.anchor=this.now();this.speed=speed;}
  seek(tick){if(!Number.isFinite(tick))return;this.position=Math.min(this.duration,Math.max(0,Math.floor(tick)));this.anchor=this.now();if(this.position===this.duration)this.playing=false;}
}
const time=tick=>{const seconds=Math.floor(tick/120);return `${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
export function setupTimelapse({loaded,request,now}){
  const g=loaded.galaxy,duration=Math.max(0,loaded.head.effectiveTick,Math.ceil(((g.frozenAt??now())-g.epoch)*.12));
  const playback=new Playback(duration);playback.seek(duration);playback.speed=60;
  const firstLaunch=loaded.actions.find(a=>a.intent.type==='launch')?.intent.effectiveTick??0;
  const es=document.documentElement.lang==='es',story=recordedStories[g.id]?.[es?'es':'en'];
  document.body.dataset.replay='true';
  const footer=document.createElement('footer');footer.id='timeRuler';
  const name=document.createElement('h1');name.textContent=story?.shortTitle??g.name;footer.append(name);
  const record=document.createElement('p');record.textContent=`${new Date(g.epoch).toISOString().slice(0,10)} · ${story?.timeline??(es?'Cielo registrado · solo mirar':'Recorded sky · read only')}`;footer.append(record);
  const controls=document.createElement('div');controls.className='timeControls';
  controls.innerHTML=`<button id="replayPlay" type="button">${es?'Reproducir':'Play'}</button><label>${es?'Velocidad':'Speed'} <select id="replaySpeed">${[.25,1,4,16,60].map(n=>`<option value="${n}" ${n===60?'selected':''}>${n}×</option>`).join('')}</select></label><output id="replayTime">0:00:00</output>`;
  const scrub=document.createElement('input');scrub.type='range';scrub.min='0';scrub.max=String(duration);scrub.value='0';scrub.step='1';scrub.id='replayScrub';scrub.setAttribute('aria-label',es?'Momento de la galaxia':'Galaxy moment');
  footer.append(controls,scrub);document.body.append(footer);
  const play=controls.querySelector('#replayPlay');
  let presented=duration,pending=null;
  function seek(tick,resume=playback.playing){
    playback.pause();playback.seek(tick);pending={tick:playback.position,resume};
    footer.setAttribute('aria-busy','true');request(playback.position,{seek:true});render();
  }
  play.onclick=()=>{
    if(pending){pending.resume=!pending.resume;render();return;}
    if(playback.playing)playback.pause();
    else if(playback.position>=duration){seek(firstLaunch,true);return;}
    else playback.play();
    request(playback.tick());render();
  };
  controls.querySelector('#replaySpeed').onchange=event=>{playback.setSpeed(Number(event.target.value));render();};
  scrub.oninput=()=>seek(Number(scrub.value),pending?.resume??playback.playing);
  // Explicit controls also avoid platform-dependent range End/Home behaviour during render updates.
  scrub.onkeydown=event=>{
    const steps={ArrowLeft:-120,ArrowDown:-120,ArrowRight:120,ArrowUp:120,PageDown:-7200,PageUp:7200};
    if(event.key!=='Home'&&event.key!=='End'&&!(event.key in steps))return;
    event.preventDefault();
    seek(event.key==='Home'?0:event.key==='End'?duration:Number(scrub.value)+steps[event.key],pending?.resume??playback.playing);
  };
  playback.present=tick=>{
    if(pending && tick!==pending.tick)return;
    presented=tick;
    if(pending){const resume=pending.resume;pending=null;footer.removeAttribute('aria-busy');if(resume&&tick<duration)playback.play();}
    render();
  };
  function render(){
    scrub.value=String(pending?.tick??presented);
    controls.querySelector('output').value=`${time(pending?.tick??presented)} / ${time(duration)}${pending?(es?' · Abriendo…':' · Opening…'):''}`;
    play.textContent=(pending?.resume??playback.playing)?(es?'Pausar':'Pause'):(playback.position>=duration?(es?'Ver desde el primer lanzamiento':'Play from first launch'):(es?'Reproducir':'Play'));
  }
  render();const timer=setInterval(render,100);playback.dispose=()=>{clearInterval(timer);footer.remove();};
  return playback;
}
