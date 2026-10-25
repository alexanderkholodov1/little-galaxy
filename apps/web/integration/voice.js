export function launchVoice(error){
 console.warn('Launch was not accepted.',error);
 const causes=[];for(let cause=error;cause&&!causes.includes(cause);cause=cause.cause)causes.push(cause);
 const denied=causes.some(cause=>/permission.denied|insufficient permissions/i.test(`${cause.code||''} ${cause.message||''}`));
 const es=document.documentElement.lang==='es',message=String(error?.message||'');
 if(denied)return es?'El cielo no pudo aceptar este lanzamiento por sus permisos. Tu diseño está guardado; recarga y vuelve a intentarlo.':'The sky could not accept this launch because of its permissions. Your design is safe; reload and try again.';
 if(/Player capacity/i.test(message))return es?'Ya has compartido todos los astros que puedes cuidar por ahora. Tu diseño está guardado.':'You have shared all the stars you can care for right now. Your design is safe.';
 if(/moon needs|Moon parent/i.test(message))return es?'Una luna necesita un planeta con espacio para cuidarla en este fuego. Tu diseño está guardado.':'A moon needs a planet with room to care for it in this fire. Your design is safe.';
 if(/cooldown|rate limit/i.test(message))return es?'Tu astro sigue en tu mano. Dale al fuego 15 segundos para descansar y vuelve a tirar.':'Your star is still in your hand. Give the fire 15 seconds to settle, then throw again.';
 if(/capacity|budget|limit|full/i.test(message))return es?'Este fuego ha recibido todo lo que puede cuidar por ahora. Tu diseño está guardado.':'This fire has received all it can care for right now. Your design is safe.';
 if(/read.only|frozen|resting/i.test(message))return es?'Esta galaxia está descansando. Puedes mirarla; tu diseño está guardado.':'This galaxy is resting. You can visit it; your design is safe.';
 return es?'El cielo no pudo escucharte. Tu astro sigue en tu mano; vuelve a tirar cuando haya conexión.':'The sky could not hear you. Your star is still in your hand; throw again when connected.';
}
