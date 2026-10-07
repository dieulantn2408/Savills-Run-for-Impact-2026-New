import {db,stamp} from './_shared.mjs';
import {handleEvent} from './_activity.mjs';
export const config={schedule:'*/5 * * * *'};
export default async()=>{if(process.env.AUTO_SYNC_ENABLED!=='true'||!db)return;const snap=await db.collection('stravaEvents').where('status','==','queued').limit(20).get();for(const doc of snap.docs){try{const result=await handleEvent(doc.data());await doc.ref.update({...result,processedAt:result.status==='processed'?stamp.serverTimestamp():null});if(result.reason==='Strava rate limit'||result.reason==='Strava rate limit on GPS streams')break;}catch(e){console.error('Strava event',doc.id,e);await doc.ref.update({status:'review',reason:String(e.message).slice(0,250)});}}};
