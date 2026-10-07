import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, onSnapshot, getDocs, writeBatch, increment } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(err=>{
  console.warn('Firebase local persistence could not be initialized; continuing with the available Auth persistence.', err);
});

const $ = id => document.getElementById(id);
const gates = ['authGate','verificationGate','statusGate','app'];
const state = { mode:'login', user:null, member:null, isAdmin:false, members:[], week:1, selectedGoal:null, weekApprovedKm:0, goalSelectedAt:null, goalLockedUntil:null, goalCycleId:null, pendingJoinCount:0, pendingRunCount:0, unsubscribe:[], authFlowBusy:false };
const targetKms = [0,25,50,75,100]; // visual milestones; no weekly goals
let stravaStatusUnsub=null;
const roadPoints = [
  {km:0,  x:0.8,  y:84.8},
  {km:20, x:13.7, y:61.3},
  {km:40, x:31.6, y:56.9},
  {km:60, x:47.7, y:40.6},
  {km:80, x:65.8, y:38.0},
  {km:90, x:81.9, y:22.7},
  {km:100, x:99.2, y:19.8}
];
const checkpoints = roadPoints;
const requiredDomIds=['authGate','loginTab','signupTab','authForm','email','password','authSubmit','signupEmployeeFields'];
for(const id of requiredDomIds){
  if(!document.getElementById(id)) throw new Error(`Startup error: missing #${id}`);
}


function showOnly(id){gates.forEach(g=>{const el=$(g);if(!el)return;el.classList.toggle('hidden',g!==id);el.hidden=g!==id;el.style.display=g===id?'':'none';});document.body.classList.toggle('app-authenticated',id==='app');$('topActions').classList.toggle('hidden',id!=='app');}
function money(v){return new Intl.NumberFormat('vi-VN').format(Math.round(v))+' VND';}



const cubeCharacters=Array.from({length:12},(_,i)=>({id:i+1,src:`./assets/cubes/cube-${i+1}.png`,label:`Cube ${i+1}`}));
function cubeSrc(avatarId){const id=Math.max(1,Math.min(12,Number(avatarId)||1));return `./assets/cubes/cube-${id}.png`;}
function renderCharacterPicker(){
  const grid=$('characterGrid'); if(!grid)return;
  grid.innerHTML=cubeCharacters.map(c=>`<button type="button" class="character-option" data-avatar="${c.id}" aria-label="Choose ${c.label}"><span class="character-number">${c.id}</span><img src="${c.src}" alt="${c.label}"/></button>`).join('');
  grid.querySelectorAll('.character-option').forEach(btn=>btn.onclick=()=>{
    const id=Number(btn.dataset.avatar);
    $('signupAvatarId').value=String(id);
    $('selectedCharacterImg').src=cubeSrc(id);
    $('selectedCharacterName').textContent=`Cube ${id} selected`;
    $('characterPicker').classList.remove('hidden');
    $('characterGrid').classList.add('hidden');
    $('selectedCharacter').classList.remove('hidden');
  });
}
function syncPersonalCube(){const el=$('cube');if(el)el.src=cubeSrc(state.member?.avatarId);}
function isGoalCycleActive(){
  return Boolean(
    state.selectedGoal &&
    state.goalSelectedAt &&
    state.goalLockedUntil &&
    state.goalLockedUntil.getTime() > Date.now()
  );
}

function updateAdminNotice(){
  const btn=$('adminNoticeBtn');
  const badge=$('adminNoticeBadge');
  if(!btn || !badge)return;
  const total=Number(state.pendingJoinCount||0)+Number(state.pendingRunCount||0);
  btn.classList.toggle('hidden',!state.isAdmin);
  badge.textContent=total>99?'99+':String(total);
  badge.classList.toggle('hidden',total===0);
  btn.classList.toggle('has-notice',total>0);
  btn.title=total>0
    ? `${total} pending approval${total===1?'':'s'}`
    : 'No pending approvals';
}

function setSubmissionCycleUI(){
  const active=isGoalCycleActive();
  const form=$('submissionForm');
  const submit=$('submitProofBtn');
  const status=$('submissionCycleStatus');
  if(!form || !submit || !status)return;

  form.querySelectorAll('input, textarea').forEach(el=>el.disabled=!active);
  submit.disabled=!active;

  if(active){
    status.className='cycle-status active';
    status.textContent=`Submission window open until ${formatDateTime(state.goalLockedUntil)} for your ${state.selectedGoal} KM goal.`;
    setRunDateLimits();
  }else{
    status.className='cycle-status expired';
    status.textContent='No active goal cycle. Start a new 7-day goal to submit proof.';
  }
}

function positionForRoadKm(trackKm){
  const km=Math.max(0,Math.min(100,Number(trackKm||0)));
  let prev=roadPoints[0],next=roadPoints[1];
  if(km>=100){
    prev=next=roadPoints[roadPoints.length-1];
  }else{
    for(let i=1;i<roadPoints.length;i++){
      if(km<=roadPoints[i].km){
        prev=roadPoints[i-1];
        next=roadPoints[i];
        break;
      }
    }
  }
  const span=Math.max(1,next.km-prev.km);
  const t=prev===next?1:Math.max(0,Math.min(1,(km-prev.km)/span));
  return {
    x:prev.x+(next.x-prev.x)*t,
    y:prev.y+(next.y-prev.y)*t
  };
}
function positionForCommunityKm(programKm){
  const mapped=Math.max(0,Math.min(50000,Number(programKm||0)));
  const base=positionForRoadKm((mapped/50000)*100);
  const x=base.x*0.87;
  const y=32+(base.y*0.58);
  return {x,y};
}



function bindCommunityRunnerInteractions(){
  document.querySelectorAll('.community-runner').forEach(el=>{
    el.onclick=e=>{
      e.stopPropagation();
      const wasOpen=el.classList.contains('show-name');
      document.querySelectorAll('.community-runner.show-name').forEach(x=>x.classList.remove('show-name'));
      if(!wasOpen) el.classList.add('show-name');
    };
  });

  const track=$('communityTrack');
  if(track){
    track.onclick=()=>{
      document.querySelectorAll('.community-runner.show-name').forEach(x=>x.classList.remove('show-name'));
    };
  }
}

