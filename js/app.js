import {W,H,RA,RS,MA,MS,DT,VMAX,MAXPULL,ZONE,START} from './config.js';
import {LEVELS,dailyLevel,today} from './levels.js';
import {step,inZone} from './physics.js';
import {SAVE,persist,SKINS,saveSkins} from './storage.js';
import {sb} from './supabase-client.js';
import {pos,draw3D as draw} from './scene3d.js';

'use strict';
const $=id=>document.getElementById(id);
const cv=$('cv');
/* ========= Пользователь & Supabase Sync ========= */
let currentUser = null;
async function initAuth() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserProfile();
  }
  sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    if (currentUser) void loadUserProfile(); else { currentUser = null; updateUIBadge(); }
  });
}
async function loadUserProfile() {
  if (!sb || !currentUser) return;
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) currentUser.profile = data;
  updateUIBadge();
  await syncFromServer();
}
async function syncFromServer(){
  if(!sb || !currentUser) return;
  const [{data:res}, {data:pur}] = await Promise.all([
    sb.from('results').select('level_id,score,stars').eq('user_id', currentUser.id),
    sb.from('purchases').select('skin_id').eq('user_id', currentUser.id)
  ]);
  (res || []).forEach(r => {
    const o = SAVE[r.level_id] || {score:0, stars:0};
    SAVE[r.level_id] = {score: Math.max(o.score, r.score), stars: Math.max(o.stars, r.stars)};
  });
  persist();
  (pur || []).forEach(p => {
    if(!SKINS.owned.includes(p.skin_id)) SKINS.owned.push(p.skin_id);
  });
  saveSkins();
  if(!S) menu();
}
function updateUIBadge() {
  if (currentUser && currentUser.profile) {
    $('uState').textContent = `${currentUser.profile.username} (${currentUser.profile.university})`;
    $('bAuthModal').textContent = 'Профиль';
    $('bSignOut').classList.remove('hide');
  } else {
    $('uState').textContent = 'Гость (Локальный режим)';
    $('bAuthModal').textContent = 'Войти';
    $('bSignOut').classList.add('hide');
  }
}

/* ========= Раунд и Игра ========= */
let S=null,LV=null, MP={ active: false, channel: null, isMyTurn: true, role: 'host' };

function startRound(lv,mode){
  LV=lv;
  S={lv,mode,phase:'aim',throws:lv.throws,score:0,total:lv.a.length,sim:0,drag:null,fl:[],
     ast:lv.a.map(([x,y],i)=>({x,y,vx:0,vy:0,r:RA,m:MA,rot:i*1.9})),
     saka:{x:START.x,y:START.y,vx:0,vy:0,r:RS,m:MS}};
  $('menu').classList.add('hide');$('play').classList.remove('hide');$('edbar').classList.add('hide');$('hint').textContent=lv.tip+' Потяни и удерживай, чтобы увидеть траекторию.';hud();
}

function fire(pull,len, isRemote = false){
  if (MP.active && !MP.isMyTurn && !isRemote) return;
  const p=Math.min(len,MAXPULL)/MAXPULL,v=p*VMAX;
  S.saka.vx=pull.x/len*v;S.saka.vy=pull.y/len*v;S.phase='fly';S.sim=0;S.drag=null;
  $('hint').textContent='';

  if (MP.active && MP.isMyTurn && !isRemote) {
    MP.channel.send({ type: 'broadcast', event: 'move', payload: { pull, len } });
  }
}

function restingAll(){return S.saka.vx===0&&S.saka.vy===0&&S.ast.every(a=>a.vx===0&&a.vy===0)}

function settle(){
  const out=S.ast.filter(a=>!inZone(a)),n=out.length,pts=n+(n>1?1:0);
  out.forEach(a=>S.fl.push({x:a.x,y:a.y,t:0,txt:'+1'}));
  if(n>1)S.fl.push({x:W/2,y:ZONE.y+ZONE.h+30,t:0,txt:'Комбо +1!'});
  S.ast=S.ast.filter(inZone);S.score+=pts;S.throws--;
  Object.assign(S.saka,{x:START.x,y:START.y,vx:0,vy:0});

  if (MP.active) { MP.isMyTurn = !MP.isMyTurn; hud(); }

  if(!S.ast.length||S.throws<=0)finish();else{S.phase='aim';hud()}
}

