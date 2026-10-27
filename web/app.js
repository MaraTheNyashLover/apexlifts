/* ---------- Config ---------- */
const API = { url:'https://aoqoflvvrntrdcdbdckx.supabase.co', key:'sb_publishable_FSJ_s4_t4zSZwoWSJIYiaQ_2a3m0G0b', live:null };
const TILE_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_REF  = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTR = 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors';
const LA_IMG = { url:'la_map.jpg', bounds:[[33.68778175843937,-118.3447265625],[34.05265942137598,-117.9052734375]] };
const DEFAULT_CENTER = [33.8475,-118.1363]; // Lakewood, CA until the phone says otherwise
const CAP = () => (window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform()) ? window.Capacitor : null;
const PLUGIN = name => { const c=CAP(); return c && c.Plugins ? c.Plugins[name] : null; };
const BUNDLE_ID = 'com.gymtitles.app';
async function sha256hex(str){ const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
const randomNonce = () => { const a=new Uint8Array(24); crypto.getRandomValues(a); return [...a].map(b=>('0'+b.toString(16)).slice(-2)).join(''); };
const sb = (typeof supabase !== 'undefined') ? supabase.createClient(API.url, API.key, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}}) : null;

const LIFTS = {
  bench:{key:'bench', name:'Bench press', short:'Bench', title:'Bench King'},
  squat:{key:'squat', name:'Back squat', short:'Squat', title:'Squat King'},
  dead:{key:'dead',  name:'Deadlift',   short:'Deadlift', title:'Deadlift King'}
};
const LIFT_ORDER = ['bench','squat','dead'];
const STATE_NAMES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'Washington DC',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};

// Launch cities: real centers, gym counts within 25 km from the ingest (chains + named gyms).
const CITIES = [
  {id:'la',  name:'Los Angeles', state:'CA', lat:33.85, lon:-118.14, gyms:773},
  {id:'nyc', name:'New York', state:'NY', lat:40.73, lon:-73.95, gyms:1678},
  {id:'chi', name:'Chicago', state:'IL', lat:41.88, lon:-87.68, gyms:758},
  {id:'hou', name:'Houston', state:'TX', lat:29.76, lon:-95.37, gyms:542},
  {id:'dal', name:'Dallas', state:'TX', lat:32.78, lon:-96.80, gyms:537},
  {id:'phx', name:'Phoenix', state:'AZ', lat:33.50, lon:-112.05, gyms:631},
  {id:'atl', name:'Atlanta', state:'GA', lat:33.78, lon:-84.39, gyms:559},
  {id:'mia', name:'Miami', state:'FL', lat:25.78, lon:-80.22, gyms:584},
  {id:'col', name:'Columbus', state:'OH', lat:39.98, lon:-82.99, gyms:363},
  {id:'den', name:'Denver', state:'CO', lat:39.74, lon:-104.98, gyms:643},
  {id:'sea', name:'Seattle', state:'WA', lat:47.61, lon:-122.33, gyms:494},
  {id:'lv',  name:'Las Vegas', state:'NV', lat:36.15, lon:-115.17, gyms:387},
  {id:'phl', name:'Philadelphia', state:'PA', lat:39.97, lon:-75.16, gyms:771},
  {id:'bos', name:'Boston', state:'MA', lat:42.35, lon:-71.08, gyms:679},
  {id:'sd',  name:'San Diego', state:'CA', lat:32.78, lon:-117.12, gyms:564},
  {id:'atx', name:'Austin', state:'TX', lat:30.27, lon:-97.74, gyms:419}
];
const CITY = Object.fromEntries(CITIES.map(c=>[c.id,c]));

/* ---------- Gym store (from the database) ---------- */
const GYM = {};
let LOCAL = null;
function putGym(r){ if(!r||r.id==null) return null; const g=GYM[r.id]||(GYM[r.id]={}); Object.assign(g,r); g.id=+g.id; return g; }
const gymLabel = g => g ? (g.brand && g.city ? g.brand+' — '+g.city : g.name) : 'Unknown gym';
const gymTitle = g => g.brand || g.name;
const gymSub = g => g.city||'';
function distKm(aLat,aLon,bLat,bLon){ const dLat=(bLat-aLat)*111, dLon=(bLon-aLon)*111*Math.cos(aLat*Math.PI/180); return Math.hypot(dLat,dLon); }
const miles = km => (km*0.621371).toFixed(1);

async function api(path, {timeout=9000, method='GET', body=null}={}){
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),timeout);
  try{
    const headers={apikey:API.key, 'Content-Type':'application/json'};
    const tok=SESSION&&SESSION.access_token; if(tok) headers.Authorization='Bearer '+tok;
    if(method==='POST'||method==='PATCH') headers.Prefer='return=representation';
    const r=await fetch(API.url+'/rest/v1/'+path,{method, headers, body: body?JSON.stringify(body):undefined, signal:ctl.signal});
    if(!r.ok){ let m='HTTP '+r.status; try{ const j=await r.json(); m=j.message||j.msg||m; }catch(_){} throw new Error(m); }
    const txt=await r.text(); return txt?JSON.parse(txt):null;
  } finally{ clearTimeout(t); }
}
const rpc = (fn, args, opts={}) => api('rpc/'+fn, {method:'POST', body:args||{}, ...opts});
const SEL='select=id,name,brand,tier,street,city,state,zip,lat,lon';
async function loadLocal(){
  if(LOCAL) return LOCAL;
  try{ const r=await fetch('la_gyms.json'); LOCAL=await r.json(); } catch(e){ LOCAL=[]; }
  LOCAL.forEach(putGym); return LOCAL;
}
async function probe(){
  if(API.live!==null) return API.live;
  try{ await api('gyms?select=id&limit=1',{timeout:7000}); API.live=true; }
  catch(e){ API.live=false; await loadLocal(); }
  return API.live;
}
async function gymsInBox(s,w,n,e,limit=320){
  if(await probe()){
    const rows=await api(`gyms?${SEL}&lat=gte.${s}&lat=lte.${n}&lon=gte.${w}&lon=lte.${e}&tier=neq.review&order=tier.asc,confidence.desc&limit=${limit}`);
    return rows.map(putGym);
  }
  return (await loadLocal()).filter(g=>g.tier!=='review'&&g.lat>=s&&g.lat<=n&&g.lon>=w&&g.lon<=e).slice(0,limit).map(putGym);
}
async function gymById(id){
  if(GYM[id]&&GYM[id].name) return GYM[id];
  if(await probe()){ const rows=await api(`gyms?${SEL}&id=eq.${id}`); return rows.length?putGym(rows[0]):null; }
  return (await loadLocal()).find(g=>g.id===+id)||null;
}
async function searchGyms(q){
  const s=q.replace(/[%,()*]/g,' ').trim(); if(!s) return [];
  if(await probe()){
    const enc=encodeURIComponent('*'+s+'*');
    const rows=await api(`gyms?${SEL}&or=(name.ilike.${enc},city.ilike.${enc})&tier=neq.review&order=tier.asc&limit=8`);
    return rows.map(putGym);
  }
  const l=s.toLowerCase(); return (await loadLocal()).filter(g=>g.tier!=='review'&&((g.name||'').toLowerCase().includes(l)||(g.city||'').toLowerCase().includes(l))).slice(0,8).map(putGym);
}

/* ---------- Session, people, boards ---------- */
let SESSION=null;           // supabase session
let MEP=null;               // my profile row
const PEOPLE={};            // user_id -> {name,h,bw,birth_year}
const BOARD={};             // gym_id -> {rows, at}
const TITLES={};            // gym_id -> {bench:row,squat:row,dead:row}
const TCOUNT={};            // gym_id -> titles held (for pins)
const myId = () => SESSION ? SESSION.user.id : null;
function person(id, row){ const p=PEOPLE[id]||(PEOPLE[id]={name:'Lifter',h:200}); if(row){ if(row.display_name) p.name=row.display_name; if(row.avatar_hue!=null) p.h=row.avatar_hue; if(row.bodyweight_lb!=null) p.bw=row.bodyweight_lb; if(row.birth_year!=null) p.birth_year=row.birth_year; if('avatar_path' in row){ p.av=row.avatar_path||null; p.hyd=true; } if('banner_path' in row) p.banner=row.banner_path||null; if('height_in' in row) p.height=row.height_in; if('lifting_since' in row) p.since=row.lifting_since; if('body_fat_pct' in row) p.bf=row.body_fat_pct; if('home_gym_id' in row) p.home=row.home_gym_id; if('role' in row) p.role=row.role; } return p; }
const imgUrl = path => API.url+'/storage/v1/object/public/avatars/'+path;
let hydT=null;
async function hydratePeople(ids){
  const need=[...new Set(ids)].filter(id=>id && !(PEOPLE[id]&&PEOPLE[id].hyd)); if(!need.length||!API.live) return;
  need.forEach(id=>{ person(id).hyd=true; });
  try{ const rows=await api('profiles?id=in.('+need.join(',')+')&select=id,display_name,avatar_hue,avatar_path,banner_path,bodyweight_lb,birth_year,height_in,lifting_since,body_fat_pct,home_gym_id'); rows.forEach(r=>person(r.id,r)); if(rows.some(r=>r.avatar_path)){ clearTimeout(hydT); hydT=setTimeout(()=>render(false),30); } } catch(e){}
}
const MEMBERS={};
async function loadMembers(gid){
  if(MEMBERS[gid]) return MEMBERS[gid]; MEMBERS[gid]=[];
  try{ const rows=await api('profiles?home_gym_id=eq.'+gid+'&select=id,display_name,avatar_hue,avatar_path,banner_path,home_gym_id,height_in,lifting_since,body_fat_pct,bodyweight_lb,birth_year&order=created_at.asc&limit=300'); rows.forEach(r=>person(r.id,r)); MEMBERS[gid]=rows.map(r=>r.id); if(S.screen==='gym'&&S.gymId===+gid) render(false); } catch(e){}
  return MEMBERS[gid];
}
function computeTitles(gid, rows){
  const t={};
  rows.filter(r=>r.status==='approved'&&r.reps===1&&(r.home_gym_id==null||+r.home_gym_id===+gid)).forEach(r=>{ const c=t[r.lift]; if(!c || +r.weight_lb>+c.weight_lb || (+r.weight_lb===+c.weight_lb && r.recorded_at<c.recorded_at)) t[r.lift]=r; });
  TITLES[gid]=t; TCOUNT[gid]=Object.keys(t).length; return t;
}
async function loadBoard(gid, force){
  gid=+gid; const b=BOARD[gid];
  if(b && !force && Date.now()-b.at<60000) return b.rows;
  let rows=[];
  try{ if(await probe()) rows=await rpc('gym_board_v2',{p_gym_id:gid}); } catch(e){ rows=[]; }
  hydratePeople(rows.map(r=>r.user_id));
  rows.forEach(r=>{ r.gym_id=gid; person(r.user_id,r); });
  BOARD[gid]={rows, at:Date.now()}; computeTitles(gid, rows); return rows;
}
async function loadTitleCounts(ids){
  if(!ids.length || !(await probe())) return;
  try{
    const rows=await api(`gym_titles?gym_id=in.(${ids.join(',')})&select=gym_id,lift`);
    ids.forEach(id=>TCOUNT[id]=0); rows.forEach(r=>{ TCOUNT[r.gym_id]=(TCOUNT[r.gym_id]||0)+1; });
  } catch(e){}
}
const titleHolder = (gid, lift) => (TITLES[gid]||{})[lift]||null;
const heldCount = gid => TCOUNT[gid]||0;
const boardRows = gid => (BOARD[gid]||{rows:[]}).rows;
const boardLifters = gid => new Set(boardRows(gid).filter(r=>r.status==='approved').map(r=>r.user_id)).size;
const isKing = (uid, gid, lift) => { const h=titleHolder(gid,lift); return !!h && h.user_id===uid; };
const HOME = () => MEP && MEP.home_gym_id ? +MEP.home_gym_id : null;

/* ---------- My data ---------- */
const MY={ lifts:[], titles:[], notes:[], friends:null, at:0 };
async function loadFriends(force){
  if(!myId()) { MY.friends=null; return; } if(MY.friends && !force && Date.now()-(MY.friendsAt||0)<30000) return MY.friends;
  try{ const rows=await api('friendships?select=*&order=created_at.desc'); MY.friends=rows||[]; MY.friendsAt=Date.now(); hydratePeople(rows.map(r=>r.requester===myId()?r.addressee:r.requester)); } catch(e){ MY.friends=MY.friends||[]; }
  return MY.friends;
}
const friendRel = uid => { const me=myId(); if(!me||!MY.friends) return null; return MY.friends.find(f=>(f.requester===me&&f.addressee===uid)||(f.addressee===me&&f.requester===uid))||null; };
const friendIds = () => { const me=myId(); return (MY.friends||[]).filter(f=>f.status==='accepted').map(f=>f.requester===me?f.addressee:f.requester); };
const incomingReqs = () => (MY.friends||[]).filter(f=>f.status==='pending'&&f.addressee===myId());
async function friendAction(act, uid, id){
  if(!requireAuth({screen:S.screen})) return;
  try{
    if(act==='add') await api('friendships?select=*',{method:'POST', body:{requester:myId(), addressee:uid}});
    else if(act==='accept') await api('friendships?id=eq.'+id+'&select=*',{method:'PATCH', body:{status:'accepted'}});
    else if(act==='remove'||act==='ignore'||act==='cancel') await api('friendships?id=eq.'+id,{method:'DELETE'});
    await loadFriends(true); S.lb.key=null; if(S.find) runFind();
    toast(act==='add'?'Request sent':act==='accept'?'Friend added':act==='ignore'?'Request ignored':act==='cancel'?'Request cancelled':'Friend removed'); render(false);
  } catch(e){ toast('Could not do that: '+(e.message||'')); }
}
function friendButtons(uid, big){
  if(!myId()||uid===myId()) return '';
  const r=friendRel(uid); const cls=big?'btn ':'chip ';
  if(!r) return '<button class="'+cls+(big?'btn-accent btn-block':'chip-neutral')+'" data-friend="add" data-uid="'+uid+'">'+I.plus+' Add friend</button>';
  if(r.status==='accepted') return '<button class="'+cls+(big?'btn-ghost btn-block':'chip-verified')+'" data-friend="remove" data-fid="'+r.id+'" data-uid="'+uid+'">'+I.check+' Friends</button>';
  if(r.addressee===myId()) return '<div style="display:flex;gap:8px'+(big?'':';justify-content:center')+'"><button class="'+cls+(big?'btn-accent':'chip-gold')+'" style="flex:1" data-friend="accept" data-fid="'+r.id+'" data-uid="'+uid+'">Accept</button><button class="'+cls+(big?'btn-ghost':'chip-neutral')+'" style="flex:1" data-friend="ignore" data-fid="'+r.id+'" data-uid="'+uid+'">Ignore</button></div>';
  return '<button class="'+cls+(big?'btn-ghost btn-block':'chip-neutral')+'" data-friend="cancel" data-fid="'+r.id+'" data-uid="'+uid+'">Requested · tap to cancel</button>';
}
async function loadMine(force){
  if(!myId()) return; if(!force && Date.now()-MY.at<30000) return;
  try{
    const [lifts, titles, notes] = await Promise.all([
      api(`lifts?user_id=eq.${myId()}&select=*,gyms(id,name,brand,city,state)&order=recorded_at.desc&limit=100`),
      api(`gym_titles?user_id=eq.${myId()}&select=gym_id,lift,weight_lb`),
      api(`notifications?user_id=eq.${myId()}&select=id,kind,title,body,gym_id,actor_id,read_at,created_at&order=created_at.desc&limit=20`),
      loadFriends(true)
    ]);
    MY.lifts=lifts||[]; MY.titles=titles||[]; MY.notes=notes||[]; MY.at=Date.now();
    MY.lifts.forEach(l=>{ if(l.gyms) putGym(l.gyms); });
  } catch(e){}
}
const myBest = lift => MY.lifts.filter(l=>l.lift===lift&&l.status==='approved'&&l.reps===1).sort((a,b)=>b.weight_lb-a.weight_lb)[0]||null;
const myPending = () => MY.lifts.filter(l=>l.status==='pending');