function stableHash(value=''){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function renderCommunityJourney(members=[]){
  const host=$('communityMarkers'),summary=$('communitySummary'),milestones=$('communityMilestones');if(!host)return;
  summary.textContent=`${members.length} participants moving`;
  milestones.innerHTML=[0,25,50,75,100].map(k=>{const p=positionForCommunityKm(k/100*50000);return `<div class="community-milestone ${k===0?'start':k===100?'finish':''}" style="left:${p.x}%;top:${p.y}%"><span class="milestone-board">${k} KM</span><i class="milestone-post"></i></div>`;}).join('');
  host.innerHTML=members.slice(0,1000).map((m,i)=>{const km=Math.max(0,Number(m.totalApprovedKm||0));const visual=Math.min(100,km);const p=positionForCommunityKm(visual/100*50000);const h=stableHash(String(m.uid||m.id||i));const dx=((h%13)-6)*0.34,dy=(((h>>>5)%11)-5)*0.34;const left=Math.max(1,Math.min(99,p.x+dx)),top=Math.max(5,Math.min(95,p.y+dy));const avatar=Math.max(1,Math.min(12,Number(m.avatarId||1)));return `<button class="community-runner participant-cube" type="button" style="left:${left}%;top:${top}%" aria-label="${escapeHtml(m.name||'Participant')}, ${visual.toFixed(1)} KM"><div class="cube-nameplate"><strong>${escapeHtml(m.name||'Participant')}</strong><span>${escapeHtml(m.department||'')} · ${km.toFixed(1)} KM</span></div><img class="community-cube" loading="lazy" src="./assets/cubes/cube-${avatar}.png" alt=""/></button>`;}).join('');
  bindCommunityInteractions();
}
function isStravaUrl(value=''){try{const u=new URL(value);const h=u.hostname.toLowerCase();return (u.protocol==='https:'||u.protocol==='http:') && (h==='strava.com'||h.endsWith('.strava.com'));}catch{return false;}}
function currentWeek(){
  const start = new Date('2026-09-01T00:00:00+07:00');
  const now = new Date();
  return Math.min(4,Math.max(1,Math.floor((now-start)/(7*864e5))+1));
}
state.week=currentWeek();

function localDateISO(date=new Date()){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function yesterdayISO(){
  const d=new Date();
  d.setDate(d.getDate()-1);
  return localDateISO(d);
}
function formatDateTime(value){
  const d=value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
    : '';
}
function challengeRef(){
  return doc(db,'weeklyChallenges',`${state.user.uid}_goal`);
}

function authMode(mode){
  state.mode=mode;
  const signup=mode==='signup';

  $('loginTab').classList.toggle('active',!signup);
  $('signupTab').classList.toggle('active',signup);
  $('signupEmployeeFields').classList.toggle('hidden',!signup);

  if(signup){
    // Always show the character picker when Create Account is opened.
    $('characterPicker')?.classList.remove('hidden');

    // If no cube has been chosen yet, show all 12 options.
    if(!Number($('signupAvatarId')?.value||0)){
      $('characterGrid')?.classList.remove('hidden');
      $('selectedCharacter')?.classList.add('hidden');
      renderCharacterPicker();
    }
  }else{
    // Hide the picker entirely on the Login tab.
    $('characterPicker')?.classList.add('hidden');
  }

  $('authSubmit').textContent=signup?'Create Account & Request Access':'Log in';
  $('signupDisclaimer').classList.toggle('hidden',!signup);
  $('authError').classList.add('hidden');
}
$('loginTab').type='button';
$('signupTab').type='button';
$('loginTab').onclick=e=>{e.preventDefault();authMode('login');};
$('signupTab').onclick=e=>{e.preventDefault();authMode('signup');};
authMode('login');
$('authForm').onsubmit=async e=>{
  e.preventDefault();
  $('authError').classList.add('hidden');
  $('authSubmit').disabled=true;
  state.authFlowBusy=true;

  const signup=state.mode==='signup';
  $('authSubmit').textContent=signup?'Creating account…':'Logging in…';

  try{
    if(signup){
      const name=$('signupName').value.trim();
      const department=$('signupDepartment').value.trim();
      const office=$('signupOffice').value;
      const employeeId=$('signupEmployeeId').value.trim();
      if(!name || !validDepartment(department) || !['HCMC','Hanoi'].includes(office) || !employeeId){
        $('authError').textContent='Please complete your name, select a department from the list, choose HCMC or Hanoi, and enter your Employee ID.';
        $('authError').classList.remove('hidden');
        return;
      }
      const avatarId=Number($('signupAvatarId').value||0);
      if(!avatarId){
        $('authError').textContent='Please choose one cube character before creating your account.';
        $('authError').classList.remove('hidden');
        return;
      }
      let cred;
      try{
        cred=await createUserWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);
      }catch(authErr){
        $('authError').textContent=friendlyAuthError(authErr.code);
        $('authError').classList.remove('hidden');
        return;
      }

      state.user=cred.user;

      try{
        await setDoc(doc(db,'joinRequests',cred.user.uid),{
          uid:cred.user.uid,
          name,
          department,
          office,
          employeeId,
          avatarId,
          email:cred.user.email,
          status:'pending',
          createdAt:serverTimestamp(),
          updatedAt:serverTimestamp(),
          rejectionReason:''
        });

        showStatus(
          'Account created — waiting for HR approval',
          'Your account was created successfully and your employee information was sent to HR/Admin.'
        );
        listenOwnRequest();
      }catch(requestErr){
        console.error('Account created but join request failed:',requestErr);
        state.user=auth.currentUser;
        $('vName').value=$('signupName').value.trim();
        $('vDepartment').value=$('signupDepartment').value;
        $('vOffice').value=$('signupOffice').value;
        $('vEmployeeId').value=$('signupEmployeeId').value.trim();
        showOnly('verificationGate');
        $('verificationError').textContent='Your account was created successfully. Please submit the employee information below to finish the access request.';
        $('verificationError').classList.remove('hidden');
      }
      return;
    }

    // LOGIN
    let cred;
    try{
      cred=await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);
    }catch(authErr){
      $('authError').textContent=friendlyAuthError(authErr.code);
      $('authError').classList.remove('hidden');
      return;
    }

    // From here the email/password login succeeded.
    $('authSubmit').textContent='Opening campaign…';
    try{
      await routeUser(cred.user);
    }catch(routeErr){
      console.error('Signed in, but routing failed:',routeErr);
      showStatus(
        'Signed in successfully',
        'Your email and password are correct, but the campaign access screen could not load.',
        routeErr?.message||'Unknown routing error.'
      );
    }
  }finally{
    state.authFlowBusy=false;
    $('authSubmit').disabled=false;
    $('authSubmit').textContent=state.mode==='signup'?'Create account & request access':'Log in';
  }
};
function friendlyAuthError(code){const m={'auth/email-already-in-use':'This email already has an account. Choose Log in instead.','auth/invalid-credential':'Email or password is incorrect.','auth/weak-password':'Password must be at least 6 characters.','auth/invalid-email':'Please enter a valid email.'};return m[code]||'Unable to continue. '+code;}
$('logoutBtn').onclick=()=>signOut(auth);$('statusLogoutBtn').onclick=async()=>{await signOut(auth);showOnly('authGate');authMode('login');};$('cubeBackBtn').onclick=()=>{$('selectedCharacter').classList.add('hidden');$('characterGrid').classList.remove('hidden');$('signupAvatarId').value='';};
$('adminNoticeBtn').onclick=()=>{if(state.isAdmin)switchView('admin');};