function stars(cleared,total){return cleared===total?3:cleared>=Math.ceil(total*.75)?2:cleared>=Math.ceil(total*.5)?1:0}

async function finish(){
  S.phase='over';hud();
  const cleared=S.total-S.ast.length,st=stars(cleared,S.total),id=S.lv.id,old=SAVE[id]||{score:0,stars:0};
  const record=S.mode!=='custom'&&S.mode!=='multi'&&S.score>old.score;
  if(S.mode!=='custom'&&S.mode!=='multi'){
    SAVE[id]={score:Math.max(old.score,S.score),stars:Math.max(old.stars,st)};
    persist();
    if (S.mode !== 'multi' && sb && currentUser && currentUser.profile) {
      void sb.from('results').insert({
        user_id: currentUser.id,
        username: currentUser.profile.username,
        university: currentUser.profile.university,
        score: S.score,
        stars: st,
        level_id: id
      }).then(({error}) => { if(error) console.warn('Не удалось сохранить результат:', error.message); });
    }
  }
  const idx=LEVELS.findIndex(l=>l.id===id),next=S.mode==='level'&&st>0&&LEVELS[idx+1];
  $('mbox').innerHTML=`<h2>${st?'Отличный бросок!':'Не повезло'}</h2>
   <div class="big">${'★'.repeat(st)}${'☆'.repeat(3-st)}</div>
   <p>Выбито ${cleared} из ${S.total}. Очки: <b>${S.score}</b>${record?' — новый рекорд!':''}<br>Лучший результат: ${SAVE[id]?SAVE[id].score:S.score}</p>
   <div class="row" style="justify-content:center">
   <button id="mAgain">Ещё раз</button>${next?'<button id="mNext">Дальше</button>':''}<button class="alt" id="mMenu">Меню</button></div>`;
  $('modal').classList.remove('hide');$('mAgain').onclick=()=>{closeModal();startRound(S.lv,S.mode)};
  if(next)$('mNext').onclick=()=>{closeModal();startRound(next,'level')};$('mMenu').onclick=()=>{closeModal();menu()};
}
const closeModal=()=>$('modal').classList.add('hide');

function hud(){
  if(S.phase==='edit'){$('hT').textContent='Асыков: '+S.ast.length;$('hS').textContent='';return}
  let statusText = 'Броски: '+S.throws;
  if (MP.active) statusText += MP.isMyTurn ? ' | Твой ход' : ' | Ход соперника';
  $('hT').textContent=statusText;
  $('hS').textContent='Очки: '+S.score;
}

/* ========= Ввод ========= */
cv.addEventListener('pointerdown',e=>{
  if(!S)return;const p=pos(e);
  if(S.phase==='edit'){editTap(p);return}
  if(S.phase!=='aim'|| (MP.active && !MP.isMyTurn))return;
  S.drag={x0:p.x,y0:p.y,x:p.x,y:p.y};cv.setPointerCapture(e.pointerId);$('hint').textContent='Потяни назад и держи, чтобы увидеть траекторию.';
});
cv.addEventListener('pointermove',e=>{if(S&&S.drag){const p=pos(e);S.drag.x=p.x;S.drag.y=p.y;if(Math.hypot(S.drag.x0-p.x,S.drag.y0-p.y)>=14)$('hint').textContent='Отпусти, чтобы бросить.'}});
cv.addEventListener('pointerup',()=>{
  if(!S||!S.drag)return;
  const pull={x:S.drag.x0-S.drag.x,y:S.drag.y0-S.drag.y},len=Math.hypot(pull.x,pull.y);
  if(len<14){S.drag=null;$('hint').textContent='Натяни подальше.';return}
  fire(pull,len);
});
cv.addEventListener('pointercancel',()=>{if(S)S.drag=null});

