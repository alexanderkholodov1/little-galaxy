/* global document, location */
import {readFile} from 'node:fs/promises';

export const easyListSelectors=(await readFile(new URL('../fixtures/easylist-generic.txt',import.meta.url),'utf8')).split('\n').filter(line=>line&&!line.startsWith('!'));

export async function applyEasyList(context){
 await context.addInitScript(selectors=>{
  if(!location.pathname.startsWith('/little-galaxy')&&!location.pathname.startsWith('/galaxy'))return;
  const install=()=>{
   const style=document.createElement('style');
   style.dataset.easylist='202610281521';
   style.textContent=selectors.map(selector=>`${selector}{display:none!important}`).join('\n');
   document.documentElement.append(style);
  };
  if(document.documentElement)install();else document.addEventListener('DOMContentLoaded',install,{once:true});
 },easyListSelectors);
}

export async function blockerMatches(page){
 return page.evaluate(selectors=>{
  const matches=[];
  for(const selector of selectors){
   let elements;
   try{elements=document.querySelectorAll(selector);}catch{continue;} // Extended blocker syntax is not native CSS.
   for(const element of elements)matches.push({selector,element:element.outerHTML.slice(0,240)});
  }
  return matches;
 },easyListSelectors);
}
