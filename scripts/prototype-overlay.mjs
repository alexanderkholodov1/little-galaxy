// Keep the upstream game intact; apply the small, reviewable packaging seams here.
export function replace(source, before, after){
  if(!source.includes(before)) throw new Error(`Prototype seam changed: ${before.slice(0, 100)}`);
  return source.replace(before, after);
}
export function integratePrototype(file, source){
  if(file.endsWith('.html')){
    source = source.replace(/<link[^>]+(?:preconnect|https:\/\/cdn\.jsdelivr\.net)[^>]*>\n/g, '')
      .replace(/<script type="importmap">[\s\S]*?<\/script>\n/g, '')
      .replace('<html lang="es">', '<html lang="en">')
      .replace('<link rel="stylesheet" href="css/style.css">', '<link rel="stylesheet" href="integration/fonts.css">\n<link rel="stylesheet" href="css/style.css">');
  }
  if(file === 'js/main.js'){
    source = "import {watchVersion} from '../integration/version.js';\n" + source;
    source = replace(source, '  setInterval(saveSky, 8000);', '  setInterval(saveSky, 8000);\n  watchVersion(saveSky);');
    source = replace(source, 'window.__fog = {', 'if(import.meta.env.DEV) window.__fog = {');
    source = replace(source, "const DEBUG = /[?&]debug\\b/.test(location.search);", "const DEBUG = import.meta.env.DEV && /[?&]debug\\b/.test(location.search);");
    source = replace(source, "if(new URLSearchParams(location.search).has('sandbox'))", "if(import.meta.env.DEV && new URLSearchParams(location.search).has('sandbox'))");
  }
  return source;
}