/* ========= Редактор ========= */
function editTap(p){
  const hit=S.ast.findIndex(a=>Math.hypot(a.x-p.x,a.y-p.y)<RA+4);
  if(hit>=0)S.ast.splice(hit,1);
  else if(S.ast.length<20&&inZone({x:p.x-RA,y:p.y-RA})&&inZone({x:p.x+RA,y:p.y+RA})&&S.ast.every(a=>Math.hypot(a.x-p.x,a.y-p.y)>RA*2+2))
    S.ast.push({x:p.x,y:p.y,vx:0,vy:0,r:RA,m:MA,rot:S.ast.length*1.9});
  hud();
}
function openEditor(){
  startRound({id:'edit',name:'Редактор',throws:5,a:[]},'custom');
  S.phase='edit';$('edbar').classList.remove('hide');$('hint').textContent='Нажми в кон, чтобы поставить асык.';hud();
}
function customFrom(ast){return{id:'custom',name:'Своя задача',throws:Math.max(3,Math.ceil(ast.length*.8)),a:ast.map(a=>[Math.round(a.x),Math.round(a.y)])}}
$('eClear').onclick=()=>{S.ast=[];hud()};
$('ePlay').onclick=()=>{if(S.ast.length)startRound(customFrom(S.ast),'custom');else $('hint').textContent='Поставь асык.'};
$('eLink').onclick=async()=>{
  if(!S.ast.length)return;
  const c=customFrom(S.ast),url=location.origin+location.pathname+'#c='+btoa(JSON.stringify({t:c.throws,a:c.a}));
  try{await navigator.clipboard.writeText(url);$('hint').textContent='Ссылка скопирована!'}
  catch(e){prompt('Скопируй ссылку:',url)}
};

/* ========= Меню & Модальные окна ========= */
function menu(){
  S=null;MP.active=false;if(MP.channel)MP.channel.unsubscribe();
  $('play').classList.add('hide');$('menu').classList.remove('hide');
  const box=$('levels');box.innerHTML='';
  LEVELS.forEach((l,i)=>{
    const s=SAVE[l.id]||{stars:0,score:0},locked=i>0&&!(SAVE[LEVELS[i-1].id]||{}).stars;
    const b=document.createElement('button');b.className='lv';b.disabled=locked;
    b.innerHTML=`<b>${i+1}. ${l.name}</b><span class="st">${'★'.repeat(s.stars)}${'☆'.repeat(3-s.stars)}</span><br><small>${locked?'Нужна ★':'Рекорд: '+s.score}</small>`;
    b.onclick=()=>startRound(l,'level');box.appendChild(b);
  });
  const d=SAVE['daily-'+today()];$('bDaily').textContent='Ежедневное испытание'+(d?' · '+d.score:'');
  updateUIBadge();
}

/* ========= Auth Handlers ========= */
let isRegState = false;
$('bAuthModal').onclick = () => $('authModal').classList.remove('hide');$('bAuthClose').onclick = () => $('authModal').classList.add('hide');$('bToggleReg').onclick = () => {
  isRegState = !isRegState;
  $('authTitle').textContent = isRegState ? 'Регистрация' : 'Вход в аккаунт';
  $('regFields').classList.toggle('hide', !isRegState);$('bAuthSubmit').textContent = isRegState ? 'Зарегистрироваться' : 'Войти';
  $('bToggleReg').textContent = isRegState ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
};
$('fAuth').addEventListener('submit', async e => {
  e.preventDefault();
  if (!sb) { $('authErr').textContent = 'Supabase не настроен!'; return; }
  const email = $('authEmail').value, password =$('authPass').value;
  $('authErr').textContent = 'Загрузка...';
  if (isRegState) {
    const username = $('authName').value.trim().slice(0,20) || 'Игрок', university = $('authUni').value;
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username, university } } });
    if (error) { $('authErr').textContent = error.message; return; }
    if (data.user) {
      if (data.session) { currentUser = data.user; await loadUserProfile(); $('authModal').classList.add('hide'); }
      else $('authErr').textContent = 'Проверьте почту, чтобы подтвердить регистрацию.';
    }
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { $('authErr').textContent = error.message; return; }
    await loadUserProfile();
    $('authModal').classList.add('hide');
  }
});
$('bSignOut').onclick = async () => {
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) { $('authErr').textContent = error.message; return; }
  currentUser = null; updateUIBadge();
};

/* ========= Leaderboard Handlers ========= */
$('bLeaders').onclick = () => {$('leaderModal').classList.remove('hide'); renderUniLeaders(); };
$('bLeaderClose').onclick = () =>$('leaderModal').classList.add('hide');
$('tUni').onclick = () => {$('tUni').classList.add('active'); $('tPlayers').classList.remove('active'); renderUniLeaders(); };$('tPlayers').onclick = () => { $('tPlayers').classList.add('active');$('tUni').classList.remove('active'); renderPlayerLeaders(); };

