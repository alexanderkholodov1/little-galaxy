import {getLang, register, setLang, t} from '../js/i18n.js';
import core from '../js/strings/core.js';
register(core);
function say(key, vars){
  const page=document.documentElement?.lang==='es'?'es':'en';
  if(getLang()!==page)setLang(page);
  return t(key, vars);
}
export function launchVoice(error){
 console.warn('Launch was not accepted.',error);
 const causes=[];for(let cause=error;cause&&!causes.includes(cause);cause=cause.cause)causes.push(cause);
 const denied=causes.some(cause=>/permission.denied|insufficient permissions/i.test(`${cause.code||''} ${cause.message||''}`));
 const message=String(error?.message||'');
 if(denied)return say('launch.voice.denied');
 if(/moon needs|Moon parent/i.test(message))return say('launch.voice.moon');
 if(/Launch rate limit/i.test(message))return say('launch.voice.pace');
 if(/Galaxy capacity/i.test(message))return say('launch.voice.full');
 if(/read.only|frozen|resting/i.test(message))return say('launch.voice.resting');
 const network=causes.some(cause=>/^(firestore\/)?(unavailable|deadline-exceeded|cancelled)$/i.test(cause.code||''))
  ||/offline|network|fetch|Clock synchronization|could not reach/i.test(message);
 // Any other refusal keeps the body in hand with a plain retry.
 return say(network?'launch.voice.offline':'launch.voice.denied');
}