/* ---------- Auth ---------- */
async function initAuth(){
  if(!sb) return;
  try{ const {data}=await sb.auth.getSession(); SESSION=data.session||null; }catch(e){ SESSION=null; }
  sb.auth.onAuthStateChange((_e, s)=>{ const was=!!SESSION; SESSION=s||null; if(!!SESSION!==was) onAuthChange(); });
  if(SESSION) await loadProfile();
}
async function loadProfile(){
  if(!myId()) { MEP=null; return; }
  try{ const rows=await api(`profiles?id=eq.${myId()}&select=*`); MEP=rows[0]||null; if(MEP) person(MEP.id, MEP); } catch(e){ MEP=null; }
  if(MEP && MEP.home_gym_id) await gymById(MEP.home_gym_id);
  await loadMine(true);
  registerPush();
}
async function onAuthChange(){ if(SESSION){ await loadProfile(); } else { MEP=null; MY.lifts=[]; MY.titles=[]; } render(false); }
async function signIn(email, pass){ const {error}=await sb.auth.signInWithPassword({email, password:pass}); if(error) throw error; }
async function signUp(email, pass, name){ const {data, error}=await sb.auth.signUp({email, password:pass, options:{data:{display_name:name}}}); if(error) throw error; return data; }
async function signOut(){ try{ await sb.auth.signOut(); }catch(e){} SESSION=null; MEP=null; MY.lifts=[]; MY.titles=[]; }
async function signInWithApple(){
  const plugin=PLUGIN('SignInWithApple'); if(!plugin) throw new Error('Sign in with Apple is available in the iOS app.');
  const raw=randomNonce(); const hashed=await sha256hex(raw);
  const res=await plugin.authorize({clientId:BUNDLE_ID, redirectURI:'https://'+API.url.replace('https://','')+'/auth/v1/callback', scopes:'email name', state:randomNonce(), nonce:hashed});
  const r=res&&res.response; if(!r||!r.identityToken) throw new Error('Apple did not return a sign-in token.');
  const {data, error}=await sb.auth.signInWithIdToken({provider:'apple', token:r.identityToken, nonce:raw});
  if(error) throw error;
  // Apple only sends the name on the very first sign-in; keep it.
  const nm=[r.givenName, r.familyName&&r.familyName[0]?r.familyName[0]+'.':''].filter(Boolean).join(' ').trim();
  if(nm && data&&data.user){ try{ await api('profiles?id=eq.'+data.user.id, {method:'PATCH', body:{display_name:nm}}); }catch(e){} }
}
async function registerPush(){
  const push=PLUGIN('PushNotifications'); if(!push||!myId()) return;
  try{
    let perm=await push.checkPermissions(); if(perm.receive==='prompt') perm=await push.requestPermissions();
    if(perm.receive!=='granted') return;
    if(!registerPush.bound){ registerPush.bound=true;
      push.addListener('registration', async t=>{ try{ await api('push_tokens?on_conflict=user_id,token',{method:'POST', body:{user_id:myId(), token:t.value, platform:'ios', updated_at:new Date().toISOString()}}); }catch(e){} });
      push.addListener('pushNotificationActionPerformed', ()=>{ loadMine(true).then(()=>{ if(S.screen==='profile') render(false); }); });
    }
    await push.register();
  } catch(e){}
}
function requireAuth(next){ if(SESSION) return true; S.authNext=next; S.auth.mode='in'; S.auth.error=null; S.auth.done=null; go('auth'); return false; }

/* ---------- State ---------- */
const S = {
  screen:'discover', gymId:null, gymTab:'recent', gymLbLift:'bench',
  lb:{scope:'city', lift:'bench', bwc:'all', age:'all', open:false, rows:null, key:null, loading:false},
  submit:{step:1, lift:null, weight:'', reps:1, bw:'', gymId:null, file:null, fileUrl:null, fileSecs:null, pct:0, uploading:false, error:null, result:null, geo:null},
  search:'', searchHits:[], searching:false, video:null, videoUrl:null, videoErr:null, toast:null, city:'la', citySheet:false,
  view:{ids:[], loading:true, center:DEFAULT_CENTER.slice(), zoom:12, total:0}, featured:null,
  me:DEFAULT_CENTER.slice(), auth:{mode:'in', error:null, busy:false, done:null, done_email:null}, authNext:null,
  review:{queue:null, item:null, verdict:null, reason:'', busy:false, videoUrl:null, error:null},
  settings:{open:false, confirmDelete:false, busy:false, error:null}, report:{open:false, reason:'', done:false}
};

/* ---------- Helpers ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NOW=()=>new Date();
function fmtDate(iso){ const d=new Date(iso); return MONTHS[d.getMonth()]+' '+d.getDate()+(d.getFullYear()!==NOW().getFullYear()?', '+d.getFullYear():''); }
function ago(iso){ const d=(NOW()-new Date(iso))/86400000; if(d<1) return 'Today'; if(d<2) return 'Yesterday'; if(d<7) return Math.floor(d)+' days ago'; if(d<30) return Math.floor(d/7)+' wk ago'; return fmtDate(iso); }
function dur(s){ s=Math.max(0,Math.round(+s||0)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
const initials = n => (n||'L').split(' ').map(p=>p[0]).join('').replace('.','').slice(0,2).toUpperCase();
function av(u, size='m', king=false){ u=u||{name:'Lifter',h:200}; return '<div class="av av-'+size+(king?' king':'')+'" style="--h:'+(u.h||200)+'" aria-hidden="true">'+(u.av?'<img src="'+imgUrl(u.av)+'" alt="" loading="lazy">':initials(u.name))+'</div>'; }
const ageOf = by => by ? NOW().getFullYear()-by : null;
const W = w => (Math.round(+w*10)/10).toString();

const I = {
  crown:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9.2-4.7 3.6L12 5l-2.7 7.4L4.6 8.8 3 18zm0 2h18v1.5H3z"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
  back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  people:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/></svg>',
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  up:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  locate:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></svg>',
  camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="11" rx="2.5"/><path d="M16 11l5-3v9l-5-3"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  bench:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18M6 7v6M18 7v6M9 8.5v3M15 8.5v3"/><path d="M7 20l3-7M17 20l-3-7"/></svg>',
  squat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M6 3.5v5M18 3.5v5M9 4.5v3M15 4.5v3"/><circle cx="12" cy="9.5" r="1.6"/><path d="M12 11v3l-3.5 2.5v4M12 14l3.5 2.5v4"/></svg>',
  dead:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18M6 15.5v5M18 15.5v5M9 16.5v3M15 16.5v3"/><circle cx="12" cy="4.5" r="1.6"/><path d="M12 6.5v3M12 9.5L8.5 14M12 9.5l3.5 4.5M8.5 14v3.5M15.5 14v3.5"/></svg>',
  podium:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21V9h6v12M3 21v-7h6M15 21v-9h6v9M2.5 21h19"/></svg>',
  user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  info:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 13v6h14v-6"/></svg>',
  shield:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3z"/><path d="M8.4 12.1l2.4 2.4 4.8-5"/></svg>',
  flag:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>',
  gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  chev:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  chevd:'<svg class="chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
};
const CROWN_PATH='M3 18h18l-1.6-9.2-4.7 3.6L12 5l-2.7 7.4L4.6 8.8 3 18zm0 2h18v1.5H3z';
const verifiedChip = (t='Verified') => '<span class="chip chip-verified">'+I.check+t+'</span>';
const reviewChip = (t='Under review') => '<span class="chip chip-review">'+I.clock.replace('<svg','<svg fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"')+t+'</span>';
const rejectedChip = (t='Not approved') => '<span class="chip chip-review" style="color:#F27A6A;background:rgba(242,122,106,.14)">'+I.close.replace('<svg','<svg fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"')+t+'</span>';
const errBox = m => '<div class="info-box" style="border-color:#F27A6A;color:#F27A6A">'+I.info.replace('<svg','<svg style="fill:#F27A6A"')+'<span>'+esc(m)+'</span></div>';
const pinIcon = () => I.pin.replace('<svg','<svg fill="none" stroke="currentColor"');
const miniCrown = () => '<svg class="mini-crown" viewBox="0 0 24 24"><path d="'+CROWN_PATH+'"/></svg>';

// A lift record for thumbnails and the video modal. Normalized from board rows (lift_id) and my lifts (id).
const VIDEOS={};
function rec(r){ const id=r.lift_id||r.id; const o={lift_id:id, user_id:r.user_id, gym_id:r.gym_id!=null?+r.gym_id:null, lift:r.lift, weight_lb:+r.weight_lb, reps:r.reps||1, recorded_at:r.recorded_at, video_seconds:r.video_seconds, video_path:r.video_path, status:r.status||'approved'}; VIDEOS[id]=o; return o; }
function thumb(r, opts={}){
  const x=rec(r); const u=person(x.user_id); const cls='thumb'+(opts.cls?' '+opts.cls:'');
  const cap = opts.cap ? '<div class="cap">'+W(x.weight_lb)+' lb<small>'+LIFTS[x.lift].short+' · '+fmtDate(x.recorded_at)+'</small></div>' : '';
  const tag = opts.tag ? '<div class="tag">'+opts.tag+'</div>' : '';
  const d = opts.cap ? '' : '<span class="dur">'+dur(x.video_seconds||0)+'</span>';
  return '<button class="'+cls+'" style="--h:'+(u.h||200)+'" data-video="'+x.lift_id+'" aria-label="Play '+esc(u.name)+' '+LIFTS[x.lift].name+' '+W(x.weight_lb)+' lb"><span class="bar"></span><span class="play">'+I.play+'</span>'+tag+d+cap+'</button>';
}

/* ---------- Navigation ---------- */
function go(screen, extra={}){ if(screen!==S.screen){ S.prev=S.screen; S.sheet=null; S.homeConfirm=null; } Object.assign(S, extra); S.screen=screen; render(true); }
function render(reset){
  const sc=$('#screen'); const keep = reset ? 0 : sc.scrollTop;
  let html='';
  switch(S.screen){
    case 'discover': html=vDiscover(); break;
    case 'gym': html=vGym(); break;
    case 'leaderboards': html=vLeaderboards(); break;
    case 'submit': html=vSubmit(); break;
    case 'profile': html=vProfile(); break;
    case 'auth': html=vAuth(); break;
    case 'review': html=vReview(); break;
    case 'person': html=vPerson(); break;
    case 'ideas': html=vIdeas(); break;
  }
  if(S.screen!=='discover' && MAPEL.parentNode) PARK.appendChild(MAPEL);
  sc.innerHTML='<div class="view'+(reset?'':' noanim')+(S.screen==='discover'?' full':'')+'">'+html+'</div>'+(S.toast?'<div class="toast">'+I.check+esc(S.toast)+'</div>':'');
  if(!reset){ sc.querySelector('.view').style.animation='none'; sc.scrollTop=keep; } else sc.scrollTop=0;
  renderNav();
  if(S.screen==='discover') mountMap();
  if(S.screen==='submit' && S.submit.step===4) requestAnimationFrame(()=>document.querySelectorAll('.track i[data-w]').forEach(i=>i.style.width=i.dataset.w+'%'));
  if(S.screen==='profile') requestAnimationFrame(()=>document.querySelectorAll('.track i[data-w]').forEach(i=>i.style.width=i.dataset.w+'%'));
  const modal=$('#modal'); if(modal) modal.remove();
  if(S.sheet && MEP) document.getElementById('app').insertAdjacentHTML('beforeend', vSheet());
  if(S.homeConfirm) document.getElementById('app').insertAdjacentHTML('beforeend', vHomeConfirm());
  if(S.video) document.getElementById('app').insertAdjacentHTML('beforeend', vVideo());
  else if(S.citySheet) document.getElementById('app').insertAdjacentHTML('beforeend', vCitySheet());
}
function renderNav(){
  const tab = (S.screen==='gym'||S.screen==='person') ? 'discover' : (S.screen==='auth'||S.screen==='review'||S.screen==='ideas') ? 'profile' : S.screen;
  const b=(id,icon,label)=>'<button class="nav-btn'+(tab===id?' on':'')+'" data-nav="'+id+'" aria-label="'+label+'">'+icon+'<span>'+label+'</span></button>';
  $('#nav').innerHTML = b('discover',I.pin,'Discover')+b('leaderboards',I.podium,'Ranks')+
    '<button class="nav-submit'+(tab==='submit'?' on':'')+'" data-nav="submit" aria-label="Submit a lift">'+I.plus+'</button>'+
    b('profile',I.user,'Profile');
}
function toast(msg){ S.toast=msg; const old=$('.toast'); if(old) old.remove(); $('#screen').insertAdjacentHTML('beforeend','<div class="toast">'+I.check+esc(msg)+'</div>'); clearTimeout(toast.t); toast.t=setTimeout(()=>{S.toast=null; const t=$('.toast'); if(t) t.remove();},2400); }
const meAvatarBtn = () => '<button class="icon-btn" data-nav="profile" aria-label="Your profile" style="'+(MEP?'width:36px;height:36px;padding:0;background:none;border:0':'width:36px;height:36px')+'">'+(MEP?av(person(MEP.id),'s'):I.user)+'</button>';