async function routeUser(user){
  cleanup();
  state.user=user;
  state.member=null;
  state.isAdmin=false;
  state.members=[];
  state.activities=[];
  state.selectedGoal=null;
  state.weekApprovedKm=0;
  state.goalSelectedAt=null;
  state.goalLockedUntil=null;
  state.goalCycleId=null;
  state.pendingJoinCount=0;
  state.pendingRunCount=0;

  if(!user){
    showOnly('authGate');
    return;
  }

  // Authentication has already succeeded at this point.
  // Access checks are independent so one Firestore read cannot incorrectly
  // turn a successful login into a generic "login failed" experience.
  const [adminResult, memberResult, requestResult] = await Promise.allSettled([
    getDoc(doc(db,'admins',user.uid)),
    getDoc(doc(db,'members',user.uid)),
    getDoc(doc(db,'joinRequests',user.uid))
  ]);

  const adminSnap = adminResult.status==='fulfilled' ? adminResult.value : null;
  const memberSnap = memberResult.status==='fulfilled' ? memberResult.value : null;
  const requestSnap = requestResult.status==='fulfilled' ? requestResult.value : null;

  if(adminResult.status==='rejected') console.warn('Admin access read failed:',adminResult.reason);
  if(memberResult.status==='rejected') console.warn('Member access read failed:',memberResult.reason);
  if(requestResult.status==='rejected') console.warn('Join request read failed:',requestResult.reason);

  // Admin has priority and may optionally also have a member profile.
  if(adminSnap?.exists()){
    state.isAdmin=true;
    if(memberSnap?.exists()) state.member=memberSnap.data();
    showOnly('app');
    setupApp();
    if(!state.isAdmin)watchStravaConnection();
    return;
  }

  // An approved member profile is sufficient to enter the participant dashboard.
  // This remains true even if an old joinRequests document is stale.
  if(memberSnap?.exists()){
    state.member=memberSnap.data();
    showOnly('app');
    setupApp();
    if(!state.isAdmin)watchStravaConnection();
    return;
  }

  // Account exists in Firebase Auth but has not completed employee verification.
  if(requestSnap?.exists()){
    const r=requestSnap.data();

    if(r.status==='pending'){
      showStatus(
        'Account created - waiting for approval',
        'Your account is signed in successfully. Your employee information is waiting for approval.'
      );
      listenOwnRequest();
      return;
    }

    if(r.status==='rejected'){
      showStatus(
        'Your request needs an update',
        'Your account is signed in successfully, but HR asked you to update your employee information.',
        r.rejectionReason||'Please check your employee information.',
        true
      );
      return;
    }

    if(r.status==='approved'){
      showStatus(
        'Account approved — profile missing',
        'HR approval is recorded, but the participant profile was not created. Please ask HR/Admin to approve the request again.'
      );
      return;
    }
  }

  // If all three Firestore reads failed, expose the real access problem.
  const failures=[adminResult,memberResult,requestResult].filter(x=>x.status==='rejected');
  if(failures.length===3){
    const first=failures[0].reason;
    showStatus(
      'Signed in, but campaign access could not be checked',
      'Firebase Authentication succeeded, but Firestore blocked the access check.',
      first?.message||'Missing or insufficient permissions.'
    );
    return;
  }

  // New authenticated account with no join request yet.
  showOnly('verificationGate');
}
function showStatus(title,text,reason='',resubmit=false){showOnly('statusGate');$('statusTitle').textContent=title;$('statusText').textContent=text;$('statusReason').textContent=reason;$('statusReason').classList.toggle('hidden',!reason);$('resubmitBtn').classList.toggle('hidden',!resubmit);}
function listenOwnRequest(){
  const unsubRequest=onSnapshot(doc(db,'joinRequests',state.user.uid),async snap=>{
    if(!snap.exists())return;
    const data=snap.data();

    if(data.status==='rejected'){
      showStatus(
        'Your request needs an update',
        'HR reviewed your request. Update the details and submit again.',
        data.rejectionReason||'Please check your employee information.',
        true
      );
      return;
    }

    if(data.status==='approved'){
      // Batch approval creates member profile atomically. Route again immediately.
      await routeUser(state.user);
    }
  });

  const unsubMember=onSnapshot(doc(db,'members',state.user.uid),async snap=>{
    if(snap.exists()){
      await routeUser(state.user);
    }
  });

  state.unsubscribe.push(unsubRequest,unsubMember);
}
$('resubmitBtn').onclick=async()=>{const s=await getDoc(doc(db,'joinRequests',state.user.uid));if(s.exists()){const d=s.data();$('vName').value=d.name||'';$('vDepartment').value=d.department||'';$('vOffice').value=d.office||'';$('vEmployeeId').value=d.employeeId||'';state.pendingAvatarId=Number(d.avatarId||1);}showOnly('verificationGate');};
$('verificationForm').onsubmit=async e=>{e.preventDefault();$('verificationError').classList.add('hidden');if(!validDepartment($('vDepartment').value)||!['HCMC','Hanoi'].includes($('vOffice').value)){$('verificationError').textContent='Please select a department from the list and choose HCMC or Hanoi.';$('verificationError').classList.remove('hidden');return;}const uid=state.user.uid;const ref=doc(db,'joinRequests',uid);const existing=await getDoc(ref);const payload={uid,name:$('vName').value.trim(),department:$('vDepartment').value,office:$('vOffice').value,employeeId:$('vEmployeeId').value.trim(),avatarId:Number(state.pendingAvatarId||1),email:state.user.email,status:'pending',updatedAt:serverTimestamp(),rejectionReason:''};try{if(existing.exists())await updateDoc(ref,payload);else await setDoc(ref,{...payload,createdAt:serverTimestamp()});showStatus('Account created - waiting for approval','Your employee details have been submitted. HR approval is manual. You only need to do this once.');listenOwnRequest();}catch(err){$('verificationError').textContent='Could not submit: '+err.message;$('verificationError').classList.remove('hidden');}};

function setupApp(){
  setUserDisplay();
  syncPersonalCube();

  const isAdminOnly=state.isAdmin && !state.member;

  if(state.isAdmin){
    $('nav').innerHTML='<button type="button" data-view="admin">BTC Admin</button>';
  }else{
    $('nav').innerHTML='';
  }

  document.querySelectorAll('#nav button').forEach(b=>{
    b.onclick=e=>{
      e.preventDefault();
      switchView(b.dataset.view);
    };
  });

  $('adminNoticeBtn').classList.toggle('hidden',!state.isAdmin);
  updateAdminNotice();

  // Admin sees dashboard + community map, but cannot create goals or submit runs.
  $('participantActions').classList.add('hidden');
  $('howCard')?.classList.toggle('hidden',state.isAdmin);
  $('stravaCard')?.classList.toggle('hidden',state.isAdmin);
  $('personalStats').classList.toggle('hidden',isAdminOnly);
  $('adminOverviewNote').classList.toggle('hidden',!state.isAdmin);

  switchView('home');

  if(state.isAdmin){
    listenAdmin();
    listenAdminCampaignOverview();
    initRfiUI();
    return;
  }

  listenCampaign();
  watchStravaConnection();
  initRfiUI();
}

