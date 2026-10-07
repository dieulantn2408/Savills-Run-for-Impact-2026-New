import {db,json,userFrom,origin,env,stamp} from './_shared.mjs';
import {randomBytes} from 'node:crypto';
export async function handler(event){
 if(event.httpMethod!=='POST')return json(405,{error:'POST only'});
 try{const u=await userFrom(event);const state=randomBytes(32).toString('hex');await db.doc('stravaOAuthStates/'+state).set({uid:u.uid,createdAt:stamp.serverTimestamp(),expiresAt:Date.now()+10*60*1000});
 const params=new URLSearchParams({client_id:env('STRAVA_CLIENT_ID'),redirect_uri:origin()+'/.netlify/functions/strava-callback',response_type:'code',approval_prompt:'auto',scope:'activity:read',state});return json(200,{url:'https://www.strava.com/oauth/authorize?'+params});
 }catch(e){return json(400,{error:e.message});}
}
