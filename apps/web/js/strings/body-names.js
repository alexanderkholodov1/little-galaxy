// Word banks for generated workshop labels; no visitor names.
const NOUNS = [['Brasa','f'],['Lucero','m'],['Miel','f'],['Farol','m'],['Canela','f'],['Vela','f'],['Duende','m'],
  ['Mochi','m'],['Ceniza','f'],['Bruma','f'],['Guijarro','m'],['Ámbar','m'],['Lila','f'],['Pompa','f'],['Cascabel','m'],
  ['Lumbre','f'],['Rescoldo','m'],['Chispa','f'],['Malvavisco','m'],['Nube','f'],['Grillo','m'],['Luciérnaga','f'],['Botón','m'],['Pluma','f']];
const ADJS = [['Tímido','Tímida'],['Dormido','Dormida'],['Risueño','Risueña'],['Tibio','Tibia'],['Lejano','Lejana'],
  ['Valiente','Valiente'],['Curioso','Curiosa'],['Pequeño','Pequeña'],['Callado','Callada'],['Soñador','Soñadora'],
  ['Tierno','Tierna'],['Despistado','Despistada'],['Bailarín','Bailarina'],['Viajero','Viajera'],['Dulce','Dulce'],
  ['Lento','Lenta'],['Feliz','Feliz'],['Brillante','Brillante']];
const EN_NOUNS = ['Ember','Honey','Lantern','Cinnamon','Candle','Pebble','Amber','Lilac','Bubble','Bell','Spark','Cloud','Button','Feather','Mist'];
const EN_ADJS = ['Shy','Sleeping','Laughing','Warm','Distant','Brave','Curious','Little','Quiet','Dreaming','Gentle','Wandering','Sweet','Slow','Happy','Bright'];
export function randomBodyName(lang){
  if(lang === 'en'){
    return EN_ADJS[(Math.random()*EN_ADJS.length)|0] + ' ' + EN_NOUNS[(Math.random()*EN_NOUNS.length)|0];
  }
  const n = NOUNS[(Math.random()*NOUNS.length)|0], a = ADJS[(Math.random()*ADJS.length)|0];
  return n[0] + ' ' + (n[1] === 'f' ? a[1] : a[0]);
}

