import {displayGalaxyName} from './galaxy-name.js';
import './timelapse.css';
import {recordedStory} from './recorded-stories.js';
import {getLang, register, setLang, t} from '../js/i18n.js';
import galaxyStrings from '../js/strings/galaxy.js';
register(galaxyStrings);
function say(key){
  const page=document.documentElement.lang==='es'?'es':'en';
  if(getLang()!==page)setLang(page);
  return t(key);
}
export class Playback {
  constructor(duration,now=()=>performance.now()) {this.duration=duration;this.now=now;this.position=0;this.anchor=now();this.speed=1;this.playing=false;}
  tick(){
    const tick=this.position+(this.playing?(this.now()-this.anchor)*.12*this.speed:0);
    if(tick>=this.duration){this.position=this.duration;this.playing=false;return this.duration;}
    return Math.floor(tick);
  }
  // the continuous playback moment (ticks), for drawing between published frames
  at(){return Math.min(this.duration,this.position+(this.playing?(this.now()-this.anchor)*.12*this.speed:0));}
  play(){if(this.position>=this.duration)this.position=0;this.anchor=this.now();this.playing=true;}
  pause(){this.position=this.tick();this.anchor=this.now();this.playing=false;}
  setSpeed(speed){if(!(speed>0&&speed<=120))throw new Error('Invalid playback speed');this.position=this.tick();this.anchor=this.now();this.speed=speed;}
  seek(tick){if(!Number.isFinite(tick))return;this.position=Math.min(this.duration,Math.max(0,Math.floor(tick)));this.anchor=this.now();if(this.position===this.duration)this.playing=false;}
}
const time=tick=>{const seconds=Math.floor(tick/120);return `${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
const SPEEDS=[0.25,1,4,16,60];
export function setupTimelapse({loaded,request,now}){
  const g=loaded.galaxy,duration=Math.max(0,loaded.head.effectiveTick,Math.ceil(((g.frozenAt??now())-g.epoch)*.12));
  const playback=new Playback(duration);playback.seek(duration);playback.speed=60;
  const firstLaunch=loaded.actions.find(a=>a.intent.type==='launch')?.intent.effectiveTick??0;
  document.body.dataset.replay='true';
  const footer=document.createElement('footer');footer.id='timeRuler';footer.className='glass';
  const name=document.createElement('h1');footer.append(name);
  const record=document.createElement('p');footer.append(record);
  const controls=document.createElement('div');controls.className='timeControls';
  const play=document.createElement('button');play.id='replayPlay';play.type='button';play.className='pill glass';
  const speeds=document.createElement('div');speeds.id='replaySpeed';speeds.setAttribute('role','radiogroup');
  for(const n of SPEEDS){
    const chip=document.createElement('button');chip.type='button';chip.className='chip';chip.dataset.speed=String(n);chip.textContent=`${n}×`;chip.setAttribute('role','radio');
    chip.onclick=()=>{playback.setSpeed(n);render();};
    speeds.append(chip);
  }
  const clock=document.createElement('output');clock.id='replayTime';clock.className='num';
  controls.append(play,speeds,clock);
  const scrub=document.createElement('input');scrub.type='range';scrub.min='0';scrub.max=String(duration);scrub.value='0';scrub.step='1';scrub.id='replayScrub';
  footer.append(controls,scrub);document.body.append(footer);
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
  scrub.oninput=()=>seek(Number(scrub.value),pending?.resume??playback.playing);
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
    const story=recordedStory(g.id,say);
    const title=story?.shortTitle??displayGalaxyName(g.name,getLang());
    if(name.textContent!==title){
      name.replaceChildren(...title.split(/(\s+)/u).map(word=>{
        if(/^\s+$/u.test(word))return document.createTextNode(word);
        const span=document.createElement('span');span.textContent=word;return span;
      }));
    }
    record.textContent=`${new Date(g.epoch).toISOString().slice(0,10)} · ${story?.timeline??say('replay.readonly')}`;
    speeds.setAttribute('aria-label',say('replay.speed'));
    scrub.setAttribute('aria-label',say('replay.moment'));
    const tick=pending?.tick??presented;
    scrub.value=String(tick);
    const ratio=duration?Number(tick)/duration*100:0;
    scrub.style.setProperty('--v',String(ratio));
    clock.value=`${time(tick)} / ${time(duration)}${pending?` · ${say('replay.opening')}`:''}`;
    const running=pending?.resume??playback.playing;
    play.textContent=running?say('replay.pause'):(playback.position>=duration?say('replay.fromStart'):say('replay.play'));
    play.setAttribute('aria-pressed',String(running));
    for(const chip of speeds.querySelectorAll('[data-speed]')){
      const on=Number(chip.dataset.speed)===playback.speed;
      chip.setAttribute('aria-checked',String(on));
    }
  }
  render();
  const language=new MutationObserver(render);
  language.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  // Play owns its clock feed, including when the live-world visibility scheduler is suspended.
  const timer=setInterval(()=>{if(playback.playing&&!pending)request(playback.tick());render();},100);
  playback.dispose=()=>{clearInterval(timer);language.disconnect();footer.remove();};
  return playback;
}
