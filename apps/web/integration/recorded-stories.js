/** Editorial copy lives in the string tables; this registry only identifies each record's fields. */
const stories={'bad-2026':{paragraphs:4}};
export function recordedStory(id,translate){
 const record=stories[id];if(!record)return null;
 const text=field=>translate('story.'+id+'.'+field);
 return {shortTitle:text('shortTitle'),timeline:text('timeline'),visit:text('visit'),title:text('title'),
  paragraphs:Array.from({length:record.paragraphs},(_,i)=>text('paragraphs.'+(i+1)))};
}
