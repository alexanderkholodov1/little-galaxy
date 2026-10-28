// Public synthetic record for the release compatibility tests; no visitor data.
import {initialGalaxy} from '@little-galaxy/shared';
import {FAIR_KERNEL} from './kernel-routing.js';
export const fairEpoch=Date.UTC(2026,9,25,12);
export const fairGalaxy={...initialGalaxy('frozen-fair','operator','Recorded fair',fairEpoch,FAIR_KERNEL),
  status:'frozen',writePolicy:'frozen',frozenAt:fairEpoch+30_000};
export const fairActions=['planet','star'].map((kind,i)=>({schemaVersion:1,generation:1,sequence:i+1,
  previousHash:'',hash:'',memberId:'historical-member',displayName:'Anonymous',acceptedAt:fairEpoch,
  intent:{id:`recorded-${kind}`,type:'launch',kind,system:'0',effectiveTick:120+i*120,seed:i+1,
    origin:[i?25000000:7000000,0],velocity:[0,1400000],design:{size:500000,palette:i}}}));