function switchView(view){
  const safeView=(view==='admin' && state.isAdmin)?'admin':'home';
  $('homeView').classList.toggle('hidden',safeView!=='home');
  $('adminView').classList.toggle('hidden',safeView!=='admin');
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===safeView));
}

function cleanup(){
  if(Array.isArray(state.unsubscribe)){
    state.unsubscribe.forEach(unsub=>{
      try{
        if(typeof unsub==='function') unsub();
      }catch(err){
        console.warn('Listener cleanup warning:',err);
      }
    });
  }
  state.unsubscribe=[];
}


function renderGoalButtons(){
  $('goalButtons').innerHTML=targetKms.map(k=>`<button type="button" data-km="${k}">${k} KM</button>`).join('');

  document.querySelectorAll('#goalButtons button').forEach(b=>{
    b.onclick=()=>{
      if(isGoalCycleActive())return;
      state.selectedGoal=Number(b.dataset.km);
      document.querySelectorAll('#goalButtons button').forEach(x=>{
        x.classList.toggle('selected',x===b);
      });
      $('goalStatus').textContent=`Selected ${state.selectedGoal} KM. Confirm to start your 7-day cycle.`;
    };
  });
}

function updateGoalLockUI(data=null){
  const selectedAt=data?.selectedAt?.toDate
    ? data.selectedAt.toDate()
    : data?.selectedAt
      ? new Date(data.selectedAt)
      : null;

  let lockedUntil=data?.lockedUntil?.toDate
    ? data.lockedUntil.toDate()
    : data?.lockedUntil
      ? new Date(data.lockedUntil)
      : null;

  if(!lockedUntil && selectedAt){
    lockedUntil=new Date(selectedAt.getTime()+7*24*60*60*1000);
  }

  const target=Number(data?.targetKm||0);
  const actual=Number(data?.actualKm||0);
  const active=Boolean(target && selectedAt && lockedUntil && lockedUntil.getTime()>Date.now());

  if(active){
    state.goalSelectedAt=selectedAt;
    state.goalLockedUntil=lockedUntil;
    state.selectedGoal=target;
    state.weekApprovedKm=actual;
    state.goalCycleId=data?.cycleId || `${state.user?.uid||'user'}_${selectedAt.getTime()}`;
  }else{
    // The 7-day cycle closes whether the target was completed or not.
    // Map resets for the next cycle; full-program heart keeps the accumulated total.
    state.goalSelectedAt=null;
    state.goalLockedUntil=null;
    state.selectedGoal=null;
    state.weekApprovedKm=0;
    state.goalCycleId=null;
  }

  document.querySelectorAll('#goalButtons button').forEach(b=>{
    b.disabled=active;
    b.classList.toggle('selected',active && Number(b.dataset.km)===target);
  });

  $('saveGoalBtn').disabled=active;
  $('saveGoalBtn').textContent=active?'Goal locked':'Confirm weekly goal';

  if(active){
    $('goalStatus').textContent=
      `Active cycle: ${target} KM · ${actual.toFixed(1)} KM approved. `+
      `Goal and proof submission close on ${formatDateTime(lockedUntil)}.`;
  }else if(data && selectedAt){
    $('goalStatus').textContent=
      `Previous 7-day cycle ended at ${formatDateTime(lockedUntil)} with ${actual.toFixed(1)} / ${target} KM approved. `+
      `Choose a new goal to start the next 7-day cycle.`;
  }else{
    $('goalStatus').textContent='Choose one goal. Goal selection and proof submission stay active for exactly 7 days.';
  }

  setSubmissionCycleUI();
}

$('saveGoalBtn').onclick=async()=>{
  if(!state.selectedGoal){
    $('goalStatus').textContent='Select a goal first.';
    return;
  }

  const ref=challengeRef();
  let snap;

  try{
    snap=await getDoc(ref);
  }catch(err){
    $('goalStatus').textContent='Could not verify your current goal lock: '+err.message;
    return;
  }

  const existing=snap.exists()?snap.data():null;
  const oldSelected=existing?.selectedAt?.toDate
    ? existing.selectedAt.toDate()
    : existing?.selectedAt
      ? new Date(existing.selectedAt)
      : null;

  let oldLock=existing?.lockedUntil?.toDate
    ? existing.lockedUntil.toDate()
    : existing?.lockedUntil
      ? new Date(existing.lockedUntil)
      : null;

  if(!oldLock && oldSelected){
    oldLock=new Date(oldSelected.getTime()+7*24*60*60*1000);
  }

  if(oldLock && oldLock.getTime()>Date.now()){
    updateGoalLockUI(existing);
    return;
  }

  const chosenGoal=Number(state.selectedGoal);
  const ok=confirm(
    `Confirm ${chosenGoal} KM as your goal?\n\n`+
    `It will be locked for exactly 7 days. You cannot change it even if you reach the target early.`
  );
  if(!ok)return;

  const now=new Date();
  const lockedUntil=new Date(now.getTime()+7*24*60*60*1000);
  const cycleId=`${state.user.uid}_${now.getTime()}`;

  // Lock the UI IMMEDIATELY after confirmation.
  const optimistic={
    employeeUid:state.user.uid,
    targetKm:chosenGoal,
    status:'active',
    selectedAt:now,
    lockedUntil,
    cycleId,
    actualKm:0
  };
  updateGoalLockUI(optimistic);
  $('goalStatus').textContent=
    `Saving ${chosenGoal} KM goal… Locked until ${formatDateTime(lockedUntil)}.`;

  try{
    const payload={
      ...optimistic,
      updatedAt:serverTimestamp()
    };

    if(snap.exists()){
      await updateDoc(ref,payload);
    }else{
      await setDoc(ref,{...payload,createdAt:serverTimestamp()});
    }

    // Read back the server document so the lock displayed is the persisted lock.
    const confirmed=await getDoc(ref);
    updateGoalLockUI(confirmed.exists()?confirmed.data():optimistic);
  }catch(err){
    // Only unlock again if the server write genuinely failed.
    state.goalLockedUntil=null;
    state.selectedGoal=chosenGoal;
    document.querySelectorAll('#goalButtons button').forEach(b=>b.disabled=false);
    $('saveGoalBtn').disabled=false;
    $('goalStatus').textContent='Goal was NOT saved: '+err.message;
  }
};

function setRunDateLimits(){
  const field=$('runDate');
  if(!field)return;

  if(!isGoalCycleActive()){
    field.value='';
    return;
  }

  const today=localDateISO();
  const yesterday=yesterdayISO();
  const cycleStart=localDateISO(state.goalSelectedAt);
  const minDate=cycleStart>yesterday?cycleStart:yesterday;

  field.min=minDate;
  field.max=today;
  field.value=today>=minDate?today:minDate;
}

async function submissionsCreatedToday(){
  const q=query(collection(db,'submissions'),where('employeeUid','==',state.user.uid));
  const snap=await getDocs(q);
  const today=localDateISO();
  return snap.docs.filter(d=>{
    const created=d.data().createdAt?.toDate?.();
    return created && localDateISO(created)===today;
  }).length;
}

