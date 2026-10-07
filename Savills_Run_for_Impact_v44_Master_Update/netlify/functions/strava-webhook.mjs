import {db,json,env,stamp} from './_shared.mjs';
export async function handler(event){
 const q=event.queryStringParameters||{};
 if(event.httpMethod==='GET'){if(q['hub.mode']==='subscribe'&&q['hub.verify_token']===env('STRAVA_VERIFY_TOKEN'))return json(200,{'hub.challenge':q['hub.challenge']});return json(403,{error:'Invalid verification'});}
 if(event.httpMethod!=='POST')return json(405,{error:'Unsupported method'});
 try{const x=JSON.parse(event.body||'{}');if(!['activity','athlete'].includes(x.object_type)||!['create','update','delete'].includes(x.aspect_type)||!x.owner_id||!x.object_id)return json(200,{ok:true});
 const athlete=await db.doc('stravaAthletes/'+x.owner_id).get();if(!athlete.exists)return json(200,{ok:true});
 // Never trust incoming event KM: scheduled worker fetches the activity using owner's OAuth token.
 const id=x.object_type+'_'+x.object_id+'_'+x.aspect_type+'_'+(x.event_time||Date.now());await db.doc('stravaEvents/'+id).set({uid:athlete.data().uid,athleteId:String(x.owner_id),activityId:String(x.object_id),kind:x.object_type,aspect:x.aspect_type,status:'queued',createdAt:stamp.serverTimestamp()});return json(200,{ok:true});
 }catch(e){console.error('Webhook:',e.message);return json(200,{ok:false});}
}