const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
async function renderUniLeaders() {
  if (!sb) { $('leaderContent').innerHTML = '<p>Supabase не подключен.</p>'; return; }
  const { data, error } = await sb.from('uni_leaderboard').select('*');
  if (error || !data) { $('leaderContent').innerHTML = '<p>Нет данных.</p>'; return; }
  let html = '<table><tr><th>№</th><th>ВУЗ</th><th>Сумма очков</th><th>Игроки</th></tr>';
  data.forEach((r, i) => { html += `<tr><td>${i+1}</td><td>${esc(r.university)}</td><td>${r.total}</td><td>${r.players}</td></tr>`; });
  $('leaderContent').innerHTML = html + '</table>';
}

async function renderPlayerLeaders() {
  if (!sb) { $('leaderContent').innerHTML = '<p>Supabase не подключен.</p>'; return; }
  const { data, error } = await sb.from('player_leaderboard').select('*');
  if (error || !data) { $('leaderContent').innerHTML = '<p>Нет данных.</p>'; return; }
  let html = '<table><tr><th>№</th><th>Игрок</th><th>ВУЗ</th><th>Очки</th></tr>';
  data.forEach((r, i) => { html += `<tr><td>${i+1}</td><td>${esc(r.username)}</td><td>${esc(r.university)}</td><td>${r.total}</td></tr>`; });
  $('leaderContent').innerHTML = html + '</table>';
}

/* ========= Shop Handlers ========= */
$('bShop').onclick = () => {$('shopModal').classList.remove('hide'); renderShop(); };
$('bShopClose').onclick = () =>$('shopModal').classList.add('hide');

const SKIN_ITEMS = {
  saka_gold:{name:'Золотой Сақа',description:'Классический золотой цвет сақа.',price:0}, saka_neon:{name:'Неоновый Сақа',description:'Яркий зелёный неоновый сақа.',price:500},
  saka_ice:{name:'Ледяной Сақа',description:'Холодный голубой оттенок.',price:700}, saka_ruby:{name:'Рубиновый Сақа',description:'Насыщенный рубиновый оттенок.',price:900},
  ground_sand:{name:'Степной песок',description:'Тёплая песчаная площадка.',price:0}, ground_emerald:{name:'Изумрудное поле',description:'Зелёная площадка.',price:700}, ground_cyber:{name:'Кибер Арена',description:'Тёмная неоновая площадка.',price:1000}
};
let pendingPurchase = null;
function renderShop() {
  const sakas = [
    { id: 'gold', name: 'Золотой Сақа', key: 'saka_gold' },
    { id: 'neon', name: 'Неоновый Сақа', key: 'saka_neon' },
    { id: 'ice', name: 'Ледяной Сақа', key: 'saka_ice' },
    { id: 'ruby', name: 'Рубиновый Сақа', key: 'saka_ruby' }
  ];
  let html = '';
  sakas.forEach(s => {
    const owned = SKINS.owned.includes(s.key);
    const active = SKINS.saka === s.id;
    html += `<div class="skin-card"><span>${s.name}</span>`;
    if (active) html += `<button disabled>Активен</button>`;
    else if (owned) html += `<button onclick="equipSkin('saka', '${s.id}')">Надеть</button>`;
    else html += `<button onclick="buySkin('${s.key}', 'saka', '${s.id}')">Купить (Тест)</button>`;
    html += `</div>`;
  });
  $('sakaSkins').innerHTML = html;

  const grounds = [
    { id: 'sand', name: 'Степной песок', key: 'ground_sand' },
    { id: 'emerald', name: 'Изумрудное поле', key: 'ground_emerald' },
    { id: 'cyber', name: 'Кибер Арена', key: 'ground_cyber' }
  ];
  let gHtml = '';
  grounds.forEach(g => {
    const owned = SKINS.owned.includes(g.key);
    const active = SKINS.ground === g.id;
    gHtml += `<div class="skin-card"><span>${g.name}</span>`;
    if (active) gHtml += `<button disabled>Активен</button>`;
    else if (owned) gHtml += `<button onclick="equipSkin('ground', '${g.id}')">Выбрать</button>`;
    else gHtml += `<button onclick="buySkin('${g.key}', 'ground', '${g.id}')">Купить (Тест)</button>`;
    gHtml += `</div>`;
  });
  $('groundSkins').innerHTML = gHtml;
}