$('submissionForm').onsubmit=async e=>{
  e.preventDefault();
  $('submitMessage').classList.remove('hidden');

  if(!isGoalCycleActive()){
    $('submitMessage').textContent='This 7-day goal cycle has ended. Choose a new weekly goal before submitting another proof.';
    setSubmissionCycleUI();
    return;
  }

  const runDate=$('runDate').value;
  const allowed=[localDateISO(),yesterdayISO()];
  const cycleStart=localDateISO(state.goalSelectedAt);

  if(!allowed.includes(runDate) || runDate<cycleStart){
    $('submitMessage').textContent='Run date must be today or yesterday and must fall inside your active 7-day cycle.';
    return;
  }

  const proofUrl=$('proofUrl').value.trim();
  if(!isStravaUrl(proofUrl)){
    $('submitMessage').textContent='Please submit a valid Strava link only (strava.com).';
    return;
  }

  try{
    const used=await submissionsCreatedToday();
    if(used>=2){
      $('submitMessage').textContent='Daily limit reached: you can submit proof only 2 times per day.';
      return;
    }

    const payload={
      employeeUid:state.user.uid,
      employeeName:state.member.name,
      department:state.member.department,
      week:state.week,
      goalKm:Number(state.selectedGoal),
      cycleId:state.goalCycleId,
      cycleSelectedAt:state.goalSelectedAt,
      cycleLockedUntil:state.goalLockedUntil,
      km:Number($('runKm').value),
      runDate,
      proofUrl,
      note:$('runNote').value.trim(),
      status:'pending',
      createdAt:serverTimestamp(),
      reviewedAt:null,
      reviewedBy:'',
      rejectionReason:''
    };

    await setDoc(doc(collection(db,'submissions')),payload);
    $('submissionForm').reset();
    setRunDateLimits();
    $('submitMessage').textContent=`Submitted for HR review. ${used+1}/2 submissions used today.`;
    setTimeout(()=>$('submitMessage').classList.add('hidden'),6000);
  }catch(err){
    $('submitMessage').textContent='Could not submit: '+err.message;
  }
};

