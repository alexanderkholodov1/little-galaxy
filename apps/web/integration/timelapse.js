import './timelapse.css';
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
  const playback=new Playback(duration),es=document.documentElement.lang==='es';
  document.body.dataset.replay='true';
  const footer=document.createElement('footer');footer.id='timeRuler';
  const name=document.createElement('h1');name.textContent=g.name;footer.append(name);
  const record=document.createElement('p');record.textContent=`${new Date(g.epoch).toISOString().slice(0,10)} · ${es?'Cielo registrado · solo mirar':'Recorded sky · read only'}`;footer.append(record);
  const controls=document.createElement('div');controls.className='timeControls';
  controls.innerHTML=`<button id="replayPlay" type="button">${es?'Reproducir':'Play'}</button><label>${es?'Velocidad':'Speed'} <select id="replaySpeed">${[.25,1,4,16,60].map(n=>`<option value="${n}" ${n===1?'selected':''}>${n}×</option>`).join('')}</select></label><output id="replayTime">0:00:00</output>`;
  const scrub=document.createElement('input');scrub.type='range';scrub.min='0';scrub.max=String(duration);scrub.value='0';scrub.id='replayScrub';scrub.setAttribute('aria-label',es?'Momento de la galaxia':'Galaxy moment');
  footer.append(controls,scrub);document.body.append(footer);
  const play=controls.querySelector('#replayPlay');
  play.onclick=()=>{if(playback.playing)playback.pause();else playback.play();request(playback.tick());render();};
  controls.querySelector('#replaySpeed').onchange=event=>{playback.setSpeed(Number(event.target.value));render();};
  scrub.oninput=()=>{playback.seek(Number(scrub.value));request(playback.tick());render();};
  function render(){const tick=playback.tick();scrub.value=String(tick);controls.querySelector('output').value=`${time(tick)} / ${time(duration)}`;play.textContent=playback.playing?(es?'Pausar':'Pause'):(es?'Reproducir':'Play');}
  setInterval(render,100);return playback;
}
