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
 return say('launch.voice.offline');
}