window.buySkin = (key, type, id) => {
  const item = SKIN_ITEMS[key];
  if (!item || SKINS.owned.includes(key)) return;
  pendingPurchase = {key,type,id,item};
  $('purchaseTitle').textContent = item.name;
  $('purchaseDescription').textContent = item.description;
  $('purchasePrice').textContent = item.price ? `Цена: ${item.price} ₸ (тестовая)` : 'Бесплатно';
  $('purchaseModal').classList.remove('hide');
};
$('bPurchaseCancel').onclick = () => { pendingPurchase = null; $('purchaseModal').classList.add('hide'); };
$('bPurchaseConfirm').onclick = async () => {
  if (!pendingPurchase) return;
  const {key,type,id} = pendingPurchase;
  if (!SKINS.owned.includes(key)) SKINS.owned.push(key);
  SKINS[type] = id; saveSkins();
  if (sb && currentUser) {
    const {error} = await sb.from('purchases').insert({user_id:currentUser.id,skin_id:key});
    if (error) console.warn('Не удалось сохранить покупку:', error.message);
  }
  pendingPurchase = null; $('purchaseModal').classList.add('hide'); renderShop();
};
window.equipSkin = (type, id) => { SKINS[type] = id; saveSkins(); renderShop(); };

/* ========= Multiplayer Handlers ========= */
$('bMulti').onclick = () =>$('mpModal').classList.remove('hide');
$('bMpClose').onclick = () =>$('mpModal').classList.add('hide');

$('bCreateRoom').onclick = () => {
  const roomCode = Math.random().toString(36).substring(2,6).toUpperCase();
  joinMultiplayerRoom(roomCode, true);
};
$('bJoinRoom').onclick = () => {
  const code = $('roomCodeInput').value.trim().toUpperCase();
  if (code) joinMultiplayerRoom(code, false);
};

function joinMultiplayerRoom(code, isHost) {
  if (!sb) { $('mpStatus').textContent = 'Supabase не настроен для мультиплеера!'; return; }
  $('mpStatus').textContent = `Подключение к комнате ${code}...`;
  MP.active = true;
  MP.role = isHost ? 'host' : 'guest';
  MP.isMyTurn = isHost;

  MP.channel = sb.channel(`room_${code}`, { config: { broadcast: { ack: false, self: false } } });
  MP.channel.on('broadcast', { event: 'move' }, payload => {
    if (payload.payload) fire(payload.payload.pull, payload.payload.len, true);
  }).subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      $('mpModal').classList.add('hide');
      startRound(LEVELS[0], 'multi');
      $('hint').textContent = `Комната: ${code}. ${MP.isMyTurn ? 'Твой ход!' : 'Жди ход соперника.'}`;
    }
  });
}

$('bDaily').onclick=()=>startRound(dailyLevel(),'daily');$('bEdit').onclick=openEditor;
$('bBack').onclick=()=>{closeModal();menu()};

/* ========= Цикл ========= */
let last=0,acc=0;
function loadHash(){
  const match = location.hash.match(/^#c=([A-Za-z0-9+/=]+)$/);
  if (!match) return;
  try {
    const data = JSON.parse(atob(match[1]));
    if (!Array.isArray(data.a) || data.a.length < 1 || data.a.length > 20) throw new Error('invalid layout');
    const ast = data.a.map(p => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || p[0] < ZONE.x+RA || p[0] > ZONE.x+ZONE.w-RA || p[1] < ZONE.y+RA || p[1] > ZONE.y+ZONE.h-RA) throw new Error('invalid position');
      return p;
    });
    const throws = Number.isInteger(data.t) ? Math.max(1,Math.min(20,data.t)) : Math.max(3,Math.ceil(ast.length*.8));
    startRound({id:'custom',name:'Своя задача',throws,a:ast,tip:'Задача из ссылки.'},'custom');
  } catch(e) { $('hint').textContent='Ссылка на задачу повреждена.'; }
}
function loop(t){
  const dt=Math.min(.05,(t-last)/1000);last=t;
  if(S&&S.phase==='fly'){
    acc+=dt;let n=0;
    while(acc>=DT&&n++<12){
      acc-=DT;S.sim+=DT;step([...S.ast,S.saka]);
      if(restingAll()||S.sim>10){settle();break}
    }
  }
  draw(dt,S,SKINS);requestAnimationFrame(loop);
}
initAuth();
menu();
loadHash();
requestAnimationFrame(loop);
