import intents from './fixtures/fair-launch-intents.json' with {type:'json'};
// Public simulation inputs only. IDs and membership are synthetic; no visitor names or profiles.
export const fairIntentCopies=intents;
export const fairCopyActions=intents.map((intent,i)=>({schemaVersion:1,generation:1,sequence:i+1,
  memberId:'synthetic-observer',displayName:'Anonymous',acceptedAt:Math.floor(intent.effectiveTick/120*1000),
  previousHash:'',hash:'',intent}));
export const fairDuration=23_352_007;