/* ---------- Map (Leaflet) ---------- */
const PARK=document.createElement('div'); PARK.style.display='none'; document.body.appendChild(PARK);
const MAPEL=document.createElement('div'); MAPEL.id='map'; PARK.appendChild(MAPEL);
let MAP=null, PINS=null, MEPIN=null, loadT=null, loadSeq=0;
function initMap(){
  if(MAP) return;
  MAP=L.map(MAPEL,{attributionControl:true, minZoom:4, maxZoom:17, zoomSnap:0.5, zoomControl:false});
  L.control.zoom({position:'topright'}).addTo(MAP);
  MAP.attributionControl.setPrefix('');
  MAP.setView(S.view.center, S.view.zoom);
  if(API.live){
    const rz=L.Browser.retina?15:16;
    L.tileLayer(TILE_BASE,{maxNativeZoom:rz, maxZoom:17, detectRetina:true, attribution:TILE_ATTR}).addTo(MAP);
    L.tileLayer(TILE_REF,{maxNativeZoom:rz, maxZoom:17, detectRetina:true, pane:'tilePane'}).addTo(MAP);
  } else {
    L.imageOverlay(LA_IMG.url, LA_IMG.bounds).addTo(MAP);
    L.tileLayer('tiles/{z}/{x}/{y}.jpg',{minNativeZoom:12, maxNativeZoom:14, minZoom:11, maxZoom:16, bounds:L.latLngBounds(LA_IMG.bounds), errorTileUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', attribution:TILE_ATTR}).addTo(MAP);
    MAP.setMaxBounds(L.latLngBounds(LA_IMG.bounds).pad(0.05)); MAP.setMinZoom(11); MAP.setMaxZoom(16);
  }
  PINS=L.layerGroup().addTo(MAP);
  MEPIN=L.marker(S.me,{icon:L.divIcon({className:'mepin',html:'<i></i>',iconSize:[14,14],iconAnchor:[7,7]}),interactive:false,zIndexOffset:-100}).addTo(MAP);
  MAPEL.insertAdjacentHTML('beforeend','<div class="inview" id="inview"><i></i><span>Loading gyms…</span></div><button class="near" id="near">'+I.locate+'Near me</button>');
  MAP.on('moveend', ()=>{ S.view.center=[MAP.getCenter().lat,MAP.getCenter().lng]; S.view.zoom=MAP.getZoom(); syncCity(); scheduleLoad(); });
  MAP.on('zoomend', ()=>drawPins());
  scheduleLoad(0);
  locateOnOpen();
}
function locateOnOpen(){
  if(S.located || !API.live || !navigator.geolocation) return; S.located=true;
  navigator.geolocation.getCurrentPosition(p=>{ S.me=[p.coords.latitude,p.coords.longitude]; if(MEPIN) MEPIN.setLatLng(S.me); if(MAP){ MAP.setView(S.me, 13.5); } }, ()=>{}, {timeout:8000, maximumAge:120000});
}
function mountMap(){
  const slot=document.getElementById('mapslot'); if(!slot) return;
  if(API.live===null) return;
  slot.appendChild(MAPEL);
  if(!MAP) initMap(); else { MAP.invalidateSize(); drawPins(); }
}
function scheduleLoad(ms=250){ clearTimeout(loadT); loadT=setTimeout(loadView, ms); }
async function loadView(){
  if(!MAP) return;
  const seq=++loadSeq; const b=MAP.getBounds();
  S.view.loading=true; updateInview();
  let rows=[];
  try{ rows=await gymsInBox(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()); } catch(e){ rows=[]; }
  if(seq!==loadSeq) return;
  S.view.ids=rows.map(g=>g.id); S.view.loading=false; S.view.total=rows.length;
  await loadTitleCounts(S.view.ids);
  if(seq!==loadSeq) return;
  pickFeatured(); drawPins(); updateInview(); updateSheet();
  if(S.featured) loadBoard(S.featured).then(()=>{ if(S.screen==='discover') updateSheet(); });
}
function updateInview(){
  const el=document.getElementById('inview'); if(!el) return;
  const n=S.view.ids.length;
  el.className='inview'+(API.live===false?' off':'');
  el.innerHTML='<i></i>'+(S.view.loading?'<span>Loading gyms…</span>':'<span><b>'+n+'</b> gym'+(n===1?'':'s')+(n>=320?'+':'')+' in view'+(API.live===false?' · offline preview':'')+'</span>');
}
function pickFeatured(){
  const c=S.view.center; const ids=S.view.ids;
  if(!ids.length){ S.featured=null; return; }
  const home=HOME();
  if(home && GYM[home] && ids.includes(home) && distKm(c[0],c[1],GYM[home].lat,GYM[home].lon)<9){ S.featured=home; return; }
  S.featured = ids.slice().sort((a,b)=> heldCount(b)-heldCount(a) || distKm(c[0],c[1],GYM[a].lat,GYM[a].lon)-distKm(c[0],c[1],GYM[b].lat,GYM[b].lon))[0];
}
function drawPins(){
  if(!PINS) return; PINS.clearLayers();
  const z=MAP.getZoom(); const showLabels=z>=13.5; const showIndie=z>=11.5;
  S.view.ids.forEach(id=>{
    const g=GYM[id]; if(!g) return; const f=id===S.featured; const indie=!g.brand;
    if(indie && !showIndie && !f) return;
    const n=heldCount(id);
    const html='<div class="dot">'+I.crown+(n?'<span class="n">'+n+'</span>':'')+'</div>'+((showLabels||f)?'<div class="lbl">'+esc(g.brand?g.brand:g.name)+(f||z>=15?'<small>'+esc(g.city||'')+'</small>':'')+'</div>':'');
    const w=f?44:(indie?26:34), h=w+((showLabels||f)?28:0);
    const m=L.marker([g.lat,g.lon],{icon:L.divIcon({className:'gpin'+(f?' featured':'')+(indie?' indie':''),html,iconSize:[160,h],iconAnchor:[80,w/2]}),keyboard:true,title:gymLabel(g),zIndexOffset:f?1000:(n?200:0)});
    m.on('click',()=>openGym(id));
    m.on('keypress',e=>{ if(e.originalEvent.key==='Enter') openGym(id); });
    PINS.addLayer(m);
  });
}
function syncCity(){
  const c=S.view.center; let best=null, bd=1e9;
  CITIES.forEach(x=>{ const d=distKm(c[0],c[1],x.lat,x.lon); if(d<bd){ bd=d; best=x; } });
  S.city = bd<60 ? best.id : null;
  const pill=document.querySelector('.city-pill[data-opencity] span'); if(pill) pill.textContent = S.city ? CITY[S.city].name : 'Map';
}
function flyTo(lat,lon,zoom){ if(!MAP) return; MAP.flyTo([lat,lon], zoom, {duration:.8}); }
function openGym(id){ id=+id; S.gymId=id; S.gymTab='recent'; S.search=''; S.searchHits=[]; go('gym'); loadBoard(id).then(()=>{ if(S.screen==='gym'&&S.gymId===id) render(false); }); }

/* ---------- Discover ---------- */
function vDiscover(){
  const c=S.city?CITY[S.city]:null;
  return '<div class="discover">'+
    '<div class="map-wrap" id="mapslot"></div>'+
    '<div class="map-top">'+
      '<div class="brand"><div class="logo">'+I.crown+'Apex Lifts</div><button class="city-pill" data-opencity="1" aria-label="Change city">'+pinIcon()+'<span>'+esc(c?c.name:'Map')+'</span>'+I.chevd+'</button>'+meAvatarBtn()+'</div>'+
      '<label class="search">'+I.search+'<input id="search" type="search" placeholder="Search gyms or cities" value="'+esc(S.search)+'" autocomplete="off" aria-label="Search gyms or cities"></label><div id="sresults">'+searchResultsHtml()+'</div>'+
    '</div>'+
    '<div class="sheet" id="sheet">'+sheetHtml()+'</div>'+
  '</div>';
}
function searchResultsHtml(){
  const q=S.search.trim().toLowerCase(); if(!q) return '';
  const cityHits = CITIES.filter(x=>(x.name+' '+x.state+' '+STATE_NAMES[x.state]).toLowerCase().includes(q)).slice(0,3);
  const gymHits = S.searchHits;
  if(!cityHits.length && !gymHits.length) return '<div class="search-results"><div class="sr"><span><b>'+(S.searching?'Searching…':'No gyms or cities match')+'</b><small>Try a gym name or a city</small></span></div></div>';
  return '<div class="search-results">'+
    cityHits.map(x=>'<button class="sr" data-city="'+x.id+'"><span class="ic ic-city">'+I.pin+'</span><span><b>'+esc(x.name)+', '+x.state+'</b><small>'+x.gyms.toLocaleString()+' gyms within 15 mi</small></span></button>').join('')+
    gymHits.map(g=>'<button class="sr" data-gym="'+g.id+'"><span class="ic">'+I.crown+'</span><span><b>'+esc(gymLabel(g))+'</b><small>'+esc((g.street?g.street+', ':'')+(g.city||'')+(g.state?', '+g.state:''))+'</small></span></button>').join('')+
  '</div>';
}
function sheetHtml(){
  const fid=S.featured; const c=S.view.center;
  if(S.view.loading && !fid) return '<div class="grab"></div><div class="loading-row"><i></i>Finding gyms near here…</div>';
  if(!fid) return '<div class="grab"></div><div class="empty" style="padding:18px 0"><b>No gyms in view</b>'+(API.live?'Zoom out or search for a city.':'This preview covers the Lakewood area.')+'</div>';
  const feat=GYM[fid]; const held=heldCount(fid); const home=fid===HOME();
  const dkm=distKm(S.me[0],S.me[1],feat.lat,feat.lon); const n=boardLifters(fid);
  const others=S.view.ids.filter(id=>id!==fid).map(id=>GYM[id]).sort((a,b)=>distKm(c[0],c[1],a.lat,a.lon)-distKm(c[0],c[1],b.lat,b.lon)).slice(0,14);
  return '<div class="grab"></div>'+
    '<div class="feat">'+
      '<div class="feat-head">'+
        '<div class="grow"><div class="eyebrow">'+(home?'Your gym · '+miles(dkm)+' mi away':'Featured · '+miles(dkm)+' mi from you')+'</div><h2>'+esc(gymLabel(feat))+'</h2><div class="sub">'+(n?n+' verified lifter'+(n===1?'':'s')+' · ':'No verified lifters yet · ')+(held===3?'3 titles up for grabs':(3-held)+' title'+(3-held>1?'s':'')+' vacant')+'</div></div>'+
        '<button class="btn btn-accent btn-sm" data-gym="'+fid+'">Title board</button>'+
      '</div>'+
      '<div class="kings">'+LIFT_ORDER.map(l=>{ const h=titleHolder(fid,l); const p=h?person(h.user_id):null; return '<button class="king-mini" data-gym="'+fid+'"><div class="top">'+I.crown+'<span>'+LIFTS[l].title+'</span></div>'+(h?'<div class="w">'+W(h.weight_lb)+'<small>LB</small></div><div class="who">'+av(p,'s')+'<span>'+esc(p.name)+'</span></div>':'<div class="w vac">Vacant</div><div class="who"><span style="color:var(--accent)">Claim it first</span></div>'); }).join('')+'</div>'+
      '<div><div class="eyebrow" style="margin-bottom:8px">Gyms in view · '+S.view.ids.length+(S.view.ids.length>=320?'+':'')+'</div><div class="nearby">'+others.map(g=>'<button class="nb" data-gym="'+g.id+'"><b>'+esc(g.name)+'</b><small>'+esc(g.city||'')+' · '+miles(distKm(S.me[0],S.me[1],g.lat,g.lon))+' mi</small><small>'+I.crown+heldCount(g.id)+'/3 titles held</small></button>').join('')+'</div></div>'+
    '</div>';
}
function updateSheet(){ const s=document.getElementById('sheet'); if(s) s.innerHTML=sheetHtml(); }
function vCitySheet(){
  return '<div class="modal" id="modal"><button class="scrim" data-closecity="1" aria-label="Close"></button><div class="city-sheet"><div class="grab"></div>'+
    '<div class="section-h" style="padding:0 16px 4px"><h3 class="h-m">Jump to a city</h3><span class="muted" style="font-size:13px">'+(API.live?'88,641 gyms nationwide':'Lakewood area preview')+'</span></div>'+
    '<div class="list" style="padding:0 16px 12px">'+CITIES.map(c=>{ const on=c.id===S.city;
      return '<button class="row city-row'+(on?' on':'')+'" data-city="'+c.id+'"><div class="grow"><div class="name"><span class="t">'+esc(c.name)+', '+c.state+'</span></div><div class="meta">'+c.gyms.toLocaleString()+' gyms within 15 mi</div></div>'+(on?'<span class="chip chip-verified">'+I.check+'Here</span>':'<span class="muted chev-ic">'+I.chev+'</span>')+'</button>'; }).join('')+
    '</div></div></div>';
}
let searchT=null, searchSeq=0;
function runSearch(){
  clearTimeout(searchT);
  const q=S.search.trim(); if(!q){ S.searchHits=[]; S.searching=false; paintSearch(); return; }
  S.searching=true; paintSearch();
  searchT=setTimeout(async()=>{ const seq=++searchSeq; let hits=[]; try{ hits=await searchGyms(q); }catch(e){} if(seq!==searchSeq) return; S.searchHits=hits; S.searching=false; paintSearch(); }, 220);
}
function paintSearch(){ const el=document.getElementById('sresults'); if(el) el.innerHTML=searchResultsHtml(); }

/* ---------- Gym profile ---------- */
function vGym(){
  const g=GYM[S.gymId];
  if(!g||!g.name){ gymById(S.gymId).then(x=>{ if(x&&S.screen==='gym'&&S.gymId==x.id){ loadBoard(x.id).then(()=>render(false)); } }); return '<div class="topbar"><button class="icon-btn" data-nav="discover" aria-label="Back to map">'+I.back+'</button></div><div class="loading-row" style="padding:16px"><i></i>Loading gym…</div>'; }
  const rows=boardRows(g.id); const loaded=!!BOARD[g.id]; const me=myId();
  const approved=rows.filter(r=>r.status==='approved'); const mine=rows.filter(r=>r.user_id===me && r.status!=='approved');
  const lifters=new Set(approved.map(r=>r.user_id)).size;
  const vacancies = LIFT_ORDER.filter(l=>!titleHolder(g.id,l)).length;
  const status = !loaded ? 'Loading board…' : vacancies ? vacancies+' title'+(vacancies>1?'s':'')+' vacant · claim one' : '3 titles up for grabs';
  const platesSvg='<svg class="plates" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="18"/><circle cx="100" cy="100" r="62" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="14"/><circle cx="100" cy="100" r="36" fill="none" stroke="rgba(240,194,90,.12)" stroke-width="10"/><circle cx="100" cy="100" r="12" fill="rgba(255,255,255,.05)"/></svg>';
  const cards = LIFT_ORDER.map(l=>{
    const h=titleHolder(g.id,l);
    const pend = mine.filter(p=>p.lift===l && p.status==='pending' && (!h || +p.weight_lb>+h.weight_lb));
    if(!h) return '<article class="title-card vacant"><div class="tc-head"><div class="tc-title">'+I.crown+LIFTS[l].title+'</div><span class="tc-lift">'+LIFTS[l].name+'</span></div><div class="tc-body" style="grid-template-columns:1fr"><div><div class="tc-weight">Vacant</div><p class="sub" style="margin:8px 0 0">No verified '+LIFTS[l].name.toLowerCase()+' at this gym yet. The first approved lift takes the crown.</p></div></div>'+(pend.length?'<div class="tc-note"><i></i>Your '+W(pend[0].weight_lb)+' lb claim is under review</div>':'')+'<div class="tc-cta"><button class="btn btn-accent" data-challenge="'+l+'" data-gymid="'+g.id+'">Claim this title</button></div></article>';
    const p=person(h.user_id);
    return '<article class="title-card">'+
      '<div class="tc-head"><div class="tc-title">'+I.crown+LIFTS[l].title+'</div><span class="tc-lift">'+LIFTS[l].name+'</span></div>'+
      '<div class="tc-body">'+
        '<div style="min-width:0"><div class="tc-champ" data-person="'+h.user_id+'">'+av(p,'m',true)+'<div style="min-width:0"><div class="nm">'+esc(p.name)+(h.user_id===me?' <span class="chip chip-you">You</span>':'')+'</div><div class="dt">Set '+fmtDate(h.recorded_at)+'</div></div></div>'+
        '<div class="tc-weight">'+W(h.weight_lb)+'<small>LB</small></div>'+
        '<div class="tc-chips">'+verifiedChip()+'<span class="chip chip-neutral">1 rep</span></div></div>'+
        thumb(h,{cls:'tc-thumb'})+
      '</div>'+
      (pend.length?'<div class="tc-note"><i></i>Your '+W(pend[0].weight_lb)+' lb challenge is under review</div>':'')+
      '<div class="tc-cta"><button class="btn btn-accent" data-challenge="'+l+'" data-gymid="'+g.id+'">'+(h.user_id===me?'Defend this title':'Challenge this title')+'</button></div>'+
    '</article>';
  }).join('');
  const tabs=[['recent','Recent lifts'],['lb','Leaderboard'],['people','Lifters']];
  let body='';
  if(!loaded) body='<div class="loading-row"><i></i>Loading lifts…</div>';
  else if(S.gymTab==='recent'){
    const recs=approved.slice(0,12);
    body='<div class="list">'+
      mine.map(p=>'<div class="row">'+thumb(p,{cls:'thumb-s'})+'<div class="grow"><div class="name"><span class="t">'+esc(person(p.user_id).name)+'</span><span class="chip chip-you">You</span></div><div class="meta">'+LIFTS[p.lift].name+' · '+p.reps+' rep'+(p.reps>1?'s':'')+' · '+ago(p.recorded_at)+'</div><div style="margin-top:4px">'+(p.status==='pending'?reviewChip():rejectedChip())+'</div></div><div class="w">'+W(p.weight_lb)+'<small>LB</small></div></div>').join('')+
      recs.map(r=>{ const u=person(r.user_id); const th=titleHolder(g.id,r.lift); const king=!!th&&th.lift_id===r.lift_id; return '<div class="row" data-person="'+r.user_id+'">'+thumb(r,{cls:'thumb-s'})+'<div class="grow"><div class="name">'+(king?miniCrown():'')+'<span class="t">'+esc(u.name)+'</span>'+(r.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="meta">'+LIFTS[r.lift].name+' · '+(r.reps>1?r.reps+' reps · ':'')+ago(r.recorded_at)+(king?' · '+LIFTS[r.lift].title:'')+'</div><div style="margin-top:4px">'+verifiedChip()+'</div></div><div class="w">'+W(r.weight_lb)+'<small>LB</small></div></div>'; }).join('')+
      (recs.length||mine.length?'':'<div class="empty"><b>No verified lifts yet</b>Be the first lifter on the board at '+esc(gymLabel(g))+'.</div>')+
    '</div>';
  } else if(S.gymTab==='lb'){
    const l=S.gymLbLift; const best={};
    approved.filter(r=>r.lift===l&&r.reps===1).forEach(r=>{ const c=best[r.user_id]; if(!c||+r.weight_lb>+c.weight_lb) best[r.user_id]=r; });
    const list=Object.values(best).sort((a,b)=>b.weight_lb-a.weight_lb||(a.recorded_at<b.recorded_at?-1:1));
    body='<div style="padding-top:12px"><div class="seg">'+LIFT_ORDER.map(k=>'<button class="'+(k===l?'on':'')+'" data-gymlb="'+k+'">'+LIFTS[k].short+'</button>').join('')+'</div></div>'+
      '<div class="list" style="margin-top:4px">'+list.map((r,i)=>{ const u=person(r.user_id); return '<div class="row'+(r.user_id===me?' me':'')+'" data-person="'+r.user_id+'"><span class="rk'+(i<3?' top3':'')+'">'+(i+1)+'</span>'+av(u,'m',i===0)+'<div class="grow"><div class="name">'+(i===0?miniCrown():'')+'<span class="t">'+esc(u.name)+'</span>'+(r.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="meta">'+(i===0?LIFTS[l].title+' · ':'')+(r.bodyweight_lb?W(r.bodyweight_lb)+' lb · ':'')+fmtDate(r.recorded_at)+'</div></div><div class="w">'+W(r.weight_lb)+'<small>LB</small></div></div>'; }).join('')+'</div>'+
      (list.length?'':'<div class="empty"><b>Nobody ranked yet</b>Submit a verified '+LIFTS[l].name.toLowerCase()+' to start the board.</div>')+
      '<div style="padding:12px 0 4px"><button class="btn btn-ghost btn-block" data-nav="leaderboards" data-lbscope="city">See city, state and national ranks</button></div>';
  } else {
    if(!MEMBERS[g.id]) loadMembers(g.id);
    const ids=[...new Set([...(MEMBERS[g.id]||[]), ...approved.map(r=>r.user_id)])];
    body='<div class="people">'+ids.map(uid=>{ const u=person(uid); const t=LIFT_ORDER.filter(l=>isKing(uid,g.id,l)); const total=LIFT_ORDER.reduce((s,l)=>{ const b=approved.filter(r=>r.user_id===uid&&r.lift===l&&r.reps===1).sort((a,c)=>c.weight_lb-a.weight_lb)[0]; return s+(b?+b.weight_lb:0); },0); return '<div class="person" data-person="'+uid+'">'+av(u,'l',t.length>0)+'<b>'+esc(u.name)+(uid===me?' (You)':'')+'</b>'+(t.length?'<span class="chip chip-gold">'+I.crown+t.map(k=>LIFTS[k].title).join(' · ')+'</span>':total?'<small>'+W(total)+' lb total</small>':'<small>Trains here</small>')+'</div>'; }).join('')+'</div>'+(ids.length?'':'<div class="empty"><b>Nobody here yet</b>Lifters who pick this as their home gym show up here.</div>');
  }
  const tierChip = g.brand ? '<span class="chip chip-neutral tier-chip">'+esc(g.brand)+'</span>' : '<span class="chip chip-neutral tier-chip">Independent</span>';
  const homeBtn = MEP ? (HOME()===g.id ? '<span class="chip chip-verified">'+I.check+'Home gym</span>' : '<button class="chip chip-neutral" data-sethome="'+g.id+'">Make this my home gym</button>') : '';
  return '<header class="gym-hero">'+platesSvg+
      '<div class="topbar"><button class="icon-btn" data-nav="discover" aria-label="Back to map">'+I.back+'</button><div class="grow"></div>'+meAvatarBtn()+'</div>'+
      '<div class="eyebrow">Title board</div><h1>'+esc(gymTitle(g))+'<small>'+esc(gymSub(g))+(g.state?', '+esc(g.state):'')+'</small></h1>'+
      '<div class="gym-meta"><span>'+pinIcon()+esc((g.street?g.street+', ':'')+(g.city||''))+'</span><span>'+I.people.replace('<svg','<svg fill="none" stroke="currentColor"')+lifters+' verified lifter'+(lifters===1?'':'s')+'</span>'+tierChip+homeBtn+'</div>'+
      '<div class="status-line"><i></i>'+status+'</div>'+
    '</header>'+
    '<div class="titles stagger">'+cards+'</div>'+
    '<section class="section"><div class="tabs">'+tabs.map(t=>'<button class="'+(S.gymTab===t[0]?'on':'')+'" data-gymtab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+body+'</section>'+
    '<div style="height:24px"></div>';
}

/* ---------- Leaderboards ---------- */
function lbKey(){ const {scope,lift}=S.lb; const c=S.city?CITY[S.city]:null; return scope+':'+lift+':'+(scope==='gym'?HOME():scope==='friends'?(myId()||'anon'):scope==='city'?(c?c.id:'map:'+S.view.center.map(x=>x.toFixed(2)).join(',')):scope==='state'?(c?c.state:'?'):'us'); }
async function ensureLb(){
  const key=lbKey(); if(S.lb.key===key && (S.lb.rows||S.lb.loading)) return;
  S.lb.key=key; S.lb.rows=null; S.lb.loading=true;
  const {scope,lift}=S.lb; const c=S.city?CITY[S.city]:null; const center=c?[c.lat,c.lon]:S.view.center;
  let rows=[];
  try{
    if(await probe()){
      if(scope==='gym' && !HOME()) rows=[];
      else if(scope==='friends'){ rows=myId()?await rpc('leaderboard_friends',{p_lift:lift, lim:100}):[]; }
      else rows=await rpc('leaderboard',{p_lift:lift, p_scope:scope, p_lat:center[0], p_lon:center[1], p_radius_m:40000, p_state:c?c.state:null, p_gym_id:HOME(), lim:100});
    }
  } catch(e){ rows=[]; }
  rows.forEach(r=>{ person(r.user_id,r); putGym({id:r.gym_id,name:r.gym_name,brand:r.gym_brand,city:r.gym_city,state:r.gym_state}); });
  hydratePeople(rows.map(r=>r.user_id));
  if(S.lb.key!==key) return;
  S.lb.rows=rows; S.lb.loading=false; if(S.screen==='leaderboards') render(false);
}
const BW_CLASSES = [
  {k:'all', l:'All weights', test:()=>true},
  {k:'u165', l:'Under 165', test:bw=>bw!=null&&bw<165},
  {k:'165', l:'165–198', test:bw=>bw>=165&&bw<198},
  {k:'198', l:'198–231', test:bw=>bw>=198&&bw<231},
  {k:'231', l:'231+', test:bw=>bw>=231}
];
const AGE_GROUPS = [
  {k:'all', l:'All ages', test:()=>true},
  {k:'u25', l:'18–24', test:a=>a!=null&&a<25},
  {k:'25', l:'25–34', test:a=>a>=25&&a<35},
  {k:'35', l:'35+', test:a=>a>=35}
];
function lbRows(){
  if(!S.lb.rows) return null; const {bwc,age}=S.lb;
  const bwT=BW_CLASSES.find(x=>x.k===bwc).test, agT=AGE_GROUPS.find(x=>x.k===age).test;
  return S.lb.rows.filter(r=>bwT(r.bodyweight_lb!=null?+r.bodyweight_lb:null)&&agT(ageOf(r.birth_year)));
}
function vLeaderboards(){
  ensureLb();
  const {scope,lift,bwc,age,open}=S.lb; const c=S.city?CITY[S.city]:null; const rows=lbRows(); const first=rows&&rows[0]; const me=myId();
  const scopeName={gym:HOME()&&GYM[HOME()]?gymLabel(GYM[HOME()]):'My gym',friends:'Friends',city:c?c.name:'Around here',state:c?STATE_NAMES[c.state]:'State',global:'United States'}[scope];
  const scopes=[['gym','My gym'],['friends','Friends'],['city','City'],['state','State'],['global','National']];
  const activeF=(bwc!=='all')+(age!=='all');
  const MAX=50; const shown=rows?rows.slice(1,MAX):[];
  let first_html;
  if(scope==='gym' && !HOME()) first_html='<div class="empty"><b>Pick a home gym</b>Open any gym\'s title board and tap "Make this my home gym".</div>';
  else if(scope==='friends' && !myId()) first_html='<div class="empty"><b>Friends board</b>Sign in and add friends to rank against them across gyms.<div style="margin-top:12px"><button class="btn btn-accent" data-nav="auth" data-authmode="in">Sign in</button></div></div>';
  else if(scope==='friends' && rows && !rows.length) first_html='<div class="empty"><b>No friends ranked yet</b>'+(friendIds().length?'None of your friends has a verified '+LIFTS[lift].name.toLowerCase()+' yet.':'Add friends from their profile or your gym\'s Lifters tab.')+'<div style="margin-top:12px"><button class="btn btn-ghost" data-sheet="find">Find friends</button></div></div>';
  else if(!rows) first_html='<div class="loading-row" style="padding:24px 16px"><i></i>Ranking '+esc(scopeName)+'…</div>';
  else if(first){ const p=person(first.user_id); const g=GYM[first.gym_id]; rec({lift_id:first.lift_id,user_id:first.user_id,gym_id:first.gym_id,lift,weight_lb:first.weight_lb,recorded_at:first.recorded_at,status:'approved'});
    first_html='<section class="lb-first"><span class="rank">#1</span><div class="crown-big">'+I.crown+'</div><div class="who" data-person="'+first.user_id+'">'+av(p,'xl',true)+'<div><div class="nm">'+esc(p.name)+(first.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="gy">'+esc(gymLabel(g))+(scope!=='gym'&&scope!=='city'?', '+esc(g.state||''):'')+'</div></div></div><div class="big">'+W(first.weight_lb)+'<small>LB</small></div><div class="foot"><span class="chip chip-gold">'+I.crown+LIFTS[lift].title+(scope==='gym'?'':' · '+esc(g.city||''))+'</span>'+verifiedChip()+'<span class="chip chip-neutral">'+fmtDate(first.recorded_at)+'</span></div></section>'; }
  else first_html='<div class="empty"><b>Nobody ranked yet</b>'+(activeF?'No verified lifts match these filters.':'The first verified '+LIFTS[lift].name.toLowerCase()+' here takes the top spot.')+'</div>';
  return '<div class="lb-top">'+
      '<div class="topbar" style="padding:0;min-height:0"><div class="grow"><div class="eyebrow">Leaderboards</div><h1 class="h-xl">'+esc(scopeName)+'</h1></div><button class="icon-btn" data-lbopen="1" aria-label="Filters" style="'+(activeF?'border-color:var(--accent);color:var(--accent)':'')+'"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button></div>'+
      '<div class="seg">'+scopes.map(x=>'<button class="'+(scope===x[0]?'on':'')+'" data-lbscope="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+
      ((scope==='city'||scope==='state')?'<div class="lb-city"><span>Ranking in</span><button class="city-pill" data-opencity="1">'+pinIcon()+'<span>'+esc(c?c.name+', '+c.state:'map area')+'</span>'+I.chevd+'</button><span>'+(rows?rows.length+' lifter'+(rows.length===1?'':'s'):'')+'</span></div>':(scope==='global'&&rows?'<div class="lb-city"><span>'+rows.length+' verified lifter'+(rows.length===1?'':'s')+' nationwide</span></div>':''))+
      '<div class="pills">'+LIFT_ORDER.map(k=>'<button class="pill'+(lift===k?' on-accent':'')+'" data-lblift="'+k+'">'+LIFTS[k].short+'</button>').join('')+'</div>'+
      (open?'<div class="filters"><div><div class="lbl">Bodyweight class</div><div class="pills">'+BW_CLASSES.map(x=>'<button class="pill'+(bwc===x.k?' on':'')+'" data-lbbw="'+x.k+'">'+x.l+'</button>').join('')+'</div></div><div><div class="lbl">Age group</div><div class="pills">'+AGE_GROUPS.map(x=>'<button class="pill'+(age===x.k?' on':'')+'" data-lbage="'+x.k+'">'+x.l+'</button>').join('')+'</div></div></div>':'')+
    '</div>'+
    first_html+
    '<div class="lb-list"><div class="list">'+shown.map((r,i)=>{ const rank=i+2; const p=person(r.user_id); const g=GYM[r.gym_id]; return '<div class="row'+(r.user_id===me?' me':'')+'" data-person="'+r.user_id+'"><span class="rk'+(rank<=3?' top3':'')+'">'+rank+'</span>'+av(p,'m')+'<div class="grow"><div class="name"><span class="t">'+esc(p.name)+'</span>'+(r.user_id===me?'<span class="chip chip-you">You</span>':'')+'</div><div class="meta">'+(scope==='gym'?(r.bodyweight_lb?W(r.bodyweight_lb)+' lb · ':'')+fmtDate(r.recorded_at):esc(gymLabel(g))+(scope!=='city'?', '+esc(g.state||''):''))+'</div></div><div class="w">'+W(r.weight_lb)+'<small>LB</small></div></div>'; }).join('')+'</div>'+
    (rows&&rows.length>MAX?'<p class="muted" style="font-size:13px;text-align:center;margin:16px 0 0">Showing the top '+MAX+' of '+rows.length+' lifters.</p>':'')+
    (rows&&rows.length>1?'<p class="muted" style="font-size:13px;text-align:center;margin:16px 0 0">Ranks count verified single-rep lifts only.</p>':'')+
    '</div>';
}

/* ---------- Submit ---------- */
function vSubmit(){
  const s=S.submit; const g=GYM[s.gymId];
  if(!g) return '<div class="pad"><div class="topbar" style="padding:0"><button class="icon-btn" data-nav="discover" aria-label="Close">'+I.close+'</button></div><div class="empty"><b>Pick a gym first</b>Open a gym\'s title board on the map and tap Claim or Challenge.</div><button class="btn btn-accent btn-block" data-nav="discover">Go to the map</button></div>';
  const holder = s.lift ? titleHolder(g.id,s.lift) : null;
  const steps='<div class="steps">'+[1,2,3,4].map(i=>'<i class="'+(i<=s.step?'on':'')+'"></i>').join('')+'</div>';
  const top=(title,sub,back)=>'<div class="topbar">'+(back?'<button class="icon-btn" data-sstep="'+back+'" aria-label="Back">'+I.back+'</button>':'<button class="icon-btn" data-gym="'+g.id+'" aria-label="Close">'+I.close+'</button>')+'<div class="grow"><div class="eyebrow">Submit a lift · Step '+s.step+' of 4</div></div></div>'+steps+'<div class="pad" style="padding-bottom:8px"><h1 class="h-xl">'+title+'</h1><p class="sub" style="margin:6px 0 0">'+sub+'</p></div>';
  if(s.step===1){
    return top('Choose your lift','Titles are decided by your heaviest verified single at this gym.')+
      '<div class="pad lift-opts" style="padding-top:8px">'+LIFT_ORDER.map(l=>{ const h=titleHolder(g.id,l); return '<button class="lift-opt'+(s.lift===l?' on':'')+'" data-slift="'+l+'"><span class="ic">'+I[l]+'</span><span style="min-width:0"><b>'+LIFTS[l].name+'</b><small>'+I.crown+(h?LIFTS[l].title+': '+esc(person(h.user_id).name)+' · '+W(h.weight_lb)+' lb':LIFTS[l].title+' is vacant')+'</small></span><span class="chk">'+I.check+'</span></button>'; }).join('')+'</div>'+
      '<div class="footer-btns"><button class="btn btn-accent" data-sstep="2" '+(s.lift?'':'disabled')+'>Continue</button></div>';
  }
  if(s.step===2){
    const w=parseFloat(s.weight)||0; const wrongGym=!!(HOME()&&HOME()!==g.id);
    return top('Enter your result','Weight on the bar. Your gym is set from the title board.')+
      '<div class="pad" style="display:flex;flex-direction:column;gap:16px;padding-top:8px">'+
        '<div class="field"><label for="w">Weight</label><div class="weight-in"><input id="w" type="number" inputmode="decimal" min="0" max="1999" step="0.5" placeholder="0" value="'+esc(s.weight)+'" data-bind="weight" autofocus><span>LB</span></div></div>'+
        '<div class="two"><div class="field"><label>Reps</label><div class="stepper"><button data-reps="-1" aria-label="Fewer reps">−</button><output id="reps">'+s.reps+'</output><button data-reps="1" aria-label="More reps">+</button></div></div>'+
        '<div class="field"><label for="bw">Bodyweight <span>optional</span></label><div class="plain-in"><input id="bw" type="number" inputmode="decimal" placeholder="lb" value="'+esc(s.bw)+'" data-bind="bw"><span>LB</span></div></div></div>'+
        '<div class="field"><label>Gym</label><div class="gym-lock"><span class="ic">'+pinIcon()+'</span><div style="min-width:0"><b>'+esc(gymLabel(g))+'</b><small>'+(g.id===HOME()?'Your home gym':(HOME()?'Not your home gym':'Becomes your home gym when you submit'))+'</small></div></div></div>'+
        (wrongGym?'<div class="info-box" style="border-color:var(--warn)">'+I.info+'<span>Your home gym is '+esc(gymLabel(GYM[HOME()]||{name:'another gym'}))+'. You rank at one gym only. To lift here, open this gym\'s title board and tap "Make this my home gym" first.</span></div>':'')+
        (holder?'<div class="target"><div style="flex:1;min-width:0"><b>'+LIFTS[s.lift].title+' to beat</b><small>'+esc(person(holder.user_id).name)+' · set '+fmtDate(holder.recorded_at)+'</small></div><div class="w">'+W(holder.weight_lb)+'<small>LB</small></div></div>':'<div class="target"><div style="flex:1"><b>'+LIFTS[s.lift].title+' is vacant</b><small>Any approved single takes the crown.</small></div></div>')+
        (s.reps>1?'<div class="info-box">'+I.info+'<span>Titles count single-rep lifts. A '+s.reps+'-rep set is logged and verified but cannot take the '+LIFTS[s.lift].title+' crown.</span></div>':'')+
      '</div>'+
      '<div class="footer-btns"><button class="btn btn-ghost" data-sstep="1">'+I.back+'</button><button class="btn btn-accent" data-sstep="3" '+(w>0&&!wrongGym?'':'disabled')+'>Continue</button></div>';
  }
  if(s.step===3){
    const fileInput='<input id="vfile" type="file" accept="video/mp4,video/quicktime,video/*" capture="environment" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none">';
    let up='';
    if(s.uploading) up='<div class="upload" style="border-style:solid"><b>Uploading…</b><div class="progress"><i style="width:'+s.pct+'%"></i></div><small>'+s.pct+'% · '+esc(s.file?s.file.name:'')+'</small></div>';
    else if(!s.file) up='<label class="upload" for="vfile" style="cursor:pointer"><span class="ic">'+I.camera+'</span><b>Record or choose lift video</b><small>MP4 or MOV, up to 150 MB. Show the plates and the full lift.</small>'+fileInput+'</label>';
    else up='<div class="card preview" style="padding:12px"><video id="vprev" src="'+esc(s.fileUrl)+'" muted playsinline preload="metadata" style="width:100%;border-radius:12px;background:#000;aspect-ratio:9/13;object-fit:cover"></video><div class="info"><b>'+esc(s.file.name)+'</b><small id="vmeta">'+(s.fileSecs?dur(s.fileSecs)+' · ':'')+(s.file.size/1048576).toFixed(0)+' MB</small><div class="checks"><span>'+I.check+'Video attached</span><span class="muted" style="font-size:12px">Location is captured when you submit</span></div><label class="btn btn-ghost btn-sm" for="vfile" style="align-self:flex-start;margin-top:4px;cursor:pointer">Replace video'+fileInput+'</label></div></div>';
    return top('Upload proof','Approved lifts earn a verified badge and can take a gym title.')+
      '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:8px">'+up+
        (s.error?errBox(s.error):'')+
        '<div class="info-box">'+I.info+'<span>Two independent reviewers check every video. Depth, lockout and plate math decide approval.</span></div>'+
        '<div class="card" style="padding:14px;display:flex;gap:12px;align-items:center">'+av(MEP?person(MEP.id):null,'m')+'<div style="min-width:0;flex:1"><div class="eyebrow">Submitting</div><div style="font-weight:600">'+LIFTS[s.lift].name+' · <span class="num" style="font-size:22px;font-weight:800">'+esc(s.weight)+'</span> lb × '+s.reps+'</div><div class="muted" style="font-size:13px">'+esc(gymLabel(g))+(s.bw?' · '+esc(s.bw)+' lb bodyweight':'')+'</div></div></div>'+
      '</div>'+
      '<div class="footer-btns"><button class="btn btn-ghost" data-sstep="2" '+(s.uploading?'disabled':'')+'>'+I.back+'</button><button class="btn btn-accent" data-submit="1" '+(s.file&&!s.uploading?'':'disabled')+'>'+(s.uploading?'Uploading…':'Submit for review')+'</button></div>';
  }
  // step 4: submitted
  const p=s.result; const h=titleHolder(p.gym_id,p.lift); const rw=+p.weight_lb; const rc=h?+h.weight_lb:0; const diff=rc-rw;
  let msg, pct, gold=false;
  if(!h){ msg='<em>Vacant title.</em> If approved, you become the first '+LIFTS[p.lift].title+' at '+esc(gymLabel(g))+'.'; pct=100; gold=true; }
  else if(p.reps>1){ msg='Logged as a '+p.reps+'-rep set. It will be verified but cannot take the '+LIFTS[p.lift].title+' title.'; pct=Math.min(100,Math.round(rw/rc*100)); }
  else if(diff>0){ msg='You are <em>'+W(diff)+' lb</em> away from the '+LIFTS[p.lift].title+' title.'; pct=Math.round(rw/rc*100); }
  else if(diff===0){ msg='You matched the '+LIFTS[p.lift].title+'. Ties go to the earlier lift, so you need more weight.'; pct=100; }
  else { msg='If approved, you take the <em class="gold">'+LIFTS[p.lift].title+'</em> title by '+W(Math.abs(diff))+' lb.'; pct=100; gold=true; }
  return '<div class="done-hero"><div class="mark">'+I.clock+'</div><div><div class="eyebrow">Submitted</div><h2>Under review</h2></div>'+reviewChip('Waiting for 2 reviewers')+'</div>'+
    '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:4px">'+
      '<div class="card gap-card"><div class="big">'+msg+'</div>'+
        '<div class="cmp"><div><span class="lbl">Your lift</span><span class="v">'+W(rw)+'<small>LB</small></span></div><div><span class="lbl">'+(h?LIFTS[p.lift].title+' · '+esc(person(h.user_id).name):'Current record')+'</span><span class="v">'+(h?W(rc):'—')+(h?'<small>LB</small>':'')+'</span></div></div>'+
        '<div class="track"><i class="'+(gold?'gold':'')+'" data-w="'+pct+'"></i>'+(h&&diff>0?'<b></b>':'')+'</div>'+
      '</div>'+
      '<div class="info-box">'+I.info+'<span>Your lift shows as pending on your profile and on this gym\'s board. Two reviewers must agree before it counts.</span></div>'+
    '</div>'+
    '<div class="footer-btns"><button class="btn btn-ghost" data-nav="profile">My profile</button><button class="btn btn-accent" data-gym="'+p.gym_id+'">Back to title board</button></div>';
}
function resetSubmit(gymId, lift){ if(S.submit.fileUrl) URL.revokeObjectURL(S.submit.fileUrl); S.submit={step:lift?2:1, lift:lift||null, weight:'', reps:1, bw:MEP&&MEP.bodyweight_lb?W(MEP.bodyweight_lb):'', gymId:gymId?+gymId:(HOME()||null), file:null, fileUrl:null, fileSecs:null, pct:0, uploading:false, error:null, result:null, geo:null}; }
function pickFile(file){
  const s=S.submit; if(!file) return;
  if(file.size>150*1048576){ s.error='That video is over 150 MB. Trim it to the lift and try again.'; render(false); return; }
  if(s.fileUrl) URL.revokeObjectURL(s.fileUrl);
  s.file=file; s.fileUrl=URL.createObjectURL(file); s.error=null; s.fileSecs=null; render(false);
  const v=document.getElementById('vprev'); if(v){ v.onloadedmetadata=()=>{ if(isFinite(v.duration)){ s.fileSecs=Math.round(v.duration); const sm=document.getElementById('vmeta'); if(sm) sm.textContent=dur(s.fileSecs)+' · '+(file.size/1048576).toFixed(0)+' MB'; } }; }
}
function getGeo(){ return new Promise(res=>{ if(!navigator.geolocation) return res(null); const t=setTimeout(()=>res(null),6000); navigator.geolocation.getCurrentPosition(p=>{ clearTimeout(t); res({lat:p.coords.latitude,lon:p.coords.longitude}); }, ()=>{ clearTimeout(t); res(null); }, {enableHighAccuracy:true, timeout:5500, maximumAge:30000}); }); }
async function submitLift(){
  const s=S.submit; if(!s.file||s.uploading) return; if(!requireAuth({screen:'submit'})) return;
  if(HOME() && HOME()!==+s.gymId){ s.error='Lifts only count at your home gym. Switch your home gym from this gym\'s title board first.'; render(false); return; }
  s.uploading=true; s.pct=0; s.error=null; render(false);
  try{
    if(!HOME()){ const out=await api('profiles?id=eq.'+MEP.id+'&select=*',{method:'PATCH', body:{home_gym_id:+s.gymId, updated_at:new Date().toISOString()}}); MEP=out[0]||MEP; S.lb.key=null; }
    const geo=await getGeo(); s.geo=geo;
    const isMov=/quicktime/i.test(s.file.type)||/\.mov$/i.test(s.file.name);
    const path=myId()+'/'+Date.now()+'_'+s.lift+'_'+String(s.weight).replace(/[^0-9.]/g,'')+(isMov?'.mov':'.mp4');
    await new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest(); xhr.open('POST', API.url+'/storage/v1/object/videos/'+path);
      xhr.setRequestHeader('apikey',API.key); xhr.setRequestHeader('Authorization','Bearer '+SESSION.access_token); xhr.setRequestHeader('Content-Type',isMov?'video/quicktime':'video/mp4');
      xhr.upload.onprogress=e=>{ if(e.lengthComputable){ s.pct=Math.round(e.loaded/e.total*100); const bar=document.querySelector('.progress i'); const lbl=document.querySelector('.upload small'); if(bar) bar.style.width=s.pct+'%'; if(lbl) lbl.textContent=s.pct+'% · '+s.file.name; } };
      xhr.onload=()=>{ if(xhr.status>=200&&xhr.status<300) resolve(); else { let m='Upload failed ('+xhr.status+')'; try{ m=JSON.parse(xhr.responseText).message||m; }catch(_){} reject(new Error(m)); } };
      xhr.onerror=()=>reject(new Error('Upload failed. Check your connection and try again.'));
      xhr.send(s.file);
    });
    const row={user_id:myId(), gym_id:+s.gymId, lift:s.lift, weight_lb:parseFloat(s.weight), reps:s.reps, bodyweight_lb:s.bw?parseFloat(s.bw):null, video_path:path, video_seconds:s.fileSecs||null, device_lat:geo?geo.lat:null, device_lon:geo?geo.lon:null};
    const out=await api('lifts?select=*',{method:'POST', body:row});
    s.result=out[0]; s.uploading=false; s.step=4;
    if(s.fileUrl){ URL.revokeObjectURL(s.fileUrl); s.fileUrl=null; }
    await Promise.all([loadBoard(+s.gymId,true), loadMine(true)]);
    render(true);
  } catch(e){ s.uploading=false; s.error=e.message||'Something went wrong. Try again.'; render(false); }
}

/* ---------- Auth screen ---------- */
function vAuth(){
  const a=S.auth; const mode=a.mode;
  const back='<div class="topbar" style="padding:0;min-height:0"><button class="icon-btn" data-nav="discover" aria-label="Back">'+I.back+'</button><div class="grow"></div></div>';
  if(a.done==='check-email') return '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:28px">'+back+'<div class="done-hero"><div class="mark" style="border-color:var(--accent);background:rgba(201,242,58,.12)">'+I.check.replace('<svg','<svg style="stroke:var(--accent)"')+'</div><div><div class="eyebrow">Almost there</div><h2>Check your email</h2></div><p class="sub">We sent a confirmation link to <b>'+esc(a.done_email||'')+'</b>. Tap it, then come back and sign in.</p></div><button class="btn btn-accent btn-block" data-authmode="in">Sign in</button></div>';
  return '<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:28px">'+back+
    '<div><img src="data:image/png;base64,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" alt="Apex Lifts" style="display:block;width:190px;height:auto"><h1 class="h-xl" style="margin-top:10px">'+(mode==='in'?'Welcome back':'Claim your gym')+'</h1><p class="sub" style="margin:6px 0 0">'+(mode==='in'?'Sign in to submit lifts and hold titles.':'One account. Every gym in the country.')+'</p></div>'+
    (PLUGIN('SignInWithApple')?'<button class="btn btn-block" data-apple="1" style="background:#fff;color:#000;gap:10px" '+(a.busy?'disabled':'')+'><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:#000;stroke:none" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.3 1.3-2.6 1.3-2.7 0 0-2.6-1-2.6-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.4z"/></svg>Continue with Apple</button><div class="muted" style="text-align:center;font-size:12px;letter-spacing:.1em;text-transform:uppercase">or use email</div>':'')+
    '<div class="seg"><button class="'+(mode==='in'?'on':'')+'" data-authmode="in">Sign in</button><button class="'+(mode==='up'?'on':'')+'" data-authmode="up">Create account</button></div>'+
    '<form id="authform" style="display:flex;flex-direction:column;gap:12px" autocomplete="on">'+
      (mode==='up'?'<div class="field"><label for="aname">Display name</label><div class="plain-in"><input id="aname" name="name" type="text" autocomplete="nickname" placeholder="Darius M." maxlength="40" required style="font-size:18px;font-weight:600;font-family:var(--font-body)"></div></div>':'')+
      '<div class="field"><label for="aemail">Email</label><div class="plain-in"><input id="aemail" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com" required style="font-size:18px;font-weight:600;font-family:var(--font-body)"></div></div>'+
      '<div class="field"><label for="apass">Password'+(mode==='up'?' <span>8+ characters</span>':'')+'</label><div class="plain-in"><input id="apass" name="password" type="password" autocomplete="'+(mode==='up'?'new-password':'current-password')+'" minlength="8" required style="font-size:18px;font-weight:600;font-family:var(--font-body)"></div></div>'+
      (a.error?errBox(a.error):'')+
      '<button class="btn btn-accent btn-block" type="submit" '+(a.busy?'disabled':'')+'>'+(a.busy?'One moment…':(mode==='in'?'Sign in':'Create account'))+'</button>'+
    '</form>'+
    (API.live===false?'<div class="info-box">'+I.info+'<span>This preview can\'t reach the server. Accounts work in the installed app.</span></div>':'')+
    '<p class="muted" style="font-size:12px;text-align:center;line-height:1.5">By continuing you agree to the <a href="https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b#terms" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Terms of Service</a> and <a href="https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b#privacy" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Privacy Policy</a>. Lift videos you submit are checked by verifiers and, once approved, shown on the gym\'s board.</p>'+
  '</div>';
}
async function handleAuth(form){
  const a=S.auth; if(a.busy) return; a.error=null; a.busy=true; render(false);
  const email=form.email.value.trim(), pass=form.password.value;
  try{
    if(!sb) throw new Error('Could not load the sign-in library.');
    if(a.mode==='in'){ await signIn(email, pass); await loadProfile(); a.busy=false; const n=S.authNext; S.authNext=null; toast('Signed in'); if(n&&n.screen==='submit'){ resetSubmit(S.submit.gymId, S.submit.lift); go('submit'); } else if(n&&n.screen) go(n.screen, n.extra||{}); else go('profile'); }
    else { const name=(form.name&&form.name.value.trim())||email.split('@')[0]; const d=await signUp(email, pass, name); a.busy=false; if(d.session){ await loadProfile(); toast('Account created'); go('profile'); } else { a.done='check-email'; a.done_email=email; render(true); } }
  } catch(e){ a.busy=false; a.error=(e.message||'Could not sign in').replace('Invalid login credentials','Wrong email or password.'); render(false); }
}

/* ---------- Profile ---------- */
const ftin = h => h ? Math.floor(h/12)+"'"+(h%12)+'"' : null;
function statsRow(u, own){
  const items=[];
  if(u.height) items.push(['Height', ftin(u.height)]);
  if(u.bw) items.push(['Weight', W(u.bw)+' lb']);
  if(u.since){ const y=NOW().getFullYear()-u.since; items.push(['Lifting', y<1?'<1 yr':y+' yr'+(y===1?'':'s')]); }
  if(u.birth_year) items.push(['Age', ageOf(u.birth_year)]);
  if(u.bf!=null) items.push(['Body fat', W(u.bf)+'%']);
  if(!items.length) return own?'<div style="padding:0 16px 12px"><button class="btn btn-ghost btn-block" data-sheet="stats">Add your stats</button></div>':'';
  return '<div class="stats-row'+(own?' editable':'')+'"'+(own?' data-sheet="stats" role="button"':'')+'>'+items.map(([k,v])=>'<div class="stat"><b>'+v+'</b><small>'+k+'</small></div>').join('')+(own?'<button class="stat stat-edit" aria-label="Edit stats">'+I.pencil+'<small>Edit</small></button>':'')+'</div>';
}
const bannerHtml = u => '<div class="banner"'+(u.banner?' style="background-image:url('+imgUrl(u.banner)+')"':'')+'></div>';
const PP={};
async function loadPerson(uid, force){
  const c=PP[uid]; if(c&&!force&&Date.now()-c.at<60000) return c;
  const [prof,bests,titles,lifts]=await Promise.all([
    api('profiles?id=eq.'+uid+'&select=*'),
    api('lifter_bests?user_id=eq.'+uid+'&select=*'),
    api('gym_titles?user_id=eq.'+uid+'&select=*'),
    SESSION?api('lifts?user_id=eq.'+uid+'&status=eq.approved&select=*&order=recorded_at.desc&limit=12').catch(()=>[]):Promise.resolve([])
  ]);
  const p=prof[0]||null; if(p) person(uid,p);
  const gids=[...new Set([p&&p.home_gym_id, ...bests.map(b=>b.gym_id), ...titles.map(t=>t.gym_id)].filter(Boolean))];
  await Promise.all(gids.map(g=>gymById(g).catch(()=>null)));
  PP[uid]={at:Date.now(), prof:p, bests, titles, lifts}; return PP[uid];
}
function vPerson(){
  const uid=S.personId; if(!uid) return vProfile();
  if(myId() && uid===myId()) return vProfile();
  const back='<div class="topbar"><button class="icon-btn" data-back="1" aria-label="Back">'+I.back+'</button><div class="grow"><div class="eyebrow">Lifter</div></div></div>';
  const d=PP[uid];
  if(!d){ loadPerson(uid).then(()=>{ if(S.screen==='person'&&S.personId===uid) render(false); }).catch(()=>{ PP[uid]={at:Date.now(),prof:null,bests:[],titles:[],lifts:[]}; render(false); }); return back+'<div class="loading-row" style="padding:40px 16px"><i></i>Loading…</div>'; }
  if(!d.prof) return back+'<div class="empty" style="padding:40px 16px"><b>Lifter not found</b>This account may have been deleted.</div>';
  const u=person(uid); const g=u.home?GYM[u.home]:null; const held=d.titles; const best=l=>d.bests.find(b=>b.lift===l);
  return back+bannerHtml(u)+
    '<div class="prof-head">'+av(u,'xl',held.length>0)+'<div><h1>'+esc(u.name)+'</h1>'+(g?'<button class="gym-link" data-gym="'+g.id+'">'+pinIcon()+esc(gymLabel(g))+' · home gym</button>':'<span class="gym-link muted">'+pinIcon()+'No home gym yet</span>')+'</div>'+
      '<div class="badges">'+held.map(t=>'<span class="badge gold">'+I.crown+LIFTS[t.lift].title+(GYM[t.gym_id]&&(!g||+t.gym_id!==g.id)?' · '+esc(GYM[t.gym_id].name):'')+'</span>').join('')+(d.bests.length?'<span class="badge lime">'+I.check+'Verified lifter</span>':'<span class="badge">No verified lifts yet</span>')+(u.role==='verifier'||u.role==='admin'?'<span class="badge lime">'+I.shield+(u.role==='admin'?'Admin':'Verifier')+'</span>':'')+'</div>'+(MEP&&MEP.role==='admin'&&u.role!=='admin'?'<div style="width:100%;max-width:320px"><button class="btn btn-ghost btn-block" data-setrole="'+(u.role==='verifier'?'lifter':'verifier')+'" data-uid="'+uid+'">'+I.shield+(u.role==='verifier'?' Remove verifier role':' Make verifier')+'</button></div>':'')+(myId()?'<div style="width:100%;max-width:320px">'+friendButtons(uid,true)+'</div>':'<button class="btn btn-ghost" data-nav="auth" data-authmode="in">Sign in to add friends</button>')+'</div>'+
    statsRow(u,false)+
    '<div class="bests" style="padding-top:4px">'+LIFT_ORDER.map(l=>{ const b=best(l); const k=held.some(t=>t.lift===l); return '<div class="best'+(k?' king':'')+'"><span class="l">'+(k?I.crown:'')+LIFTS[l].short+'</span><span class="w">'+(b?W(b.weight_lb)+'<small>LB</small>':'<span class="muted">—</span>')+'</span><small class="d">'+(b?fmtDate(b.recorded_at):'No verified single')+'</small></div>'; }).join('')+'</div>'+
    (SESSION?'<section class="section"><div class="section-h"><h3 class="h-m">Lift videos</h3><span class="muted" style="font-size:13px">'+(d.lifts.length?'All verified':'')+'</span></div>'+(d.lifts.length?'<div class="vgrid">'+d.lifts.map(r=>thumb(r,{cap:true,tag:held.some(t=>+t.lift_id===+r.id)?'<span class="chip chip-gold">'+I.crown+'Title</span>':verifiedChip('')})).join('')+'</div>':'<div class="empty" style="padding:24px 0"><b>No verified lifts yet</b></div>')+'</section>':'<div class="pad"><button class="btn btn-ghost btn-block" data-nav="auth" data-authmode="in">Sign in to watch lift videos</button></div>')+
    '<div style="height:28px"></div>';
}
function vProfile(){
  if(!SESSION) return '<div class="pad" style="padding-top:40px;display:flex;flex-direction:column;gap:14px"><div class="prof-head" style="padding:0"><div class="av av-xl" style="--h:200" aria-hidden="true">'+I.user.replace('<svg','<svg style="width:40px;height:40px;stroke:#fff;fill:none;stroke-width:2"')+'</div><div><h1>Your title page</h1><p class="sub" style="margin-top:6px">Sign in to submit lifts, hold titles and track your bests.</p></div></div><button class="btn btn-accent btn-block" data-nav="auth" data-authmode="in">Sign in</button><button class="btn btn-ghost btn-block" data-nav="auth" data-authmode="up">Create account</button></div>';
  if(!MEP){ loadProfile().then(()=>{ if(S.screen==='profile') render(false); }); return '<div class="loading-row" style="padding:40px 16px"><i></i>Loading your profile…</div>'; }
  const u=person(MEP.id, MEP); const home=HOME(); const g=home?GYM[home]:null; const held=MY.titles; const approved=MY.lifts.filter(l=>l.status==='approved'); const pending=myPending(); const rejected=MY.lifts.filter(l=>l.status==='rejected');
  const isVer=MEP.role==='verifier'||MEP.role==='admin';
  const progs=LIFT_ORDER.map(l=>{ const h=home?titleHolder(home,l):null; const mine=myBest(l); const mw=mine?+mine.weight_lb:0; const rc=h?+h.weight_lb:0; const isMe=h&&h.user_id===MEP.id; const pend=pending.find(p=>p.lift===l&&(!home||+p.gym_id===home));
    let txt, pct;
    if(!home){ txt=mw?'Best '+W(mw)+' lb':'No verified single yet'; pct=mw?100:0; }
    else if(isMe){ txt='Held · '+W(mw)+' lb'; pct=100; }
    else if(!h){ txt=pend?W(pend.weight_lb)+' lb under review · title vacant':'Vacant · claim it'; pct=pend?100:0; }
    else { txt=(pend?W(pend.weight_lb)+' lb under review · ':'')+(mw?W(mw)+' / '+W(rc)+' lb · '+W(rc-mw)+' lb away':W(rc)+' lb to beat'); pct=mw?Math.min(100,Math.round(mw/rc*100)):0; }
    return '<div class="prog'+(isMe?' held':'')+'"><div class="l"><b>'+LIFTS[l].title+'</b><span>'+txt+'</span></div><div class="track"><i class="'+(isMe?'gold':'')+'" data-w="'+pct+'"></i></div></div>'; }).join('');
  const row=(p,chip)=>'<div class="row">'+thumb(p,{cls:'thumb-s'})+'<div class="grow"><div class="name"><span class="t">'+LIFTS[p.lift].name+' × '+p.reps+'</span></div><div class="meta">'+esc(p.status==='rejected'?(p.reject_reason||'Reviewers could not verify this lift'):gymLabel(GYM[p.gym_id]||p.gyms)+' · '+ago(p.recorded_at))+'</div><div style="margin-top:4px">'+chip+'</div></div><div class="w">'+W(p.weight_lb)+'<small>LB</small></div></div>';
  return '<div class="topbar"><div class="grow"></div><button class="icon-btn" data-sheet="settings" aria-label="Account settings">'+I.gear+'</button></div>'+
    bannerHtml(u)+'<div class="prof-head"><div class="av-wrap">'+av(u,'xl',held.length>0)+'<button class="pencil" data-sheet="edit" aria-label="Edit profile">'+I.pencil+'</button></div><div><h1>'+esc(u.name)+'</h1>'+(g?'<button class="gym-link" data-gym="'+g.id+'">'+pinIcon()+esc(gymLabel(g))+' · home gym</button>':'<button class="gym-link" data-nav="discover">'+pinIcon()+'Choose a home gym on the map</button>')+'</div>'+
      '<div class="badges">'+held.map(t=>'<span class="badge gold">'+I.crown+LIFTS[t.lift].title+(home&&+t.gym_id!==home&&GYM[t.gym_id]?' · '+esc(GYM[t.gym_id].city||''):'')+'</span>').join('')+(approved.length?'<span class="badge lime">'+I.check+'Verified lifter</span>':'<span class="badge">New lifter</span>')+(isVer?'<span class="badge lime">'+I.shield+'Verifier</span>':'')+'</div></div>'+
    statsRow(u,true)+
    (incomingReqs().length?'<section class="card status-card" style="margin-bottom:12px;gap:10px"><div class="head"><b>Friend requests</b><span class="chip chip-neutral">'+incomingReqs().length+'</span></div>'+incomingReqs().map(f=>{ const p=person(f.requester); return '<div style="display:flex;align-items:center;gap:10px"><span data-person="'+f.requester+'" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'+av(p,'m')+'<b style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.name)+'</b></span>'+friendButtons(f.requester,false)+'</div>'; }).join('')+'</section>':'')+
    (MY.notes.some(n=>!n.read_at)?'<section class="card status-card" style="margin-bottom:12px;gap:8px"><div class="head"><b>Updates</b><button class="chip chip-neutral" data-readall="1">Mark read</button></div>'+MY.notes.filter(n=>!n.read_at).slice(0,5).map(n=>'<div style="display:flex;gap:10px;align-items:flex-start"'+(n.actor_id?' data-person="'+n.actor_id+'"':'')+'><span style="width:8px;height:8px;border-radius:50%;background:'+(n.kind==='approved'||n.kind==='friend_accepted'||n.kind==='friend_request'?'var(--accent)':n.kind==='friend_pr'?'var(--gold)':n.kind==='dethroned'?'var(--gold)':'#F27A6A')+';margin-top:7px;flex:none"></span><div style="min-width:0"><div style="font-weight:600">'+esc(n.title)+'</div><div class="sub">'+esc(n.body)+'</div><div class="muted" style="font-size:12px;margin-top:2px">'+ago(n.created_at)+'</div></div></div>').join('')+'</section>':'')+
    (isVer?'<section class="card status-card" style="margin-bottom:12px;gap:8px"><div class="head"><b>Verifier queue</b><span class="chip chip-neutral">'+(S.review.queue?S.review.queue.length+' waiting':'…')+'</span></div><p class="sub" style="margin:0">Review lifts from other lifters. Two matching verdicts decide a lift. You earn credit for every verdict that matches the final call.</p><button class="btn btn-accent btn-block" data-nav="review">Open the queue</button></section>':'')+
    '<section class="section" style="padding-top:4px"><div class="section-h"><h3 class="h-m">Friends</h3><button class="chip chip-neutral" data-sheet="find">'+I.search+' Find friends</button></div>'+(friendIds().length?'<div class="people">'+friendIds().map(uid=>{ const p=person(uid); const g=p.home?GYM[p.home]:null; if(p.home&&!g) gymById(p.home).then(()=>{ if(S.screen==='profile') render(false); }).catch(()=>{}); return '<div class="person" data-person="'+uid+'">'+av(p,'l')+'<b>'+esc(p.name)+'</b><small>'+esc(g?gymLabel(g):'No home gym')+'</small></div>'; }).join('')+'</div>':'<div class="empty" style="padding:14px 0 6px"><b>No friends yet</b>Add lifters from your gym\'s Lifters tab, the leaderboards, or search by name.</div>')+'</section>'+
    '<section class="card status-card"><div class="head"><b><em>'+held.length+'</em> title'+(held.length===1?'':'s')+' held</b><span class="chip chip-neutral">'+approved.length+' verified lift'+(approved.length===1?'':'s')+'</span></div>'+progs+'</section>'+
    '<div class="bests">'+LIFT_ORDER.map(l=>{ const b=myBest(l); const k=held.some(t=>t.lift===l); return '<div class="best'+(k?' king':'')+'"><span class="l">'+(k?I.crown:'')+LIFTS[l].short+'</span><span class="w">'+(b?W(b.weight_lb)+'<small>LB</small>':'<span class="muted">—</span>')+'</span><small class="d">'+(b?fmtDate(b.recorded_at):'No verified single')+'</small></div>'; }).join('')+'</div>'+
    (pending.length?'<section class="section"><div class="section-h"><h3 class="h-m">Pending review</h3><span class="chip chip-review">'+pending.length+' lift'+(pending.length>1?'s':'')+'</span></div><div class="list">'+pending.map(p=>row(p,reviewChip())).join('')+'</div></section>':'')+
    (rejected.length?'<section class="section"><div class="section-h"><h3 class="h-m">Not approved</h3><span class="muted" style="font-size:13px">'+rejected.length+'</span></div><div class="list">'+rejected.slice(0,5).map(p=>row(p,rejectedChip())).join('')+'</div></section>':'')+
    '<section class="section"><div class="section-h"><h3 class="h-m">Lift videos</h3><span class="muted" style="font-size:13px">'+(approved.length?'All verified':'')+'</span></div>'+(approved.length?'<div class="vgrid">'+approved.slice(0,12).map(r=>thumb(r,{cap:true,tag:held.some(t=>t.lift===r.lift&&+t.gym_id===+r.gym_id&&+t.weight_lb===+r.weight_lb)?'<span class="chip chip-gold">'+I.crown+'Title</span>':verifiedChip('')})).join('')+'</div>':'<div class="empty" style="padding:24px 0"><b>No verified lifts yet</b>Submit a lift with video. Once two reviewers approve it, it shows here and can take a title.</div><div style="padding:0 0 8px"><button class="btn btn-accent btn-block" data-nav="submit">Submit your first lift</button></div>')+'</section>'+
    '<div class="pad" style="padding-top:0"><button class="btn btn-ghost btn-block" data-nav="ideas">'+I.up+' Suggest a feature · vote on ideas</button></div>'+
    '<div style="height:28px"></div>';
}
async function saveProfile(form){
  const st=S.settings; st.busy=true; st.error=null; render(false);
  try{
    const body={updated_at:new Date().toISOString()};
    if(form.name) body.display_name=form.name.value.trim()||MEP.display_name;
    if(form.bw) body.bodyweight_lb=form.bw.value?parseFloat(form.bw.value):null;
    if(form.by) body.birth_year=form.by.value?parseInt(form.by.value,10):null;
    if(form.hft){ const hft=parseInt(form.hft.value,10), hin=parseInt(form.hin.value,10)||0; body.height_in=hft?hft*12+hin:null; }
    if(form.since) body.lifting_since=form.since.value?parseInt(form.since.value,10):null;
    if(form.bf) body.body_fat_pct=form.bf.value?parseFloat(form.bf.value):null;
    const out=await api('profiles?id=eq.'+MEP.id+'&select=*',{method:'PATCH', body}); MEP=out[0]||MEP; person(MEP.id,MEP);
    st.busy=false; st.open=false; st.draft=null; S.sheet=null; toast('Saved'); render(false);
  } catch(e){ st.busy=false; st.error=e.message; render(false); }
}
function vSheet(){
  const st=S.settings; const D=st.draft||{}; const dv=(k,def)=>D[k]!=null?D[k]:def; const t=S.sheet;
  const num=(name,label,ph,val,unit,extra='')=>'<div class="field"><label for="f_'+name+'">'+label+'</label><div class="plain-in"><input id="f_'+name+'" name="'+name+'" type="number" inputmode="decimal" pattern="[0-9]*" value="'+esc(dv(name,val))+'" placeholder="'+ph+'" '+extra+'>'+(unit?'<span>'+unit+'</span>':'')+'</div></div>';
  let title='', body='';
  if(t==='edit'){
    title='Edit profile';
    body='<form id="profform" class="sheet-form">'+
      '<div class="field"><label for="f_name">Display name</label><div class="plain-in"><input id="f_name" name="name" type="text" maxlength="40" autocomplete="nickname" value="'+esc(dv('name',MEP.display_name))+'" style="font-size:18px;font-weight:600;font-family:var(--font-body)"></div><small class="muted" style="font-size:12px">Any name you like. It does not have to be your real one.</small></div>'+
      '<div class="two"><label class="btn btn-ghost" style="cursor:pointer;gap:8px;position:relative;overflow:hidden">Change photo<input type="file" accept="image/*" id="avfile" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"></label><label class="btn btn-ghost" style="cursor:pointer;position:relative;overflow:hidden">Change banner<input type="file" accept="image/*" id="bnfile" style="position:absolute;opacity:0;width:1px;height:1px;pointer-events:none"></label></div>'+
      (st.uploading?'<div class="loading-row" style="padding:0"><i></i>Uploading '+st.uploading+'…</div>':'')+(st.error?errBox(st.error):'')+
      '<button class="btn btn-accent btn-block" type="submit" '+(st.busy?'disabled':'')+'>Save</button></form>';
  } else if(t==='stats'){
    title='Your stats';
    body='<form id="statsform" class="sheet-form">'+
      '<div class="two">'+num('bw','Bodyweight','lb',MEP.bodyweight_lb?W(MEP.bodyweight_lb):'','LB')+num('by','Birth year','1997',MEP.birth_year||'','','min="1900" max="2100" inputmode="numeric"')+'</div>'+
      '<div class="two">'+num('hft','Height (feet)','5',MEP.height_in?Math.floor(MEP.height_in/12):'','FT','min="3" max="8" inputmode="numeric"')+num('hin','Height (inches)','10',MEP.height_in?MEP.height_in%12:'','IN','min="0" max="11" inputmode="numeric"')+'</div>'+
      '<div class="two">'+num('since','Lifting since','2019',MEP.lifting_since||'','','min="1950" max="2100" inputmode="numeric"')+num('bf','Body fat <span>optional</span>','%',MEP.body_fat_pct!=null?W(MEP.body_fat_pct):'','%','min="2" max="70" step="0.5"')+'</div>'+
      (st.error?errBox(st.error):'')+
      '<button class="btn btn-accent btn-block" type="submit" '+(st.busy?'disabled':'')+'>Save</button></form>';
  } else if(t==='idea'){
    title='Suggest something';
    body='<form id="ideaform" class="sheet-form"><div class="field"><label for="i_title">Title</label><div class="plain-in"><input id="i_title" name="title" type="text" maxlength="80" placeholder="Short and specific" style="font-size:17px;font-weight:600;font-family:var(--font-body)"></div></div>'+
      '<div class="field"><label for="i_body">Details <span>optional</span></label><textarea id="i_body" name="body" maxlength="600" rows="4" placeholder="What problem does it solve for you?" style="background:var(--surface);border:1px solid var(--line-2);border-radius:14px;padding:12px 16px;color:var(--fg);font-family:var(--font-body);font-size:15px;resize:none"></textarea></div>'+
      (IDEAS.error?errBox(IDEAS.error):'')+'<button class="btn btn-accent btn-block" type="submit" '+(IDEAS.busy?'disabled':'')+'>Post</button></form>';
  } else if(t==='find'){
    title='Find friends';
    body='<div class="sheet-form"><label class="search" style="position:static"><span style="display:grid;place-items:center">'+I.search+'</span><input id="fsearch" type="search" placeholder="Search lifters by name" value="'+esc((S.find&&S.find.q)||'')+'" autocomplete="off"></label><div id="fres">'+findResultsHtml()+'</div></div>';
  } else {
    title='Account';
    body='<div class="sheet-form">'+
      '<div class="muted" style="font-size:13px">Signed in as '+esc(SESSION&&SESSION.user&&SESSION.user.email?SESSION.user.email:'Apple ID')+'</div>'+
      '<button class="btn btn-ghost btn-block" data-nav="ideas">Suggest a feature</button>'+
      '<a class="btn btn-ghost btn-block" href="https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b#privacy" target="_blank" rel="noopener">Privacy policy</a>'+
      '<a class="btn btn-ghost btn-block" href="https://claude.ai/artifact/QWPiTMDtxtEhbMUrUc5m6b#terms" target="_blank" rel="noopener">Terms of service</a>'+
      '<button class="btn btn-ghost btn-block" data-signout="1">Sign out</button>'+
      (st.confirmDelete?'<button class="btn btn-ghost btn-block" style="border-color:#F27A6A;color:#F27A6A" data-deleteaccount="1" '+(st.busy?'disabled':'')+'>Yes, delete everything</button><p class="muted" style="font-size:13px;margin:0">This removes your account, lifts, titles and videos for good.</p>':'<button class="btn btn-ghost btn-block" style="color:var(--muted)" data-confirmdelete="1">Delete account</button>')+
      (st.error?errBox(st.error):'')+
    '</div>';
  }
  return '<div class="modal" id="modal"><button class="scrim" data-closesheet="1" aria-label="Close"></button><div class="city-sheet"><div class="grab"></div><div class="sheet-head"><h3 class="h-m">'+title+'</h3><button class="icon-btn" data-closesheet="1" aria-label="Close">'+I.close+'</button></div>'+body+'</div></div>';
}
let findT=null;
function findResultsHtml(){
  const f=S.find||{}; const q=(f.q||'').trim();
  if(!q) return '<div class="muted" style="font-size:13px;padding:6px 2px">Type a display name. You can also add friends from any gym\'s Lifters tab or the leaderboards.</div>';
  if(f.loading) return '<div class="loading-row"><i></i>Searching…</div>';
  if(!f.rows||!f.rows.length) return '<div class="empty" style="padding:14px 0"><b>No lifters named "'+esc(q)+'"</b>Names are searched as typed. Try fewer letters.</div>';
  return '<div class="list">'+f.rows.map(r=>{ const p=person(r.id,r); const g=r.home_gym_id&&GYM[r.home_gym_id]; return '<div class="row"><span data-person="'+r.id+'" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'+av(p,'m')+'<div class="grow" style="min-width:0"><div class="name"><span class="t">'+esc(p.name)+'</span></div><div class="meta">'+esc(g?gymLabel(g):'')+'</div></div></span>'+(r.id===myId()?'<span class="chip chip-you">You</span>':friendButtons(r.id,false))+'</div>'; }).join('')+'</div>';
}
async function runFind(){
  const f=S.find=S.find||{}; const q=(f.q||'').trim(); const box=document.getElementById('fres');
  if(!q){ f.rows=null; if(box) box.innerHTML=findResultsHtml(); return; }
  f.loading=true; if(box) box.innerHTML=findResultsHtml(); const mine=q;
  try{ const rows=await api('profiles?display_name=ilike.*'+encodeURIComponent(q.replace(/[%_*,()]/g,''))+'*&select=id,display_name,avatar_hue,avatar_path,home_gym_id&order=display_name.asc&limit=25'); if(S.find.q.trim()!==mine) return; f.rows=rows; await Promise.all([...new Set(rows.map(r=>r.home_gym_id).filter(Boolean))].map(g=>gymById(g).catch(()=>null))); } catch(e){ f.rows=[]; }
  f.loading=false; const b2=document.getElementById('fres'); if(b2) b2.innerHTML=findResultsHtml();
}
function fitImage(file, w, h){
  return new Promise((res,rej)=>{ const url=URL.createObjectURL(file); const im=new Image(); im.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); const s=Math.max(w/im.naturalWidth, h/im.naturalHeight); const dw=im.naturalWidth*s, dh=im.naturalHeight*s; x.drawImage(im,(w-dw)/2,(h-dh)/2,dw,dh); URL.revokeObjectURL(url); c.toBlob(b=>b?res(b):rej(new Error('Could not process the image')),'image/jpeg',0.86); } catch(e){ rej(e); } }; im.onerror=()=>rej(new Error('That file is not an image we can read')); im.src=url; });
}
async function uploadImage(kind, file){
  if(!file||!MEP||!sb) return; const st=S.settings; const f=document.getElementById('profform'); if(f){ st.draft={}; ['name'].forEach(k=>{ if(f[k]) st.draft[k]=f[k].value; }); } st.uploading=kind==='avatar'?'photo':'banner'; st.error=null; render(false);
  try{
    const blob=await fitImage(file, kind==='avatar'?512:1200, kind==='avatar'?512:480);
    const path=MEP.id+'/'+kind+'_'+Date.now()+'.jpg';
    const {error}=await sb.storage.from('avatars').upload(path, blob, {contentType:'image/jpeg', upsert:true}); if(error) throw new Error(error.message);
    const col=kind==='avatar'?'avatar_path':'banner_path'; const old=MEP[col];
    const out=await api('profiles?id=eq.'+MEP.id+'&select=*',{method:'PATCH', body:{[col]:path, updated_at:new Date().toISOString()}}); MEP=out[0]||MEP; person(MEP.id,MEP);
    if(old) sb.storage.from('avatars').remove([old]).catch(()=>{});
    st.uploading=null; toast(kind==='avatar'?'Photo updated':'Banner updated'); render(false);
  } catch(e){ st.uploading=null; st.error=e.message||'Upload failed'; render(false); }
}
async function setHomeGym(gid, confirmed){
  if(!requireAuth({screen:'gym',extra:{gymId:+gid}})) return;
  if(HOME() && HOME()!==+gid && !confirmed){ S.homeConfirm=+gid; render(false); return; }
  S.homeConfirm=null;
  try{ const out=await api('profiles?id=eq.'+MEP.id+'&select=*',{method:'PATCH', body:{home_gym_id:+gid, updated_at:new Date().toISOString()}}); MEP=out[0]||MEP; S.lb.key=null; toast('Home gym set'); render(false); } catch(e){ toast('Could not save: '+e.message); }
}
/* ---------- Suggestions board ---------- */
const IDEAS={rows:null, mine:new Set(), at:0, tab:'top', busy:false, error:null};
async function loadIdeas(force){
  if(IDEAS.rows && !force && Date.now()-IDEAS.at<30000) return;
  try{
    const [rows, mine]=await Promise.all([ api('suggestions?select=*&order=votes_count.desc,created_at.desc&limit=200'), myId()?api('suggestion_votes?user_id=eq.'+myId()+'&select=suggestion_id'):Promise.resolve([]) ]);
    IDEAS.rows=rows||[]; IDEAS.mine=new Set((mine||[]).map(v=>v.suggestion_id)); IDEAS.at=Date.now(); hydratePeople(IDEAS.rows.map(r=>r.user_id));
  } catch(e){ IDEAS.rows=IDEAS.rows||[]; }
  if(S.screen==='ideas') render(false);
}
async function voteIdea(id){
  if(!requireAuth({screen:'ideas'})) return; id=+id; const row=IDEAS.rows.find(r=>r.id===id); if(!row) return;
  const had=IDEAS.mine.has(id);
  if(had){ IDEAS.mine.delete(id); row.votes_count=Math.max(0,row.votes_count-1); } else { IDEAS.mine.add(id); row.votes_count++; }
  render(false);
  try{ if(had) await api('suggestion_votes?suggestion_id=eq.'+id+'&user_id=eq.'+myId(),{method:'DELETE'}); else await api('suggestion_votes',{method:'POST', body:{suggestion_id:id, user_id:myId()}}); }
  catch(e){ if(had){ IDEAS.mine.add(id); row.votes_count++; } else { IDEAS.mine.delete(id); row.votes_count=Math.max(0,row.votes_count-1); } toast('Vote did not save'); render(false); }
}
async function postIdea(form){
  if(!requireAuth({screen:'ideas'})) return; const title=form.title.value.trim(), body=form.body.value.trim();
  if(title.length<3){ IDEAS.error='Give it a short title.'; render(false); return; }
  IDEAS.busy=true; IDEAS.error=null; render(false);
  try{ const out=await api('suggestions?select=*',{method:'POST', body:{user_id:myId(), title, body:body||null}}); const row=out[0]; IDEAS.rows=IDEAS.rows||[]; IDEAS.rows.unshift(row); IDEAS.busy=false; S.sheet=null; toast('Posted. Others can vote it up.'); await voteIdea(row.id); }
  catch(e){ IDEAS.busy=false; IDEAS.error=e.message||'Could not post'; render(false); }
}
async function setIdeaStatus(id, status){
  try{ const row=await rpc('set_suggestion_status',{p_id:+id, p_status:status}); const i=IDEAS.rows.findIndex(r=>r.id===+id); if(i>=0) IDEAS.rows[i]=row; toast('Marked '+status); render(false); } catch(e){ toast(e.message||'Could not update'); }
}
const IDEA_STATUS={open:['Open','chip-neutral'], planned:['Planned','chip-review'], done:['Done','chip-verified'], declined:['Not planned','chip-you']};
function vIdeas(){
  if(!IDEAS.rows) loadIdeas();
  const tab=IDEAS.tab; const rows=IDEAS.rows||[]; const admin=MEP&&MEP.role==='admin';
  const list=rows.filter(r=>tab==='planned'?(r.status==='planned'||r.status==='done'):r.status!=='declined').sort((a,b)=>tab==='new'?(b.created_at>a.created_at?1:-1):(b.votes_count-a.votes_count)||(b.created_at>a.created_at?1:-1));
  const tabs=[['top','Top'],['new','New'],['planned','Planned']];
  const row=r=>{ const st=IDEA_STATUS[r.status]||IDEA_STATUS.open; const p=person(r.user_id); const on=IDEAS.mine.has(r.id);
    return '<div class="idea"><button class="vote'+(on?' on':'')+'" data-vote="'+r.id+'" aria-label="Upvote">'+I.up+'<b>'+r.votes_count+'</b></button><div class="grow" style="min-width:0"><div class="idea-t">'+esc(r.title)+'</div>'+(r.body?'<div class="idea-b">'+esc(r.body)+'</div>':'')+'<div class="idea-m"><span class="chip '+st[1]+'"'+(admin?' data-cycle="'+r.id+'" data-status="'+r.status+'" style="cursor:pointer"':'')+'>'+st[0]+'</span><span class="muted">'+esc(p.name)+' · '+ago(r.created_at)+'</span></div></div></div>'; };
  return '<div class="topbar"><button class="icon-btn" data-back="1" aria-label="Back">'+I.back+'</button><div class="grow"><div class="eyebrow">Apex Lifts</div><h1 class="h-l" style="margin:0">Suggestions</h1></div></div>'+
    '<div class="pad" style="padding-top:4px;padding-bottom:8px"><p class="sub" style="margin:0 0 12px">Tell us what to build next. Vote up anything you want too.'+(admin?' Tap a status chip to change it.':'')+'</p>'+
    '<button class="btn btn-accent btn-block" data-sheet="idea">'+I.plus+' Suggest something</button></div>'+
    '<div class="pad" style="padding-top:0;padding-bottom:6px"><div class="seg">'+tabs.map(t=>'<button class="'+(tab===t[0]?'on':'')+'" data-ideatab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div></div>'+
    (IDEAS.rows?(list.length?'<div class="pad" style="padding-top:0;display:flex;flex-direction:column;gap:10px">'+list.map(row).join('')+'</div>':'<div class="empty" style="padding:30px 16px"><b>Nothing here yet</b>'+(tab==='planned'?'Ideas we have committed to show up here.':'Be the first to suggest something.')+'</div>'):'<div class="loading-row" style="padding:24px 16px"><i></i>Loading…</div>')+
    '<div style="height:28px"></div>';
}
function vHomeConfirm(){
  const g=GYM[S.homeConfirm]; const old=GYM[HOME()];
  return '<div class="modal" id="modal"><button class="scrim" data-cancelhome="1" aria-label="Close"></button><div class="city-sheet"><div class="grab"></div><div class="pad" style="padding-top:4px"><h3 class="h-m">Switch home gym?</h3><p class="sub" style="margin:8px 0 16px">You rank at one gym. Moving to <b>'+esc(g?gymLabel(g):'this gym')+'</b> means your lifts at '+esc(old?gymLabel(old):'your current gym')+' stop counting for titles and boards. Any crown you hold there opens up.</p><div style="display:flex;gap:10px"><button class="btn btn-ghost" style="flex:1" data-cancelhome="1">Keep '+esc(old?old.name:'current')+'</button><button class="btn btn-accent" style="flex:1" data-confirmhome="'+S.homeConfirm+'">Switch</button></div></div></div></div>';
}
async function deleteAccount(){
  const st=S.settings; st.busy=true; render(false);
  try{
    const r=await fetch(API.url+'/functions/v1/delete-account',{method:'POST',headers:{apikey:API.key,Authorization:'Bearer '+SESSION.access_token}});
    const j=await r.json(); if(!r.ok||!j.deleted) throw new Error(j.error||'Could not delete account');
    await signOut(); st.busy=false; st.open=false; st.confirmDelete=false; toast('Account deleted'); go('discover');
  } catch(e){ st.busy=false; st.error=e.message; render(false); }
}

/* ---------- Verifier review queue ---------- */
async function loadQueue(force){
  if(!SESSION||!MEP||(MEP.role!=='verifier'&&MEP.role!=='admin')) return; if(S.review.queue && !force) return;
  try{ const rows=await rpc('review_queue',{lim:20}); S.review.queue=rows||[]; await Promise.all(S.review.queue.map(r=>GYM[r.gym_id]&&GYM[r.gym_id].name?null:gymById(r.gym_id))); const uids=[...new Set(S.review.queue.map(r=>r.user_id))]; if(uids.length){ const ps=await api('profiles?id=in.('+uids.join(',')+')&select=id,display_name,avatar_hue,bodyweight_lb,birth_year'); ps.forEach(p=>person(p.id,p)); } }
  catch(e){ S.review.queue=[]; }
  if(S.screen==='review'||S.screen==='profile') render(false);
}
async function signedUrl(path){ try{ const {data,error}=await sb.storage.from('videos').createSignedUrl(path, 3600); if(error) throw error; return data.signedUrl; } catch(e){ return null; } }
function vReview(){
  if(!SESSION) return '<div class="pad"><div class="empty"><b>Sign in</b>Verifier tools need an account.</div><button class="btn btn-accent btn-block" data-nav="auth">Sign in</button></div>';
  const r=S.review; if(!r.queue) loadQueue();
  const top='<div class="topbar"><button class="icon-btn" data-nav="profile" aria-label="Back">'+I.back+'</button><div class="grow"><div class="eyebrow">Verifier</div></div></div>';
  if(r.item){
    const it=r.item; const g=GYM[it.gym_id]; const p=person(it.user_id); const dm=it.distance_from_gym_m;
    return top+'<div class="pad" style="display:flex;flex-direction:column;gap:14px;padding-top:4px">'+
      '<div><h1 class="h-xl">'+LIFTS[it.lift].name+' · '+W(it.weight_lb)+' lb</h1><p class="sub" style="margin:6px 0 0">'+esc(p.name)+(it.bodyweight_lb?' · '+W(it.bodyweight_lb)+' lb bodyweight':'')+' · '+it.reps+' rep'+(it.reps>1?'s':'')+' · '+esc(gymLabel(g))+'</p></div>'+
      (r.videoUrl?'<video src="'+esc(r.videoUrl)+'" controls playsinline style="width:100%;border-radius:16px;background:#000;max-height:52vh"></video>':'<div class="loading-row"><i></i>Loading video…</div>')+
      '<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:14px">'+
        '<div style="display:flex;justify-content:space-between"><span class="muted">Recorded</span><b>'+fmtDate(it.recorded_at)+'</b></div>'+
        '<div style="display:flex;justify-content:space-between"><span class="muted">Phone distance from gym</span><b>'+(dm==null?'Unknown':dm<250?Math.round(dm)+' m · at the gym':dm<2000?Math.round(dm)+' m · nearby':(dm/1000).toFixed(1)+' km · not at the gym')+'</b></div>'+
        '<div style="display:flex;justify-content:space-between"><span class="muted">Video length</span><b>'+(it.video_seconds?dur(it.video_seconds):'—')+'</b></div>'+
      '</div>'+
      '<div class="info-box">'+I.info+'<span>Approve only if you can see the plates, the full range of motion, and the weight matches what was entered. When in doubt, reject with a reason so the lifter can resubmit.</span></div>'+
      '<div class="seg"><button class="'+(r.verdict==='approve'?'on':'')+'" data-verdict="approve" style="'+(r.verdict==='approve'?'color:var(--accent)':'')+'">Approve</button><button class="'+(r.verdict==='reject'?'on':'')+'" data-verdict="reject" style="'+(r.verdict==='reject'?'color:#F27A6A':'')+'">Reject</button></div>'+
      (r.verdict==='reject'?'<div class="field"><label for="rreason">Reason <span>shown to the lifter</span></label><div class="plain-in" style="height:auto;padding:10px 14px"><input id="rreason" type="text" maxlength="140" placeholder="Plates not visible / depth / no lockout" value="'+esc(r.reason)+'" data-rreason="1" style="font-size:15px;font-weight:500;font-family:var(--font-body)"></div></div>':'')+
      (r.error?errBox(r.error):'')+
      '<div class="footer-btns" style="padding:0"><button class="btn btn-ghost" data-reviewback="1">'+I.back+'</button><button class="btn btn-accent" data-sendreview="1" '+(r.verdict&&!r.busy&&(r.verdict!=='reject'||r.reason.trim())?'':'disabled')+'>'+(r.busy?'Sending…':'Submit verdict')+'</button></div>'+
    '</div>';
  }
  const q=r.queue;
  return top+'<div class="pad" style="padding-top:4px"><h1 class="h-xl">Review queue</h1><p class="sub" style="margin:6px 0 14px">'+(q?q.length+' lift'+(q.length===1?'':'s')+' waiting. Oldest first.':'Loading…')+'</p>'+
    (q?(q.length?'<div class="list">'+q.map(it=>{ const p=person(it.user_id); const g=GYM[it.gym_id]; return '<button class="row" style="width:100%;text-align:left" data-reviewitem="'+it.id+'">'+av(p,'m')+'<div class="grow"><div class="name"><span class="t">'+esc(p.name)+'</span></div><div class="meta">'+LIFTS[it.lift].name+' × '+it.reps+' · '+esc(gymLabel(g))+' · '+ago(it.created_at)+'</div></div><div class="w">'+W(it.weight_lb)+'<small>LB</small></div></button>'; }).join('')+'</div>':'<div class="empty"><b>Queue is clear</b>Nothing is waiting for review right now.</div>'):'<div class="loading-row"><i></i>Loading…</div>')+
    '<div style="padding:12px 0"><button class="btn btn-ghost btn-block" data-refreshqueue="1">Refresh</button></div></div>';
}
async function openReviewItem(id){
  const it=(S.review.queue||[]).find(x=>x.id===+id); if(!it) return;
  S.review.item=it; S.review.verdict=null; S.review.reason=''; S.review.error=null; S.review.videoUrl=null; render(true);
  const url=await signedUrl(it.video_path); if(S.review.item&&S.review.item.id===it.id){ S.review.videoUrl=url; if(!url) S.review.error='Could not load the video.'; render(false); }
}
async function sendReview(){
  const r=S.review; if(!r.item||!r.verdict||r.busy) return; r.busy=true; r.error=null; render(false);
  try{
    await api('reviews',{method:'POST', body:{lift_id:r.item.id, reviewer_id:myId(), verdict:r.verdict, reason:r.verdict==='reject'?r.reason.trim():null}});
    const gid=r.item.gym_id; const v=r.verdict; r.item=null; r.busy=false; toast(v==='approve'?'Approved':'Rejected'); delete BOARD[gid]; r.queue=null; await loadQueue(true); render(true);
  } catch(e){ r.busy=false; r.error=e.message; render(false); }
}

/* ---------- Video modal ---------- */
function vVideo(){
  const x=VIDEOS[S.video]; if(!x) return '';
  const u=person(x.user_id); const verified=x.status==='approved'; const king=verified&&x.gym_id&&isKing(x.user_id,x.gym_id,x.lift)&&titleHolder(x.gym_id,x.lift).lift_id===x.lift_id;
  const rp=S.report;
  return '<div class="modal" id="modal"><div class="mtop"><div><div class="eyebrow">Lift video</div><div style="font-weight:600">'+esc(u.name)+' · '+LIFTS[x.lift].name+'</div></div><button class="icon-btn" data-closevideo="1" aria-label="Close">'+I.close+'</button></div>'+
    '<div class="player" id="player" style="--h:'+(u.h||200)+'">'+(S.videoUrl?'<video src="'+esc(S.videoUrl)+'" controls autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:2"></video>':'<span class="bar"></span><div class="watermark">'+(verified?verifiedChip():x.status==='pending'?reviewChip():rejectedChip())+(king?'<span class="chip chip-gold">'+I.crown+LIFTS[x.lift].title+'</span>':'')+'</div><div class="pbtn" style="opacity:.92;width:auto;min-width:64px;padding:0 14px;border-radius:32px">'+(S.videoErr?'<span style="font-size:12px;font-family:var(--font-display);font-weight:700;letter-spacing:.04em;text-transform:uppercase">'+esc(S.videoErr)+'</span>':'<span class="loading-row" style="padding:0;color:#0f1012"><i style="border-color:#ccc;border-top-color:#0f1012"></i></span>')+'</div>')+'</div>'+
    '<div class="mdetail"><div class="head">'+av(u,'m',king)+'<div class="grow"><b>'+esc(u.name)+(x.user_id===myId()?' (You)':'')+'</b><small>'+(x.gym_id&&GYM[x.gym_id]?esc(gymLabel(GYM[x.gym_id]))+' · ':'')+fmtDate(x.recorded_at)+'</small></div><div class="big">'+W(x.weight_lb)+'<small>LB</small></div></div>'+
    '<div class="revs">'+(verified?'<span class="chip chip-neutral">Approved by 2 reviewers</span>':x.status==='pending'?'<span class="chip chip-neutral">Awaiting 2 reviewers</span>':'<span class="chip chip-neutral">Rejected by reviewers</span>')+'<span class="chip chip-neutral">'+x.reps+' rep'+(x.reps>1?'s':'')+'</span>'+
      (x.user_id!==myId()&&SESSION?(rp.done?'<span class="chip chip-verified">'+I.check+'Reported</span>':'<button class="chip chip-neutral" data-report="1">'+I.flag.replace('<svg','<svg style="width:12px;height:12px"')+'Report</button>'):'')+'</div>'+
    (rp.open&&!rp.done?'<div class="field" style="margin-top:8px"><label for="rreport">Why are you reporting this?</label><div class="plain-in" style="height:auto;padding:10px 14px"><input id="rreport" type="text" maxlength="140" placeholder="Fake plates, wrong gym, offensive…" value="'+esc(rp.reason)+'" data-reportreason="1" style="font-size:15px;font-weight:500;font-family:var(--font-body)"></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-ghost btn-sm" data-report="0">Cancel</button><button class="btn btn-accent btn-sm" data-sendreport="1" '+(rp.reason.trim()?'':'disabled')+'>Send report</button></div></div>':'')+
    '</div></div>';
}
async function openVideo(id){
  const x=VIDEOS[id]; if(!x) return;
  S.video=id; S.videoUrl=null; S.videoErr=null; S.report={open:false,reason:'',done:false};
  repaintModal();
  if(!SESSION){ S.videoErr='Sign in to watch'; repaintModal(); return; }
  if(!x.video_path){ S.videoErr='Video unavailable'; repaintModal(); return; }
  const url=await signedUrl(x.video_path); if(S.video!==id) return;
  if(url) S.videoUrl=url; else S.videoErr='Could not load video'; repaintModal();
}
function repaintModal(){ const m=document.getElementById('modal'); if(m) m.remove(); if(S.video) document.getElementById('app').insertAdjacentHTML('beforeend', vVideo()); }
async function sendReport(){
  const x=VIDEOS[S.video]; if(!x) return;
  try{ await api('reports',{method:'POST', body:{reporter_id:myId(), lift_id:x.lift_id||null, reported_user_id:x.user_id, reason:S.report.reason.trim()}}); S.report.done=true; S.report.open=false; repaintModal(); toast('Report sent'); } catch(e){ toast('Could not send report'); }
}

/* ---------- Events ---------- */
function nearMe(){
  const done=(lat,lon,label)=>{ S.me=[lat,lon]; if(MEPIN) MEPIN.setLatLng(S.me); flyTo(lat,lon,13.5); toast(label); };
  if(navigator.geolocation && API.live){
    let settled=false; const fb=setTimeout(()=>{ if(!settled){ settled=true; done(DEFAULT_CENTER[0],DEFAULT_CENTER[1],'Location unavailable · centered on Lakewood, CA'); } },5000);
    navigator.geolocation.getCurrentPosition(p=>{ if(settled) return; settled=true; clearTimeout(fb); done(p.coords.latitude,p.coords.longitude,'Centered on your location'); }, ()=>{ if(settled) return; settled=true; clearTimeout(fb); done(DEFAULT_CENTER[0],DEFAULT_CENTER[1],'Location blocked · centered on Lakewood, CA'); }, {timeout:4500,maximumAge:60000});
  } else done(DEFAULT_CENTER[0],DEFAULT_CENTER[1],'Centered on Lakewood, CA');
}
document.addEventListener('click', e=>{
  const t=e.target.closest('[data-nav],[data-gym],[data-gymtab],[data-gymlb],[data-challenge],[data-lbscope],[data-lblift],[data-lbbw],[data-lbage],[data-lbopen],[data-slift],[data-sstep],[data-reps],[data-submit],[data-video],[data-closevideo],[data-share],[data-opencity],[data-closecity],[data-city],[data-authmode],[data-settings],[data-signout],[data-confirmdelete],[data-deleteaccount],[data-sethome],[data-confirmhome],[data-cancelhome],[data-person],[data-back],[data-sheet],[data-closesheet],[data-friend],[data-setrole],[data-vote],[data-ideatab],[data-cycle],[data-reviewitem],[data-reviewback],[data-verdict],[data-sendreview],[data-refreshqueue],[data-report],[data-sendreport],[data-apple],[data-readall],#near');
  if(!t) return;
  const d=t.dataset;
  if(t.id==='near'){ nearMe(); return; }
  if(d.opencity!==undefined){ S.citySheet=true; const m=document.getElementById('modal'); if(m) m.remove(); document.getElementById('app').insertAdjacentHTML('beforeend', vCitySheet()); return; }
  if(d.closecity!==undefined){ S.citySheet=false; const m=document.getElementById('modal'); if(m) m.remove(); return; }
  if(d.city!==undefined){ const c=CITY[d.city];
    if(API.live===false && d.city!=='la'){ S.citySheet=false; const m=document.getElementById('modal'); if(m) m.remove(); toast('Offline preview covers the Lakewood area only'); return; }
    S.city=d.city; S.citySheet=false; S.search=''; S.searchHits=[];
    if(S.screen==='leaderboards'){ S.lb.key=null; render(false); }
    else { if(S.screen!=='discover') go('discover'); else { const m=document.getElementById('modal'); if(m) m.remove(); paintSearch(); const si=document.getElementById('search'); if(si) si.value=''; } flyTo(c.lat,c.lon,12); toast(c.name+' · '+c.gyms.toLocaleString()+' gyms'); }
    return; }
  if(d.closevideo!==undefined){ S.video=null; S.videoUrl=null; const m=document.getElementById('modal'); if(m) m.remove(); return; }
  if(d.video!==undefined){ openVideo(d.video); return; }
  if(d.report!==undefined){ S.report.open=d.report==='1'; repaintModal(); return; }
  if(d.sendreport!==undefined){ sendReport(); return; }
  if(d.share!==undefined){ const txt=location.href; if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(()=>toast('Link copied'),()=>toast('Copy the link from the address bar')); else toast('Copy the link from the address bar'); return; }
  if(d.apple!==undefined){ (async()=>{ const a=S.auth; if(a.busy) return; a.busy=true; a.error=null; render(false); try{ await signInWithApple(); await loadProfile(); a.busy=false; const n=S.authNext; S.authNext=null; toast('Signed in'); if(n&&n.screen==='submit'){ resetSubmit(S.submit.gymId, S.submit.lift); go('submit'); } else if(n&&n.screen) go(n.screen, n.extra||{}); else go('profile'); } catch(e){ a.busy=false; a.error=e.message||'Apple sign-in failed'; render(false); } })(); return; }
  if(d.authmode!==undefined && d.nav===undefined){ S.auth.mode=d.authmode; S.auth.error=null; S.auth.done=null; render(false); return; }
  if(d.nav!==undefined){
    if(d.nav==='submit'){ if(!requireAuth({screen:'submit'})) return; if(S.screen!=='submit'||S.submit.step===4) resetSubmit(S.screen==='gym'?S.gymId:(HOME()||null), null); go('submit'); return; }
    if(d.nav==='leaderboards'){ if(d.lbscope) S.lb.scope=d.lbscope; go('leaderboards'); return; }
    if(d.nav==='auth'){ S.auth.mode=d.authmode||'in'; S.auth.error=null; S.auth.done=null; go('auth'); return; }
    if(d.nav==='profile'){ if(SESSION) loadMine(); loadQueue(); go('profile'); return; }
    if(d.nav==='review'){ go('review'); return; }
    if(d.nav==='ideas'){ S.sheet=null; loadIdeas(true); go('ideas'); return; }
    go(d.nav); return;
  }
  if(d.gym!==undefined && d.gymid===undefined){ openGym(d.gym); return; }
  if(d.gymtab!==undefined){ S.gymTab=d.gymtab; render(false); return; }
  if(d.gymlb!==undefined){ S.gymLbLift=d.gymlb; render(false); return; }
  if(d.sethome!==undefined){ setHomeGym(d.sethome); return; }
  if(d.setrole!==undefined){ (async()=>{ try{ const row=await rpc('set_role',{p_user:d.uid, p_role:d.setrole}); person(d.uid,row); if(PP[d.uid]) PP[d.uid].prof=row; toast(d.setrole==='verifier'?'They can now verify lifts':'Verifier role removed'); render(false); } catch(e){ toast(e.message||'Could not change role'); } })(); return; }
  if(d.vote!==undefined){ voteIdea(d.vote); return; }
  if(d.ideatab!==undefined){ IDEAS.tab=d.ideatab; render(false); return; }
  if(d.cycle!==undefined){ const order=['open','planned','done','declined']; setIdeaStatus(d.cycle, order[(order.indexOf(d.status)+1)%order.length]); return; }
  if(d.friend!==undefined){ friendAction(d.friend, d.uid, d.fid); return; }
  if(d.back!==undefined){ go(S.prev&&S.prev!=='person'?S.prev:'discover'); return; }
  if(d.person!==undefined){ if(myId()&&d.person===myId()) go('profile'); else go('person',{personId:d.person}); return; }
  if(d.confirmhome!==undefined){ setHomeGym(d.confirmhome, true); return; }
  if(d.cancelhome!==undefined){ S.homeConfirm=null; render(false); return; }
  if(d.challenge!==undefined){ if(!requireAuth({screen:'gym',extra:{gymId:+d.gymid}})) return; resetSubmit(d.gymid, d.challenge); go('submit'); return; }
  if(d.lbscope!==undefined){ S.lb.scope=d.lbscope; render(false); return; }
  if(d.lblift!==undefined){ S.lb.lift=d.lblift; render(false); return; }
  if(d.lbbw!==undefined){ S.lb.bwc=d.lbbw; render(false); return; }
  if(d.lbage!==undefined){ S.lb.age=d.lbage; render(false); return; }
  if(d.lbopen!==undefined){ S.lb.open=!S.lb.open; render(false); return; }
  if(d.slift!==undefined){ S.submit.lift=d.slift; render(false); return; }
  if(d.sstep!==undefined){ S.submit.step=parseInt(d.sstep,10); render(true); if(S.submit.step===2) setTimeout(()=>{const w=document.getElementById('w'); if(w&&!S.submit.weight) w.focus();},50); return; }
  if(d.reps!==undefined){ S.submit.reps=Math.max(1,Math.min(20,S.submit.reps+parseInt(d.reps,10))); render(false); return; }
  if(d.submit!==undefined){ submitLift(); return; }
  if(d.readall!==undefined){ (async()=>{ try{ await api('notifications?user_id=eq.'+myId()+'&read_at=is.null',{method:'PATCH', body:{read_at:new Date().toISOString()}}); MY.notes.forEach(n=>n.read_at=n.read_at||new Date().toISOString()); render(false); }catch(e){} })(); return; }
  if(d.settings!==undefined){ S.sheet=d.settings==='1'?'settings':null; S.settings.confirmDelete=false; S.settings.error=null; S.settings.draft=null; render(false); return; }
  if(d.sheet!==undefined){ if(!requireAuth({screen:'profile'})) return; if(d.sheet==='find'){ S.find={q:'',rows:null}; loadFriends(); } S.sheet=d.sheet; S.settings.confirmDelete=false; S.settings.error=null; S.settings.draft=null; render(false); return; }
  if(d.closesheet!==undefined){ S.sheet=null; S.settings.confirmDelete=false; S.settings.error=null; S.settings.draft=null; render(false); return; }
  if(d.signout!==undefined){ S.sheet=null; S.find=null; signOut().then(()=>{ toast('Signed out'); go('discover'); }); return; }
  if(d.confirmdelete!==undefined){ S.settings.confirmDelete=true; render(false); return; }
  if(d.deleteaccount!==undefined){ deleteAccount(); return; }
  if(d.reviewitem!==undefined){ openReviewItem(d.reviewitem); return; }
  if(d.reviewback!==undefined){ S.review.item=null; S.review.videoUrl=null; render(true); return; }
  if(d.verdict!==undefined){ S.review.verdict=d.verdict; render(false); return; }
  if(d.sendreview!==undefined){ sendReview(); return; }
  if(d.refreshqueue!==undefined){ S.review.queue=null; render(false); loadQueue(true); return; }
});
document.addEventListener('submit', e=>{
  if(e.target.id==='authform'){ e.preventDefault(); handleAuth(e.target); }
  if(e.target.id==='profform'||e.target.id==='statsform'){ e.preventDefault(); saveProfile(e.target); }
  if(e.target.id==='ideaform'){ e.preventDefault(); postIdea(e.target); }
});
document.addEventListener('change', e=>{ if(e.target.id==='vfile'){ pickFile(e.target.files[0]); } else if(e.target.id==='avfile'){ uploadImage('avatar', e.target.files[0]); } else if(e.target.id==='bnfile'){ uploadImage('banner', e.target.files[0]); } });
document.addEventListener('input', e=>{
  const t=e.target;
  if(t.id==='search'){ S.search=t.value; runSearch(); return; }
  if(t.id==='fsearch'){ S.find=S.find||{}; S.find.q=t.value; clearTimeout(findT); findT=setTimeout(runFind,250); return; }
  if(t.dataset.rreason!==undefined){ S.review.reason=t.value; const b=document.querySelector('[data-sendreview]'); if(b){ if(t.value.trim()) b.removeAttribute('disabled'); else b.setAttribute('disabled',''); } return; }
  if(t.dataset.reportreason!==undefined){ S.report.reason=t.value; const b=document.querySelector('[data-sendreport]'); if(b){ if(t.value.trim()) b.removeAttribute('disabled'); else b.setAttribute('disabled',''); } return; }
  if(t.dataset.bind){ S.submit[t.dataset.bind]=t.value; const w=parseFloat(S.submit.weight)||0; const btn=document.querySelector('[data-sstep="3"]'); if(btn){ if(w>0) btn.removeAttribute('disabled'); else btn.setAttribute('disabled',''); } }
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && (S.video||S.citySheet)){ S.video=null; S.citySheet=false; const m=document.getElementById('modal'); if(m) m.remove(); } });

/* ---------- Boot ---------- */
(async function boot(){
  render(true);
  await probe();
  await initAuth();
  if(S.screen==='discover') mountMap(); else render(false);
  render(false); if(S.screen==='discover') mountMap();
})();