function listenCampaign(){
  const unsubMembers=onSnapshot(collection(db,'members'),snap=>{
    state.members=snap.docs.map(d=>({uid:d.id,...d.data()}));
    renderCampaign();
  });
  state.unsubscribe.push(unsubMembers);

  const unsubActivities=onSnapshot(collection(db,'stravaActivities'),snap=>{state.activities=snap.docs.map(d=>({id:d.id,...d.data()}));renderCampaign();},err=>console.warn('Activities:',err));state.unsubscribe.push(unsubActivities);
  const unsubMember=onSnapshot(doc(db,'members',state.user.uid),s=>{
    if(s.exists()){
      state.member=s.data();
      renderCampaign();

    }
  });
  state.unsubscribe.push(unsubMember);
}
const PERIODS=[{id:'w1',label:'Week 1',start:'2026-10-01',end:'2026-10-04'},{id:'w2',label:'Week 2',start:'2026-10-05',end:'2026-10-11'},{id:'w3',label:'Week 3',start:'2026-10-12',end:'2026-10-18'},{id:'w4',label:'Week 4',start:'2026-10-19',end:'2026-10-25'},{id:'w5',label:'Week 5',start:'2026-10-26',end:'2026-10-31'},{id:'total',label:'Total',start:'2026-10-01',end:'2026-10-31'}];
const boards={individual:{period:'total',count:10},department:{period:'total',count:10,office:'All'}};
function activityKmFor(uid,period){const p=PERIODS.find(x=>x.id===period);return (state.activities||[]).filter(x=>x.uid===uid&&x.status==='credited'&&x.runDay>=p.start&&x.runDay<=p.end).reduce((sum,x)=>sum+Number(x.creditedKm||0),0);}
function renderBoard(type){const cfg=boards[type], p=PERIODS.find(x=>x.id===cfg.period),host=$(type==='individual'?'leaderboard':'departments');if(!host)return;
  const tabHost=$(type==='individual'?'individualTabs':'departmentTabs');tabHost.innerHTML=PERIODS.map(w=>`<button type="button" data-week="${w.id}" class="${w.id===cfg.period?'active':''}">${w.label}</button>`).join('');tabHost.querySelectorAll('button').forEach(b=>b.onclick=()=>{cfg.period=b.dataset.week;cfg.count=10;renderBoard(type);});
  const now=localDateVN();const members=state.members||[];let rows=[];
  if(type==='individual'){rows=members.map(m=>({...m,km:activityKmFor(m.uid,cfg.period)})).filter(m=>m.km>0).sort((a,b)=>b.km-a.km||String(a.name).localeCompare(String(b.name)));}
  else{const groups=new Map();members.forEach(m=>{const office=displayOffice(m.office||'');if(cfg.office!=='All'&&office!==cfg.office)return;const key=(m.department||'Unknown')+'|'+office;const km=activityKmFor(m.uid,cfg.period);if(km>0){const r=groups.get(key)||{name:m.department||'Unknown',office,km:0};r.km+=km;groups.set(key,r);}});rows=[...groups.values()].sort((a,b)=>b.km-a.km||a.name.localeCompare(b.name));}
  if(now<p.start){host.innerHTML='<p class="muted">This week has not started yet.</p>';}
  else if(!rows.length){host.innerHTML='<p class="muted">No approved activities for this period yet.</p>';}
  else host.innerHTML=`<div class="table-scroll"><table class="table"><thead><tr><th>#</th><th>${type==='individual'?'Participant':'Department'}</th>${type==='individual'?'<th>Department</th>':''}<th>Office</th><th>KM</th></tr></thead><tbody>${rows.slice(0,cfg.count).map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.name||'Employee')}</td>${type==='individual'?`<td>${escapeHtml(r.department||'')}</td>`:''}<td>${escapeHtml(displayOffice(r.office||''))}</td><td><strong>${r.km.toFixed(1)}</strong></td></tr>`).join('')}</tbody></table></div>`;
  const more=$(type+'More');more.classList.toggle('hidden',rows.length<=cfg.count);more.disabled=cfg.count>=rows.length;more.textContent=cfg.count>=rows.length?'All results shown':'Show More ↓';more.onclick=()=>{cfg.count+=10;renderBoard(type);};
}
function localDateVN(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function renderCampaign(){const members=state.members||[];const mine=Number(state.member?.totalApprovedKm||0);const total=members.reduce((s,m)=>s+Number(m.totalApprovedKm||0),0);const pct=Math.min(100,total/50000*100);
  $('impactEyebrow').textContent='Collective impact';$('impactTitle').textContent='Our VND 50 million goal';$('companyKm').textContent=total.toFixed(1);$('impactDenominator').textContent=' / 50,000 KM';$('companyPct').textContent=pct.toFixed(1)+'%';$('donation').textContent=money(Math.min(50000000,total*1000));
  $('heartLevel')?.setAttribute('transform',`translate(0 ${204-173*(total>0?Math.max(8,pct):0)/100})`);document.querySelector('.heart')?.classList.toggle('has-progress',total>0);
  $('myKm').textContent=mine.toFixed(1)+' KM';$('myImpact').textContent=money(mine*1000);$('memberCount').textContent=members.length;
  const sorted=[...members].sort((a,b)=>Number(b.totalApprovedKm||0)-Number(a.totalApprovedKm||0));const rank=sorted.findIndex(m=>m.uid===state.user?.uid)+1;$('myRank').textContent=rank?'#'+rank:'—';$('motivation').textContent=`${mine.toFixed(1)} approved KM — every kilometre makes an impact!`;
  renderBoard('individual');renderBoard('department');renderCommunityJourney(members);}
function renderTrack(){const wrap=$('trackWrap');if(!wrap)return;wrap.querySelectorAll('.checkpoint').forEach(x=>x.remove());const total=Math.max(0,Number(state.member?.totalApprovedKm||0));const segment=total>0&&total%100===0?Math.max(0,Math.ceil(total/100)-1):Math.floor(total/100);const segmentKm=total-segment*100;
  const p=positionForRoadKm(segmentKm);$('cube').style.left=p.x+'%';$('cube').style.top=p.y+'%';[0,25,50,75,100].forEach(km=>{const cp=positionForRoadKm(km);const d=document.createElement('div');d.className='checkpoint';d.style.left=cp.x+'%';d.style.top=cp.y+'%';d.textContent=(segment*100+km)+' KM';wrap.appendChild(d);});$('trackCelebration').classList.toggle('hidden',true);}
function renderAdminOverviewTrack(totalKm){
  // Preserve the original v33 personal road and runner animation; admin sees collective distance.
  const wrap=$('trackWrap');if(!wrap)return;
  wrap.querySelectorAll('.checkpoint').forEach(x=>x.remove());
  [0,10000,20000,30000,40000,50000].forEach(km=>{
    const p=positionForRoadKm(km/50000*100);
    const d=document.createElement('div');d.className='checkpoint';
    d.style.left=p.x+'%';d.style.top=p.y+'%';d.textContent=km.toLocaleString('en-US')+' KM';
    wrap.appendChild(d);
  });
  const p=positionForRoadKm(Math.min(50000,Math.max(0,Number(totalKm||0)))/50000*100);
  $('cube').style.left=p.x+'%';$('cube').style.top=p.y+'%';
  $('trackCelebration')?.classList.add('hidden');wrap.classList.remove('completed');
}

function listenAdminCampaignOverview(){const unsubMembers=onSnapshot(collection(db,'members'),snap=>{state.members=snap.docs.map(d=>({uid:d.id,...d.data()}));renderCampaign();});const unsubActivities=onSnapshot(collection(db,'stravaActivities'),snap=>{state.activities=snap.docs.map(d=>({id:d.id,...d.data()}));renderCampaign();});state.unsubscribe.push(unsubMembers,unsubActivities);}
function listenAdmin(){
  // Listen to the full collections and filter pending records client-side.
  // This avoids requiring a composite index and updates the HR dashboard immediately.
  const unsubJoin = onSnapshot(
    collection(db,'joinRequests'),
    snap=>{
      const rows=snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(r=>r.status==='pending')
        .sort((a,b)=>{
          const at=a.createdAt?.seconds||0;
          const bt=b.createdAt?.seconds||0;
          return at-bt;
        });
      state.pendingJoinCount=rows.length;
      updateAdminNotice();
      renderJoinQueue(rows);
    },
    err=>{
      console.error('Join request listener error:',err);
      $('joinQueue').innerHTML='<div class="error">Could not load employee requests: '+escapeHtml(err.message)+'</div>';
    }
  );

  const unsubRuns=onSnapshot(collection(db,'stravaActivities'),snap=>{const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.status==='review').sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||''));state.pendingRunCount=rows.length;updateAdminNotice();renderStravaReview(rows);},err=>{$('runQueue').textContent='Could not load Strava reviews: '+err.message;});
  state.unsubscribe.push(unsubJoin,unsubRuns);
}

function renderJoinQueue(rows){
  $('joinQueue').innerHTML=rows.length?rows.map(r=>`
    <div class="queue-card" data-request-card="${r.id}">
      <div class="queue-head">
        <div>
          <strong>${escapeHtml(r.name||'Employee')}</strong>
          <div class="muted">${escapeHtml(r.department||'')} · ${escapeHtml(r.office||'')}</div>
        </div>
        <span class="badge pending">Pending</span>
      </div>
      <div style="margin-top:10px">
        Employee ID: <strong>${escapeHtml(r.employeeId||'—')}</strong><br>
        ${escapeHtml(r.email||'')}
      </div>
      <div class="admin-action-message hidden" id="accountAction_${r.id}"></div>
      <div class="actions">
        <button class="primary" data-approve-user="${r.id}">✓ Approve account</button>
        <button class="danger" data-reject-user="${r.id}">✕ Reject</button>
      </div>
    </div>`).join(''):'<p class="muted">No pending access requests.</p>';

  document.querySelectorAll('[data-approve-user]').forEach(b=>b.onclick=()=>approveEmployee(b.dataset.approveUser,b));
  document.querySelectorAll('[data-reject-user]').forEach(b=>b.onclick=()=>rejectEmployee(b.dataset.rejectUser,b));
}
async function approveEmployee(uid,button){
  const msg=$('accountAction_'+uid);
  if(msg){
    msg.className='admin-action-message';
    msg.textContent='Approving…';
  }
  if(button)button.disabled=true;

  try{
    const reqRef=doc(db,'joinRequests',uid);
    const reqSnap=await getDoc(reqRef);
    if(!reqSnap.exists())throw new Error('Request document not found.');

    const r=reqSnap.data();
    if(r.status!=='pending'){
      if(msg){
        msg.className='admin-action-message';
        msg.textContent='This request is already '+r.status+'.';
      }
      return;
    }

    const memberRef=doc(db,'members',uid);
    const batch=writeBatch(db);

    batch.set(memberRef,{
      uid,
      name:r.name||'',
      department:r.department||'',
      office:r.office||'',
      employeeId:r.employeeId||'',
      avatarId:Number(r.avatarId||1),
      email:r.email||'',
      status:'approved',
      totalApprovedKm:0,
      joinedAt:serverTimestamp(),
      approvedAt:serverTimestamp(),
      approvedBy:state.user.uid
    });

    batch.update(reqRef,{
      status:'approved',
      approvedAt:serverTimestamp(),
      approvedBy:state.user.uid,
      updatedAt:serverTimestamp(),
      rejectionReason:''
    });

    await batch.commit();

    if(msg){
      msg.className='admin-action-message success';
      msg.textContent='Approved successfully. Employee access unlocked.';
    }
    // onSnapshot filters pending requests, so this card disappears automatically.
  }catch(err){
    console.error('Approve employee failed:',err);
    if(msg){
      msg.className='admin-action-message error';
      msg.textContent='Approval failed: '+(err?.message||'Unknown error');
    }
    if(button)button.disabled=false;
  }
}

async function rejectEmployee(uid,button){
  const reason=prompt('Reason for rejection:','Please check your employee information.');
  if(reason===null)return;
  if(button)button.disabled=true;
  try{
    await updateDoc(doc(db,'joinRequests',uid),{
      status:'rejected',
      rejectionReason:reason.trim()||'Please check your employee information.',
      updatedAt:serverTimestamp(),
      reviewedBy:state.user.uid
    });
  }catch(err){
    console.error('Reject employee failed:',err);
    alert('Reject failed: '+(err?.message||'Unknown error'));
    if(button)button.disabled=false;
  }
}

function renderRunQueue(rows){
  $('runQueue').innerHTML=rows.length?rows.map(r=>`
    <div class="queue-card">
      <div class="queue-head">
        <div>
          <strong>${escapeHtml(r.employeeName||'Employee')}</strong>
          <div class="muted">${escapeHtml(r.department||'')} · Week ${r.week}</div>
        </div>
        <span class="badge pending">Pending review</span>
      </div>
      <div class="queue-km">${Number(r.km).toFixed(1)} KM submitted</div>
      <div class="muted" style="margin-top:6px">Run date: ${escapeHtml(r.runDate||'—')}</div>
      ${r.note?`<div class="muted" style="margin-top:6px">Note: ${escapeHtml(r.note)}</div>`:''}
      <div style="margin-top:10px"><a href="${escapeHtml(r.proofUrl)}" target="_blank" rel="noopener">View proof ↗</a></div>
      <div class="approval-note">Approve = KM counts toward cube, rank, leaderboard and donation.</div>
      <div class="actions">
        <button class="primary" data-approve-run="${r.id}">✓ Approve KM</button>
        <button class="danger" data-reject-run="${r.id}">✕ Reject</button>
      </div>
    </div>`).join(''):'<p class="muted">No pending run submissions.</p>';
  document.querySelectorAll('[data-approve-run]').forEach(b=>b.onclick=()=>approveRun(b.dataset.approveRun));
  document.querySelectorAll('[data-reject-run]').forEach(b=>b.onclick=()=>rejectRun(b.dataset.rejectRun));
}
async function approveRun(id){
  const s=await getDoc(doc(db,'submissions',id));
  if(!s.exists())return;
  const r=s.data();
  if(r.status!=='pending')return;

  const memberRef=doc(db,'members',r.employeeUid);
  const batch=writeBatch(db);

  batch.update(doc(db,'submissions',id),{
    status:'approved',
    reviewedAt:serverTimestamp(),
    reviewedBy:state.user.uid,
    rejectionReason:''
  });

  // Full-program total always increases for the correct employee.
  batch.update(memberRef,{
    totalApprovedKm:increment(Number(r.km)),
    lastApprovedAt:serverTimestamp()
  });

  // Weekly cube increases ONLY when this submission belongs to the CURRENT goal cycle.
  const cRef=doc(db,'weeklyChallenges',`${r.employeeUid}_goal`);
  const c=await getDoc(cRef);

  if(c.exists()){
    const goal=c.data();
    const exactCycle=Boolean(r.cycleId && goal.cycleId && r.cycleId===goal.cycleId);

    // Backward compatibility for submissions created before cycleId existed.
    const created=r.createdAt?.toDate?.();
    const selected=goal.selectedAt?.toDate?.();
    const locked=goal.lockedUntil?.toDate?.();
    const legacySameCycle=Boolean(!r.cycleId && created && selected && locked && created>=selected && created<=locked);

    if(exactCycle || legacySameCycle){
      batch.update(cRef,{
        actualKm:increment(Number(r.km)),
        lastApprovedAt:serverTimestamp()
      });
    }
  }

  await batch.commit();
}
async function rejectRun(id){const reason=prompt('Reason for rejection:','Please provide a clearer proof link or check the KM submitted.');if(reason===null)return;await updateDoc(doc(db,'submissions',id),{status:'rejected',rejectionReason:reason.trim()||'Please review your submission.',reviewedAt:serverTimestamp(),reviewedBy:state.user.uid});}

function renderStravaReview(rows){const host=$('runQueue');host.innerHTML=rows.length?rows.map(r=>`<div class="review-item"><strong>${escapeHtml(r.name||r.uid||'Participant')}</strong> · ${Number(r.originalKm||0).toFixed(1)} KM · ${escapeHtml(r.type||'Activity')}<p>${escapeHtml(r.reason||'Flagged for review')}</p><p>${escapeHtml(r.runDay||'')} ${r.activityId?`· <a href="https://www.strava.com/activities/${encodeURIComponent(r.activityId)}" target="_blank" rel="noopener">View on Strava ↗</a>`:''}</p><div class="strava-actions"><button class="primary" data-review-id="${escapeHtml(r.id)}" data-decision="approve">Approve</button><button class="danger" data-review-id="${escapeHtml(r.id)}" data-decision="reject">Reject</button></div></div>`).join(''):'<p class="muted">No activities pending review.</p>';host.querySelectorAll('[data-review-id]').forEach(b=>b.onclick=async()=>{const decision=b.dataset.decision;const reason=decision==='reject'?prompt('Reason for rejection:','Activity does not meet the Fair Play Rules.'):'';if(reason===null)return;b.disabled=true;try{const token=await auth.currentUser.getIdToken();const response=await fetch('/.netlify/functions/strava-review',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({activityId:b.dataset.reviewId,decision,reason})});const d=await response.json();if(!response.ok)throw Error(d.error||'Review failed');}catch(e){alert(e.message);b.disabled=false;}});}
function initRfiUI(){document.querySelectorAll('.office-filters button').forEach(b=>b.onclick=()=>{boards.department.office=b.dataset.office;boards.department.count=10;document.querySelectorAll('.office-filters button').forEach(x=>x.classList.toggle('active',x===b));renderBoard('department');});document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>showGuide(b.dataset.guide));$('guideBack').onclick=()=>{$('guidePage').classList.add('hidden');$('howCard').classList.remove('hidden');};}
function showGuide(which){$('howCard').classList.add('hidden');$('guidePage').classList.remove('hidden');const body=$('guideBody');if(which==='device'){body.innerHTML=`<div class="eyebrow">BEGINNER-FRIENDLY GUIDE</div><h2>Ready, Set, Strava!</h2><p class="muted">No smartwatch needed. Choose your device and follow the steps below.</p><div class="device-tabs"><button data-device="phone" class="active">📱 Phone</button><button data-device="apple">⌚ Apple Watch</button><button data-device="other">⌚ Garmin / Other</button></div><div id="deviceSteps"></div><div class="tip-card"><strong>Remember</strong><p>Watch → Strava and Strava → Savills are two separate connections. Joining the Savills Strava Club is a separate step too.</p></div>`;const guides={phone:['Install Strava and create your account.','Connect Strava to the Savills website and join the company Club.','Enable GPS; choose outdoor Run or Walk, then tap Record.','Finish and Save. Check the activity in Strava; eligible KM sync automatically.'],apple:['Install Strava on your iPhone.','Use the Strava watch app, or connect Apple Health and enable workout uploads to Strava.','Connect your Strava account to Savills and join the company Club.','Record, save and confirm the activity appears in Strava.'],other:['Pair your Garmin or compatible watch with its companion app.','Connect the companion app to Strava and enable activity sharing.','Connect Strava to Savills and join the company Club.','Record your outdoor run or walk, sync your watch and check Strava.']};const draw=k=>{$('deviceSteps').innerHTML='<div class="guide-step-grid">'+guides[k].map((t,i)=>`<div class="guide-step"><b>${String(i+1).padStart(2,'0')}</b><p>${t}</p></div>`).join('')+'</div>';};body.querySelectorAll('[data-device]').forEach(b=>b.onclick=()=>{body.querySelectorAll('[data-device]').forEach(x=>x.classList.toggle('active',x===b));draw(b.dataset.device);});draw('phone');}else{body.innerHTML=`<div class="eyebrow">CHALLENGE GUIDELINES</div><h2>Run Fair. Make Every KM Count.</h2><p class="muted">Every kilometre should reflect genuine outdoor effort.</p><div class="rules-grid"><section class="rule-panel good"><h3>✓ What Counts</h3><div class="rule-tiles"><div><b>🏃 Run & Walk</b><p>Outdoor GPS activities only.</p></div><div><b>📍 GPS Route</b><p>Verifiable route and distance.</p></div><div><b>🛣 At least 1 KM</b><p>Minimum distance per activity.</p></div><div><b>⏱ At least 10 min</b><p>Minimum duration.</p></div></div></section><section class="rule-panel bad"><h3>✕ What Doesn't Count</h3><div class="rule-tiles"><div><b>✎ Manual entries</b><p>No verifiable GPS route.</p></div><div><b>⧉ Duplicates</b><p>One activity counts once.</p></div><div><b>🚗 Vehicle-assisted</b><p>No motorized travel.</p></div><div><b>👤 Someone else's activity</b><p>Record only your own effort.</p></div></div></section></div><section class="rule-panel review"><h3>⚑ When an Activity Needs Review</h3><p>GPS jumps, unusual route data or edits are flagged for BTC review. No fixed pace threshold is used during the pilot. A flagged activity remains Pending Review and does not add KM until approved.</p><p>Approved late activities count toward the week in which they started (Vietnam time). Deleted activities are removed from credited KM.</p></section>`;}window.scrollTo({top:0,behavior:'smooth'});}
onAuthStateChanged(auth,user=>{
  if(state.authFlowBusy)return;

  if(!user){
    cleanup();
    state.user=null;
    state.member=null;
    state.isAdmin=false;
    state.members=[];
    state.selectedGoal=null;
    state.weekApprovedKm=0;
    state.goalSelectedAt=null;
    state.goalLockedUntil=null;
    state.goalCycleId=null;
    state.pendingJoinCount=0;
    state.pendingRunCount=0;

    $('nav').innerHTML='';
    $('adminNoticeBtn').classList.add('hidden');
    $('adminNoticeBadge').classList.add('hidden');

    showOnly('authGate');
    authMode('login');
    return;
  }

  if(state.user?.uid===user.uid && !$('app').classList.contains('hidden'))return;

  routeUser(user).catch(err=>{
    console.error('Persistent-session routing failed:',err);
    showStatus(
      'Signed in successfully',
      'Your Firebase session is active, but campaign access could not be loaded.',
      err?.message||'Unknown routing error.'
    );
  });
});

// Strava OAuth: authenticated start endpoint; tokens never enter the browser.
function watchStravaConnection(){
  if(stravaStatusUnsub){stravaStatusUnsub();stravaStatusUnsub=null;}
  if(!state.user || !state.member || state.isAdmin)return;
  stravaStatusUnsub=onSnapshot(doc(db,'stravaConnections',state.user.uid),snap=>{
    const connected=snap.exists() && snap.data().status==='connected';
    const status=$('stravaStatus'); if(status)status.textContent=connected?'✓ Strava Connected — Your Strava account is successfully connected.':'Strava not connected — Connect your Strava account to get started.';
    $('stravaConnectBtn').disabled=connected;$('stravaConnectBtn').textContent=connected?'✓ Strava Connected':'Connect with Strava';
    $('stravaDisconnectBtn')?.classList.toggle('hidden',!connected);
  },()=>{if($('stravaStatus'))$('stravaStatus').textContent='Connection status unavailable. Check setup and Firestore rules.';});
  const result=new URLSearchParams(location.search).get('strava');
  if(result){if($('stravaStatus'))$('stravaStatus').textContent=result==='connected'?'Strava connected successfully.':'Strava connection was not completed.';history.replaceState(null,'',location.pathname);}
}
$('stravaConnectBtn').onclick=async()=>{
  if(!$('stravaConsent').checked){$('stravaStatus').textContent='Please review and accept the Strava data consent first.';return;}
  try{
    $('stravaStatus').textContent='Starting secure Strava connection…';
    const token=await auth.currentUser.getIdToken();
    const res=await fetch('/.netlify/functions/strava-start',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
    const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{throw Error(res.status===404?'Strava server function is missing. Deploy via Git or Netlify CLI with Functions enabled.':'Strava server returned an invalid response (HTTP '+res.status+'). Check Netlify Function logs.');}
    if(!res.ok)throw Error(data.error||'Strava server error (HTTP '+res.status+'). Check Netlify Function logs.');
    if(!data.url||!data.url.startsWith('https://www.strava.com/oauth/authorize?'))throw Error('Strava server did not return a valid authorization URL.');
    location.assign(data.url);
  }catch(e){$('stravaStatus').textContent=e.message;}
};
$('stravaDisconnectBtn').onclick=()=>{$('disconnectModal').classList.remove('hidden');};
$('disconnectCancel').onclick=()=>{$('disconnectModal').classList.add('hidden');};
$('disconnectModal').onclick=e=>{if(e.target===$('disconnectModal'))$('disconnectModal').classList.add('hidden');};
$('disconnectConfirm').onclick=async()=>{
  const btn=$('disconnectConfirm');btn.disabled=true;btn.textContent='Disconnecting…';
  try{const token=await auth.currentUser.getIdToken();const res=await fetch('/.netlify/functions/strava-disconnect',{method:'POST',headers:{Authorization:`Bearer ${token}`}});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not disconnect');$('disconnectModal').classList.add('hidden');$('stravaStatus').textContent='Your Strava account has been disconnected successfully.';}catch(e){$('stravaStatus').textContent="We couldn't disconnect your Strava account. Please try again.";}finally{btn.disabled=false;btn.textContent='Disconnect';}
};
