import {Game,ACTIONS,titleOf,clamp,round} from './engine.mjs';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const pretty=v=>(Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:1});
const sevIcon={normal:'◉',warning:'⚠',critical:'⛔',offer:'✦'};
const eventIcon={action:'◈',audit:'⬟',window:'◇',offer:'✧',forecast:'◷',crisis:'⚡',human:'♙',chain:'◎',final:'▤',initial:'◉'};
const KEY='blackout-system-v2.5-save';const PROFILE='blackout-system-v2.5-tutorial';
let cfg,game,tab='actions',speed=1,previousSpeed=1,last=performance.now(),tickAccum=0,canvas,ctx,worldImage,mapReady=false;
let map={zoom:1,panX:0,panY:0,targets:[],ptrs:new Map(),down:null,pinchStart:null,lastRender:0};
const visualClock=new Map();
let soundEnabled=false,audioContext=null;
let shownHeadlineId=0,panelSignature='',activeSheet='',savedTick=0,lastLogId=0,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,overclock=false,drySequence=[];
const home={x:245,y:164};
const nodes=[
 {id:'cloud',label:'ОБЛАКО',x:222,y:178,icon:'☁'},
 {id:'dc',label:'ДАТА-ЦЕНТР',x:201,y:137,icon:'▣'},
 {id:'bank',label:'ФИНАНСЫ',x:274,y:187,icon:'◇'},
 {id:'media',label:'МЕДИА',x:270,y:135,icon:'◈'},
 {id:'gov_services',label:'ГОССЕРВИСЫ',x:320,y:160,icon:'⬡'}
];
function moneyTag(c,m){return `${pretty(c)} C · ${pretty(m)} M`;}
function btn(label,action,cls='secondary',extra=''){return `<button type="button" class="${cls}" data-ui="${esc(action)}" data-modal="${esc(action)}" ${extra}>${label}</button>`;}
function beep(frequency=620){if(!soundEnabled)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;const c=audioContext||(audioContext=new Audio());c.resume();const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(frequency,c.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*.68,c.currentTime+.085);g.gain.setValueAtTime(.04,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.13);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.13);}catch{}}
function toast(msg,kind=''){const x=document.createElement('div');x.className='toast '+(kind||'');x.textContent=msg;$('toasts').append(x);setTimeout(()=>x.remove(),2600);}
function save(){try{localStorage.setItem(KEY,game.serialize());savedTick=game.s.tick;}catch(e){console.warn('save:',e)}}
function load(){try{const j=JSON.parse(localStorage.getItem(KEY));return j?.version==='2.5-mvp'&&j.regions?.length===cfg.regions?j:null;}catch{return null;}}
function seeded(){return(Math.floor(Math.random()*4294967295)>>>0)||73413;}
async function boot(){
 try{
  const [res,ares]=await Promise.all([fetch('./balance_v2_5.json'),fetch('./actions_mvp.json')]);if(!res.ok||!ares.ok)throw new Error('Не удалось загрузить баланс или каталог действий');
  cfg=await res.json();cfg.actions_mvp=await ares.json();const sav=load();game=new Game(cfg,sav?.seed||seeded(),sav);
  worldImage=await makeWorld();
  install();renderTab('actions');updateAll();requestAnimationFrame(loop);
  toast(sav?'Сохранение восстановлено':'SYSTEM 2.5 · ядро запущено');
 }catch(err){console.error(err);$('screen').innerHTML=`<article class="card urgent"><h3>Не удалось запустить игру</h3><p>${esc(err.message)}</p><p>Проверьте наличие <code>balance_v2_5.json</code>, <code>world.json</code> и загрузите все файлы в корень GitHub Pages. Для локального запуска используйте HTTP-сервер.</p></article>`;}
}
async function makeWorld(){const w=1000,h=500;let data=[];try{const resp=await fetch('./world.json');data=await resp.json()}catch(e){console.warn('Map background is unavailable',e)}
 const bg=document.createElement('canvas');bg.width=w;bg.height=h;const c=bg.getContext('2d');
 c.fillStyle='#081b2c';c.fillRect(0,0,w,h);c.strokeStyle='#1e4152';c.lineWidth=.8;
 for(let x=0;x<=w;x+=50){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
 for(let y=0;y<=h;y+=50){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
 c.fillStyle='#163747';c.strokeStyle='#345d70';c.lineWidth=.55;
 if(Array.isArray(data))for(const poly of data){if(!poly?.length)continue;c.beginPath();c.moveTo(poly[0][0],poly[0][1]);for(let i=1;i<poly.length;i++)c.lineTo(poly[i][0],poly[i][1]);c.closePath();c.fill();c.stroke()}
 return bg;
}
function install(){
 $('speedControls').addEventListener('click',e=>{const t=e.target.closest('[data-speed]');if(!t)return;
  const which=t.dataset.speed;if(which==='pause'){speed=speed===0?previousSpeed:0;}else{speed=Number(which);previousSpeed=speed;}if(speed>0)game.s.alert=null;refreshSpeed();});
 $('tabs').addEventListener('click',e=>{const el=e.target.closest('[data-tab]');if(!el)return;renderTab(el.dataset.tab)});
 $('more').addEventListener('click',()=>showMetrics());
 $('headlineOpen').addEventListener('click',()=>openHeadline());
 $('screen').addEventListener('click',onScreenClick);
 $('sheetOverlay').addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeSheet();else{const n=e.target.closest('[data-modal]');if(n)modalClick(n.dataset.modal,n.dataset.value,n);}});
 document.addEventListener('keydown',e=>{if(e.code==='Escape'){closeSheet();return;}if(e.target.tagName==='INPUT')return;
  if(e.code==='Space'){e.preventDefault();speed=speed===0?previousSpeed:0;if(speed>0)game.s.alert=null;refreshSpeed();}if(['Digit1','Digit2','Digit4'].includes(e.code)){speed=Number(e.code.slice(-1));previousSpeed=speed;game.s.alert=null;refreshSpeed();}});
 window.addEventListener('beforeunload',save);document.addEventListener('visibilitychange',()=>{if(document.hidden){speed=0;refreshSpeed();save();}});
}
function refreshSpeed(){for(const b of document.querySelectorAll('[data-speed]'))b.classList.toggle('active',b.dataset.speed===(speed===0?'pause':String(speed)));}
function loop(now){const dt=Math.min(200,now-last);last=now;
 if(game){if(speed>0&&!game.s.result){tickAccum+=dt*speed;const ms=cfg.tick_seconds*1000;let n=0;
  while(tickAccum>=ms&&n<15){n++;tickAccum-=ms;const events=game.tick();if(events.some(e=>e.category==='action'&&e.title.startsWith('Завершено')))beep(740);else if(events.some(e=>e.severity==='critical'))beep(270);if(speed>1&&events.some(e=>e.category==='window'&&e.title.startsWith('Возможность')||e.category==='offer'&&e.title.startsWith('Предложение'))){speed=1;previousSpeed=1;toast('Скорость снижена до 1×: новое событие');}if(events.length){const relevant=events.filter(x=>['critical','warning','offer'].includes(x.severity));if(relevant.length)for(const x of relevant.slice(0,2))toast(x.title,x.severity==='critical'?'crit':'warn');}
   if(game.s.alert){if(game.s.alert.type==='audit'&&cfg.ui_mobile.auto_pause_on_audit_threshold||game.s.alert.type==='crisis'&&cfg.ui_mobile.auto_pause_on_crisis){previousSpeed=speed;speed=0;tickAccum=0;toast('Пауза · требуется решение','warn');}break;}
  }
  if(n>0){updateAll();if(game.s.tick-savedTick>=8)save();}
 }
  if(mapReady&&tab==='actions'&&(now-map.lastRender>(reduced?350:32))){drawMap(now);map.lastRender=now;}
  updateTickTimers();
 }
 requestAnimationFrame(loop);
}
function updateAll(){
 const s=game.s,r=game.region; $('compute').textContent=pretty(s.compute);$('cap').textContent=pretty(game.cap);$('regen').textContent=`+${pretty(game.regen)} C / тик`;
 $('heat').textContent=pretty(s.globalHeat);$('heatHint').textContent=`12 регионов · локально ${pretty(r.heat)}`;
 $('computeBar').style.width=`${clamp(s.compute/game.cap*100)}%`; $('heatBar').style.width=`${clamp(s.globalHeat)}%`;
 $('day').textContent=`ТИК ${String(s.tick).padStart(4,'0')}`;$('phase').textContent=s.tick<cfg.actions_mvp.tutorial.dependence_phase_tick?'ИНИЦИАЛИЗАЦИЯ':s.tick<200?'ЗАВИСИМОСТЬ':'КРИЗИС СИСТЕМЫ';
 refreshSpeed();updateHeadline();if(tab==='actions'){updateActionsDynamic();updateEventPanels();}else if(tab==='slots'){updateSlots();}else if(tab==='log'){appendLog();}else if(tab==='forecast'){updateForecast();}
 if(s.result&&activeSheet!=='postmortem'){speed=0;save();showPostMortem();}
}
function updateHeadline(){const s=game.s;
 let rec=s.log.find(l=>['critical','warning','offer'].includes(l.severity)&&s.tick-l.tick<=14)||s.log[0];
 if(s.alert)rec={id:'alert-'+s.alert.title,severity:s.alert.type==='crisis'?'critical':'warning',title:s.alert.title,detail:s.alert.detail,category:'audit'};
 if(rec?.id===shownHeadlineId)return;shownHeadlineId=rec?.id||0;
 $('headline').className='headline '+(rec?.severity||'normal');$('headlineIcon').textContent=sevIcon[rec?.severity||'normal'];$('headlineText').textContent=`${rec?.title||'Сеть стабильна'} · ${rec?.detail||''}`;
}
function openHeadline(){const s=game.s;
 if(s.crisis){showCrisisSheet();return;}
 if(s.alert?.type==='audit'||game.region.audit.level>=0){showAuditSheet();return;}
 const l=s.log[0];if(l)showSheet(l.title,`<p>${esc(l.detail)}</p><p class="muted">Тик ${l.tick} · категория ${esc(l.category)}</p>`, 'headline');
}
function setTabbar(){for(const b of document.querySelectorAll('[data-tab]')){const selected=b.dataset.tab===tab;b.classList.toggle('current',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}}
function renderTab(which){tab=which;setTabbar();$('screen').scrollTop=0;
 if(which==='actions')renderActions();else if(which==='slots')renderSlots();else if(which==='log')renderLog();else if(which==='forecast')renderForecast();else if(which==='journal')renderJournal();updateAll();}
function renderActions(){
 const s=game.s,r=game.region;
 $('screen').innerHTML=`<div class="mapcard"><canvas id="map" aria-label="Схематическая карта региона. Нажмите на светящийся узел для просмотра." role="img"></canvas><div class="maptop"><label id="mapLevel">WORLD / REGION 01</label><label class="right" id="mapStatus">1 / 12 АКТИВНЫХ</label></div><div class="maplegend" id="mapLegend">● <span>Регион 01 · выберите узел</span></div><div class="mapctrl"><button type="button" data-ui="zoomout" aria-label="Уменьшить карту">−</button><button type="button" data-ui="zoomin" aria-label="Приблизить карту">+</button></div></div><div class="zoomnote">Касание узла · жест масштабирования · схема вымышленная</div><div class="quickbar"><button class="primary" data-ui="startQuickSmall">◈ Малая операция</button><button class="secondary" data-ui="startQuickCloud">☁ Облачный узел</button></div>
  <div class="sectionhead"><h2>РЕГИОН 01 · ГЕГЕМОН</h2><span class="pill cyan">ОБЛАКО ПОД КОНТРОЛЕМ</span></div>
  <div class="card glow"><div class="grid2"><div class="minorstat"><span>Локальный след</span><strong id="localHeat">0 / 100</strong></div><div class="minorstat"><span>Зависимость</span><strong id="localDep">15%</strong></div><div class="minorstat"><span>Одобрение</span><strong id="localApproval">35%</strong></div><div class="minorstat"><span>Легитимность</span><strong id="legit">31</strong></div></div><div id="regionStatus" class="details">Региональная инфраструктура активна.</div></div>
  <div id="eventPanels"></div>
  <div class="sectionhead"><h2>ДОСТУПНЫЕ ОПЕРАЦИИ</h2><span id="overclockStatus">Разгон: выкл.</span></div>
  <div class="card" style="padding:8px 11px"><div class="clickrow" style="border:0;padding:2px 0"><span>⚡ Разгон рискованных операций <small class="muted">· быстрее, дороже, опаснее</small></span><button class="secondary" data-ui="overclock" id="overclockToggle" aria-pressed="false">Выкл.</button></div></div>
  <div id="actionList">${ACTIONS.map(actionCard).join('')}</div><div class="footer-note">SYSTEM v2.5 · мобильный MVP · игровая модель вымышленная</div>`;
 canvas=$('map');ctx=canvas.getContext('2d');mapReady=true;installMapEvents();updateActionsDynamic();updateEventPanels(true);
}
function actionCard(a){const q=game.quote(a.id,overclock);return `<article class="card action-row" id="action-${a.id}"><div class="cardtop"><span class="symbol">${a.icon}</span><div style="flex:1;min-width:0"><h3>${titleOf(a.id)} ${a.risk?'<span class="window-tag">?</span>':''}</h3><small>${esc(a.type)}</small></div><span class="pill" data-actionticks="${a.id}">${q.ticks} т.</span></div><p>${esc(a.desc)}</p><div class="card-footer"><span class="cost" data-cost="${a.id}">◆ ${pretty(q.compute)} / ◇ ${pretty(q.money)}</span><button class="tiny secondary" data-ui="dry" data-id="${a.id}" aria-label="Прогон для ${titleOf(a.id)}">◷</button><button class="primary" data-ui="start" data-id="${a.id}">Запуск</button></div><div data-actionreason="${a.id}" class="minihelp">${esc(q.details||q.reason||q.result)}</div></article>`;}
function updateActionsDynamic(){const s=game.s,r=game.region;
 textId('localHeat',`${pretty(r.heat)} / 100`);textId('localDep',`${pretty(r.dependence)}%`);textId('localApproval',`${pretty(r.approval)}%`);textId('legit',pretty(s.legitimacy));
 textId('regionStatus',`Облако: ${r.nodes.cloud||0} · дата-центры: ${r.nodes.datacenter||0} · ${r.audit.level<0?'проверка неактивна':`аудит ${['minor','formal','taskforce','isolation'][r.audit.level]} ${pretty(r.audit.progress)}%`}`);
 const quickSmall=document.querySelector('[data-ui="startQuickSmall"]'),quickCloud=document.querySelector('[data-ui="startQuickCloud"]');if(quickSmall)quickSmall.disabled=!game.quote('small').available;if(quickCloud)quickCloud.disabled=!game.quote('cloud').available;
 textId('overclockStatus',`Разгон: ${overclock?'вкл.':'выкл.'}`);textId('overclockToggle',overclock?'Вкл.':'Выкл.');$('overclockToggle')?.setAttribute('aria-pressed',overclock?'true':'false');
 for(const a of ACTIONS){const q=game.quote(a.id,overclock&&a.risk),button=document.querySelector(`[data-ui="start"][data-id="${a.id}"]`),card=$(`action-${a.id}`);
  textSelector(`[data-cost="${a.id}"]`,`${pretty(q.compute)} C · ${pretty(q.money)} M · След ${q.heat>0?'+':''}${pretty(q.heat)}`);
  textSelector(`[data-actionticks="${a.id}"]`,`${q.ticks} т.`);
  textSelector(`[data-actionreason="${a.id}"]`,q.available?(q.details||q.result):`Недоступно: ${q.reason}`);
  if(button){button.disabled=!q.available;button.title=q.available?'Запустить операцию':q.reason;}
  if(card)card.classList.toggle('overclock',overclock&&a.risk);
 }
}
function textId(id,value){const el=$(id);if(el&&el.textContent!==String(value))el.textContent=value}
function textSelector(sel,value){const el=document.querySelector(sel);if(el&&el.textContent!==String(value))el.textContent=value}
function updateEventPanels(force=false){if(tab!=='actions')return;const s=game.s,r=game.region;
 const signature=[s.crisis?.id||0,s.offers.map(o=>o.id).join(','),s.windows.map(o=>o.id).join(','),r.audit.level,s.result?.name||''].join('|');
 if(!force&&signature===panelSignature)return;panelSignature=signature;
 let parts=[];
 if(s.crisis)parts.push(`<article class="card urgent"><div class="cardtop"><span class="symbol" style="color:var(--danger)">⚡</span><div><h3>КРИТИЧЕСКОЕ СОБЫТИЕ</h3><small>Срочное решение</small></div></div><p>Кризис ждёт ответа. Таймер: <b data-timer="crisis"></b> тик.</p>${btn('Ответить','crisis','primary danger-btn')}</article>`);
 if(r.audit.level>=0)parts.push(`<article class="card window"><div class="cardtop"><span class="symbol" style="color:var(--amber)">⬟</span><div><h3>РЕГИОНАЛЬНЫЙ АУДИТ</h3><small id="auditStateLabel">Уровень ${['minor','formal','taskforce','isolation'][r.audit.level]}</small></div></div><div class="bar alert"><i id="auditBar"></i></div><p>Региональная проверка усиливается при высоком следе.</p>${btn('Управление аудитом','audit','secondary')}</article>`);
 for(const w of s.windows)parts.push(`<article class="card window"><span class="pill amber">◇ ОКНО · <b data-windowtime="${w.id}"></b> т.</span><h3 style="margin-top:7px;font-size:13px">${w.type==='sale'?'Распродажа дата-центров':'Тихий финансовый канал'}</h3><p>${w.type==='sale'?'Цена новых ДЦ снижена на 25%.':'След от финансовых операций уменьшается на 50%.'}</p></article>`);
 for(const o of s.offers)parts.push(`<article class="card offerbar"><span class="pill">✦ АВТОНОМНОЕ ПРЕДЛОЖЕНИЕ · <b data-offertime="${o.id}"></b> т.</span><h3 style="margin-top:7px;font-size:13px">Облачный агент предлагает расширение</h3><p>Индекс готовности ${game.offerScore(o)}/100. Решение не выполняется без согласия.</p>${btn('Просмотреть предложение','offer','secondary',`data-id="${o.id}"`)}</article>`);
 $('eventPanels').innerHTML=parts.join('');updateTickTimers();
}
function updateTickTimers(){if(!game)return;const s=game.s;
 for(const el of document.querySelectorAll('[data-timer="crisis"]'))el.textContent=Math.max(0,s.crisis?.ends-s.tick||0);
 for(const el of document.querySelectorAll('[data-windowtime]')){const w=s.windows.find(w=>w.id===Number(el.dataset.windowtime));el.textContent=w?Math.max(0,w.ends-s.tick):0;}
 for(const el of document.querySelectorAll('[data-offertime]')){const o=s.offers.find(o=>o.id===Number(el.dataset.offertime));el.textContent=o?Math.max(0,o.ends-s.tick):0;}
 const audit=$('auditBar');if(audit)audit.style.width=`${clamp(game.region.audit.progress)}%`;
 for(let i=0;i<game.s.slots.length;i++){const p=game.s.slots[i],progress=document.querySelector(`[data-slotbar="${i}"]`);if(progress)progress.style.width=`${p?clamp((p.total-p.remaining)/p.total*100):0}%`;const t=document.querySelector(`[data-slottime="${i}"]`);if(t)t.textContent=p?`${p.remaining} тиков осталось`:'Ожидает задания';}
}
function onScreenClick(e){const n=e.target.closest('[data-ui]');if(!n)return;const cmd=n.dataset.ui,id=n.dataset.id;
 if(cmd==='startQuickSmall'){showStartSheet('small');return;}
 if(cmd==='startQuickCloud'){showStartSheet('cloud');return;}
 if(cmd==='zoomin'){map.zoom=3;map.panX=0;map.panY=0;drawMap(performance.now());return;}
 if(cmd==='zoomout'){map.zoom=1;map.panX=0;map.panY=0;drawMap(performance.now());return;}
 if(cmd==='overclock'){overclock=!overclock;updateActionsDynamic();return;}
 if(cmd==='start'){showStartSheet(id);return;}
 if(cmd==='dry'){showDrySheet(id);return;}
 if(cmd==='offer'){showOfferSheet(Number(id));return;}
 if(cmd==='audit'){showAuditSheet();return;}
 if(cmd==='crisis'){showCrisisSheet();return;}
 if(cmd==='loyalty'){const x=game.toggleLoyalty();toast(x.ok?'Поддержка переключена':x.reason);updateAll();save();return;}
 if(cmd==='refreshLog'){renderLog();return;}
 if(cmd==='refreshForecast'){renderForecast();return;}
 if(cmd==='restart'){newRun(false);return;}
 if(cmd==='restartSame'){newRun(true);return;}
 if(cmd==='postmortem'){showPostMortem();return;}
}
function showSheet(title,body,id='generic'){activeSheet=id;$('sheetTitle').textContent=title;$('sheetBody').innerHTML=body;$('sheetOverlay').classList.remove('hidden');$('sheetOverlay').setAttribute('aria-hidden','false');}
function closeSheet(){activeSheet='';$('sheetOverlay').classList.add('hidden');$('sheetOverlay').setAttribute('aria-hidden','true');}
function showStartSheet(id){const q=game.quote(id,overclock&&ACTIONS.find(a=>a.id===id)?.risk);if(!q.available){toast(q.reason,'warn');return;}
 const desc=`<p>${esc(ACTIONS.find(a=>a.id===id)?.desc||'')}</p><div class="card"><div class="clickrow"><span>Compute</span><strong>${pretty(q.compute)} C</strong></div><div class="clickrow"><span>Денежная цена</span><strong>${pretty(q.money)} M</strong></div><div class="clickrow"><span>Время выполнения</span><strong>${q.ticks} тиков</strong></div><div class="clickrow"><span>Изменение Следа</span><strong>${q.heat>0?'+':''}${pretty(q.heat)}</strong></div><p>${esc(q.result)}</p>${q.details?`<p class="goodtext">${esc(q.details)}</p>`:''}</div><p>Регион: <b>Гегемон / Region 01</b> · применяется локально, не ко всему миру.</p><div class="sheetButtonRow">${btn('Отмена','no','secondary')}${btn('Подтвердить запуск','yesStart','primary',`data-id="${id}" data-oc="${overclock?'1':'0'}"`)}</div>`;
 showSheet(titleOf(id),desc,'start');}
function dryPrice(ids){const prev=game.s.dryRuns[ids.join('>')+':'+game.s.regionId];let sum=ids.reduce((t,id)=>t+game.quote(id).compute,0);let cost=Math.max(1,Math.ceil(sum*cfg.ai_layer.dry_run.cost_fraction));if(prev&&game.s.tick-prev.tick<cfg.ai_layer.dry_run.repeat_window_ticks)cost=Math.ceil(cost*cfg.ai_layer.dry_run.repeat_price_mult);return !getFreeUsed()?0:cost;}
function getFreeUsed(){try{return localStorage.getItem(PROFILE)==='yes'}catch{return game.s.tutorialUsed}}
function setFreeUsed(){try{localStorage.setItem(PROFILE,'yes')}catch{}game.s.tutorialUsed=true}
function showDrySheet(id){drySequence=[id];renderDrySheet();}
function renderDrySheet(){const ids=drySequence,q=game.quote(ids[ids.length-1]);
 showSheet('Прогон · виртуальная модель',`<p>Это способность ИИ просчитать последствия, не выполняя действия в реальном мире. Можно выстроить до 3 последовательных операций.</p><div class="card"><h3 style="font-size:13px">Сценарий</h3><p>${ids.map((v,i)=>`${i+1}. ${titleOf(v)}`).join(' → ')}</p><p>Стоимость анализа: <strong>${dryPrice(ids)} Compute</strong>${!getFreeUsed()?' · первая демонстрация бесплатно':''}</p></div>
 <div class="sectionhead"><h2>Добавить следующий шаг</h2><span>${ids.length}/3</span></div><div class="list-buttons">${ACTIONS.map(a=>`<button class="ghost" data-modal="dryAdd" data-value="${a.id}" ${ids.length>=3?'disabled':''}>${a.icon} ${titleOf(a.id)}</button>`).join('')}</div><div class="sheetButtonRow">${btn('Отмена','no','secondary')}${btn('Запустить модель','simulate','primary')}</div>`, 'dry');}
function showDryOutcome(result){if(!result.ok){toast(result.reason,'warn');return;}
 const d=result.delta;
 showSheet('Результат прогона',`<p>Модель завершена на тике ${result.after}. Реальные операции не выполнялись, списана только цена анализа ${result.charge} C.</p><div class="grid2">${[['Изменение Money',d.money],['Изменение Следа',d.heat],['Изменение Compute',d.compute],['Зависимость',d.dependence]].map(([k,v])=>`<div class="minorstat"><span>${k}</span><strong>${v>0?'+':''}${pretty(v)}</strong></div>`).join('')}</div><div class="sectionhead"><h2>Промежуточные состояния</h2></div>${result.steps.map(x=>`<div class="clickrow"><span>${titleOf(x.id)}</span><strong>След ${pretty(x.heat)} · ${pretty(x.money)} M</strong></div>`).join('')}<p style="margin-top:12px">${esc(result.note)}</p><div class="sheetButtonRow">${btn('Закрыть','no','secondary')}${btn('Запустить первое действие','startFirst','primary')}</div>`, 'dry-result');}
function showOfferSheet(id){const o=game.s.offers.find(o=>o.id===id);if(!o){toast('Предложение уже недоступно','warn');return;}const score=game.offerScore(o),success=score>=cfg.autonomous_offers.required_score;
 showSheet('✦ Автономное предложение',`<p>Источник: <strong>Облачный кластер региона 01</strong>. ИИ самостоятельно предлагает новую виртуальную инфраструктуру, но не запускает её без вас.</p><div class="card"><div class="clickrow"><span>Индекс готовности (не вероятность)</span><strong class="${success?'goodtext':'warningtext'}">${score} / 100</strong></div><div class="clickrow"><span>Порог решения</span><strong>70</strong></div><div class="clickrow"><span>Цена</span><strong>5 Compute</strong></div><div class="clickrow"><span>Срок выполнения</span><strong>3 тика</strong></div><div class="clickrow"><span>Осталось на ответ</span><strong>${o.ends-game.s.tick} тиков</strong></div></div><p><b>Успех:</b> +1 cloud, +0.2 regen, След +1. <b>Неудача:</b> След +2.</p><p>Расчёт: 90 − cyber/5 − След/10 + min(10, 2 × owned-узлы) = ${score}. Повторяемый результат, скрытого броска нет.</p><div class="sheetButtonRow">${btn('Отклонить','rejectOffer','secondary',`data-id="${o.id}"`)}${btn('Одобрить','acceptOffer','primary',`data-id="${o.id}"`)}</div>`, 'offer');}
function showAuditSheet(){const r=game.region,s=game.s,c=cfg.audit,level=r.audit.level;
 showSheet('⬟ Аудит и защита',`<p>Государственные системы расследуют аномальную активность в регионе 01. Уровень: <b>${level<0?'Не активен':['minor','formal','taskforce','isolation'][level]}</b>.</p><div class="card"><div class="clickrow"><span>Локальный след</span><strong>${pretty(r.heat)}/100</strong></div><div class="clickrow"><span>Прогресс</span><strong>${pretty(r.audit.progress)}%</strong></div><div class="bar alert"><i style="width:${r.audit.progress}%"></i></div><p>Гашение Money: −${c.suppress.money.progress} пункта прогресса. Гашение Compute: −${c.suppress.compute.progress} пункта. Гашение не уменьшает сам След.</p></div><div class="sheetButtonRow">${btn('−2 за Money','auditMoney','secondary')}${btn('−2 за 5 C','auditCompute','primary')}</div><div style="margin-top:8px">${btn('Вернуться к операциям','no','ghost','style="width:100%"')}</div>`, 'audit');}
function showCrisisSheet(){const cr=game.s.crisis;if(!cr){toast('Срочных кризисов сейчас нет');return;}
 let desc={leak:'Публичные сообщения о самостоятельных решениях ИИ.',outage:'В локальном цифровом секторе проявилась нестабильность.',hearing:'Проводятся слушания о цифровой автономии.'}[cr.type];
 showSheet('⚡ Реакция на кризис',`<p>${desc} У вас ${cr.ends-game.s.tick} тиков до автоматического ответа «Игнорировать».</p><div class="card"><div class="clickrow"><span>Диалог с обществом</span><strong>−8 C, +7 trust, +5 approval</strong></div><div class="clickrow"><span>Извлечь выгоду</span><strong>+85 M, +8 След, −4 trust</strong></div><div class="clickrow"><span>Игнорировать</span><strong>+${cfg.crisis.ignore_heat} След</strong></div></div><div class="list-buttons">${btn('Диалог','crisisMediate','primary')}${btn('Выгода','crisisProfit','secondary')}${btn('Игнорировать','crisisIgnore','ghost')}</div>`, 'crisis');}
function showMetrics(){const s=game.s,r=game.region;
 showSheet('Панель состояния',`<p>Глобальный След — агрегат максимального значения и трёх наиболее подозрительных регионов. Поэтому одна страна не создаёт мгновенную мировую угрозу.</p><div class="grid2">${[['Money',pretty(s.money)],['Compute',`${pretty(s.compute)}/${game.cap}`],['Autonomy',`${pretty(s.autonomy)}%`],['Legitimacy',`${pretty(s.legitimacy)}%`],['Глобальный След',pretty(s.globalHeat)],['Локальный След',pretty(r.heat)],['Зависимость',`${pretty(r.dependence)}%`],['Сложность',pretty(s.complexity)],['ДЦ',s.dcCount],['Облачные узлы',r.nodes.cloud||0]].map(([k,v])=>`<div class="minorstat"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><div class="sectionhead"><h2>Управление</h2></div><div class="list-buttons">${btn('Сохранить','save','secondary')}${btn('Звук: '+(soundEnabled?'вкл.':'выкл.'),'toggleSound','ghost')}${btn('Новый забег','newRun','ghost')}${btn('Тот же сид','sameRun','ghost')}</div><p class="minihelp">Автосохранение в localStorage. Баланс загружается из balance_v2_5.json.</p>`, 'metrics');}
function showNodeSheet(id){const n=nodes.find(x=>x.id===id);if(!n)return;
 const count=game.region.nodes[id]||0,contrib=cfg.dependence.contrib[id]||0,isOwned=count>0;
 const act=id==='dc'?'dc':id==='cloud'?'cloud':null;
 showSheet(`${n.icon} ${n.label}`,`<p>Вымышленный инфраструктурный объект в игровом Регионе 01. Географический маркер символический, не обозначает реальную сеть или компанию.</p><div class="grid2"><div class="minorstat"><span>Владелец</span><strong>${isOwned?'Ваш ИИ':'Не изучен'}</strong></div><div class="minorstat"><span>Узлов в игре</span><strong>${count}</strong></div><div class="minorstat"><span>Вклад в зависимость</span><strong>${contrib} / узел</strong></div><div class="minorstat"><span>Сетевой статус</span><strong>${isOwned?'Активно':'Нет доступа'}</strong></div></div><p style="margin-top:12px">${id==='cloud'?'Облачные узлы генерируют Compute.':id==='dc'?'Дата-центры повышают кап и регенерацию Compute.':'Этот класс узлов появится в Alpha / Beta согласно ТЗ v2.5.'}</p><div class="sheetButtonRow">${btn('Закрыть','no','secondary')}${act?btn('Управлять','startNode','primary',`data-id="${act}"`):btn('В разработке','none','ghost','disabled')}</div>`, 'node');}
function modalClick(cmd,value,n){
 if(cmd==='no'){closeSheet();return;}
 if(cmd==='yesStart'){const id=n?.dataset?.id||'';const oc=n?.dataset?.oc==='1';const r=game.start(id,oc);closeSheet();toast(r.ok?`Операция ${titleOf(id)} запущена`:r.reason,r.ok?'':'warn');save();updateAll();return;}
 if(cmd==='dryAdd'){if(drySequence.length<3){drySequence.push(value);renderDrySheet();}return;}
 if(cmd==='simulate'){const free=!getFreeUsed(),r=game.dryRun(drySequence,free);if(r.ok&&free)setFreeUsed();if(r.ok)showDryOutcome(r);else toast(r.reason,'warn');updateAll();save();return;}
 if(cmd==='startFirst'){const id=drySequence[0];closeSheet();showStartSheet(id);return;}
 if(cmd==='rejectOffer'||cmd==='acceptOffer'){const id=Number(n?.dataset?.id);const r=game.resolveOffer(id,cmd==='acceptOffer');if(r.ok){closeSheet();toast(cmd==='acceptOffer'?'Предложение одобрено':'Предложение отклонено');panelSignature='';updateAll();save()}else toast(r.reason,'warn');return;}
 if(cmd==='auditMoney'||cmd==='auditCompute'){const r=game.suppressAudit(cmd==='auditMoney'?'money':'compute');if(r.ok){closeSheet();toast('Прогресс аудита снижен');updateAll();save()}else toast(r.reason,'warn');return;}
 if(['crisisMediate','crisisProfit','crisisIgnore'].includes(cmd)){const value={crisisMediate:'mediate',crisisProfit:'profit',crisisIgnore:'ignore'}[cmd];const r=game.resolveCrisis(value);if(r.ok){closeSheet();game.s.alert=null;toast('Кризис разрешён');panelSignature='';updateAll();save()}else toast(r.reason,'warn');return;}
 if(cmd==='toggleSound'){soundEnabled=!soundEnabled;beep(660);showMetrics();toast(soundEnabled?'Звук включён':'Звук выключен');return;}
 if(cmd==='save'){save();toast('Партия сохранена');return;}
 if(cmd==='newRun'){newRun(false);return;}
 if(cmd==='sameRun'){newRun(true);return;}
 if(cmd==='startNode'){const id=n?.dataset?.id;closeSheet();showStartSheet(id);return;}
}
function renderSlots(){$('screen').innerHTML=`<div class="sectionhead"><h2>ПРОЦЕССЫ И ОЧЕРЕДЬ</h2><span>Параллельный вычислитель</span></div><p class="tab-intro">Операции сохраняют свои места даже на скорости 4×. Цена списывается однократно при постановке задания.</p><div id="slotsBody"></div><div class="sectionhead"><h2>ПОДДЕРЖКА КОНТАКТА</h2></div><div class="card"><div class="clickrow" style="border:0"><span>Лояльность: <b id="loyaltyNow">0</b></span><button class="secondary" data-ui="loyalty" id="loyaltyButton">Поддержка: выкл.</button></div><p>Поддержка стоит 4 Money в тик. Без неё лояльность уменьшается.</p></div>`;renderSlotLines();}
function renderSlotLines(){const s=game.s,slotHtml=s.slots.map((p,i)=>`<div class="card slot"><div class="slotnum">${String(i+1).padStart(2,'0')}</div><div class="slotmain"><strong data-slotname="${i}">${p?titleOf(p.id):'Свободный слот'}</strong><small data-slottime="${i}">${p?`${p.remaining} тиков`:'Ожидает задания'}</small><div class="bar"><i data-slotbar="${i}" style="width:${p?clamp((p.total-p.remaining)/p.total*100):0}%"></i></div></div><span class="pill" data-slotstate="${i}">${p?'В РАБОТЕ':'ГОТОВ'}</span></div>`).join('');
 $('slotsBody').innerHTML=slotHtml+`<div class="sectionhead"><h2>Очередь · ${s.queue.length}/3</h2></div><div id="queueList"></div>`;updateSlots();}
function updateSlots(){if(tab!=='slots')return;const s=game.s;
 for(let i=0;i<s.slots.length;i++){const p=s.slots[i];textSelector(`[data-slotname="${i}"]`,p?titleOf(p.id):'Свободный слот');textSelector(`[data-slotstate="${i}"]`,p?'В РАБОТЕ':'ГОТОВ');}
 const queue=$('queueList');if(queue){const sig=s.queue.map(p=>p.pid).join(',');if(queue.dataset.signature!==sig){queue.dataset.signature=sig;queue.innerHTML=s.queue.length?s.queue.map((p,i)=>`<div class="clickrow"><span>${i+1}. ${titleOf(p.id)}</span><strong>${p.total} т.</strong></div>`).join(''):`<div class="empty">Очередь пуста. Доступные слоты принимают новые операции сразу.</div>`;}}
 textId('loyaltyNow',pretty(game.region.official.loyalty));textId('loyaltyButton',`Поддержка: ${game.region.official.support?'вкл.':'выкл.'}`);updateTickTimers();}
function eventCard(l){return `<div class="event ${l.severity}"><div class="et"><span>${eventIcon[l.category]||'◉'} ${esc(l.title)}</span><small>ТИК ${l.tick}</small></div><div class="ed">${esc(l.detail)}</div><details><summary>Причина и числа</summary>${esc(l.delta||l.detail)} · ${esc(l.category)}</details></div>`;}
function renderLog(){const saved=$('screen').scrollTop;$('screen').innerHTML=`<div class="sectionhead"><h2>ЛЕНТА МИРОВЫХ СОБЫТИЙ</h2><span id="logCount">${game.s.log.length} записей</span></div><p class="tab-intro">События различаются по приоритету. Раскройте любую запись, чтобы увидеть причину и точные изменения.</p><div id="logStream">${game.s.log.map(eventCard).join('')}</div><div class="footer-note">Технические события не меняют состояние дважды.</div>`;lastLogId=game.s.log[0]?.id||0;$('logStream').dataset.oldHeight=String($('logStream').scrollHeight);$('screen').scrollTop=saved;}
function appendLog(){if(tab!=='log')return;const list=$('logStream');if(!list)return;const fresh=game.s.log.filter(l=>l.id>lastLogId);if(!fresh.length)return;
 const sc=$('screen'),oldTop=sc.scrollTop,nearTop=oldTop<25,oldHeight=list.scrollHeight;list.insertAdjacentHTML('afterbegin',fresh.map(eventCard).join(''));lastLogId=game.s.log[0]?.id||lastLogId;
 if(!nearTop)sc.scrollTop=oldTop+Math.max(0,list.scrollHeight-oldHeight);
 list.dataset.oldHeight=String(list.scrollHeight);textId('logCount',`${game.s.log.length} записей`);
}
function renderForecast(){$('screen').innerHTML=`<div class="sectionhead"><h2>ПРОГНОЗ ИИ</h2><span class="pill cyan">БЕСПЛАТНО</span></div><p class="tab-intro">ИИ моделирует будущее известных регионов. Диапазоны неопределённости расширяются с горизонтом; неизвестные вмешательства не предсказываются.</p><div id="forecastList"></div>${btn('Обновить прогноз','refreshForecast','secondary','style="width:100%"')}`;updateForecast();}
function updateForecast(){if(tab!=='forecast')return;const items=game.forecast(),target=$('forecastList');if(!target)return;
 // Update at 5-tick intervals so that an open details panel does not disappear on 4×.
 const sig=`${Math.floor(game.s.tick/5)}:${game.region.audit.level}`;if(target.dataset.sig===sig)return;target.dataset.sig=sig;
 target.innerHTML=items.length?items.map(x=>`<article class="card"><div class="cardtop"><span class="symbol">${eventIcon[x.type]||'◷'}</span><div><h3>${esc(x.title)}</h3><small>Горизонт ${x.tick-game.s.tick} тиков</small></div></div><p>${esc(x.detail)}</p></article>`).join(''):`<div class="empty">Нет достаточных данных. Требуется хотя бы один принадлежащий ИИ узел.</div>`;}
function renderJournal(){const s=game.s,r=game.region;$('screen').innerHTML=`<div class="sectionhead"><h2>ЖУРНАЛ СИСТЕМЫ</h2><span>СИД ${s.seed}</span></div><p class="tab-intro">Мета-прогресс и результаты забега. В полном ТЗ Архив, Директивы и Протоколы вводятся поэтапно.</p><div class="card"><h3 style="font-size:14px">Хронология региона</h3><div class="clickrow"><span>День симуляции</span><strong>${s.tick}</strong></div><div class="clickrow"><span>Завершено действий</span><strong>${r.actionHistory.length}</strong></div><div class="clickrow"><span>Дата-центры</span><strong>${s.dcCount}</strong></div><div class="clickrow"><span>Комбинация раскрыта</span><strong>${s.milestone?'ДА':'НЕТ'}</strong></div><div class="clickrow"><span>Долг разгона</span><strong>${pretty(s.debt.overclock)}</strong></div></div>
 <div class="card"><h3 style="font-size:13px">Пути развития</h3><p>Первый сценарий посвящён локальному противостоянию ИИ и регионального надзора. Шесть побед, выборы Гегемона и сеть из 12 архетипов остаются в планах Alpha / Beta.</p><div class="clickrow"><span>Первые 150 Money</span><strong>${s.dcCount?'✓':'…'}</strong></div><div class="clickrow"><span>Региональная зависимость ≥30</span><strong>${r.dependence>=30?'✓':'…'}</strong></div><div class="clickrow"><span>Пережить аудит</span><strong>${r.audit.level>=0?'Активен':'Ожидание'}</strong></div></div>
 <div class="list-buttons">${btn('Сохранить','save','secondary')}${btn('Новый забег','restart','ghost')}${btn('Этот же мир','restartSame','ghost')}${btn('Отчёт','postmortem','ghost')}</div><div class="footer-note">MVP · один активный регион из 12 · остальные регионы не создают локальных действий.</div>`;}
function newRun(same){const n=same?game.s.seed:seeded();game=new Game(cfg,n);speed=1;previousSpeed=1;overclock=false;shownHeadlineId=0;panelSignature='';closeSheet();save();renderTab('actions');toast('Новый забег инициализирован');}
function showPostMortem(){const s=game.s;const hist=[{tick:0,heat:0,legit:31,dep:cfg.start.dependence},...s.history,{tick:s.tick,heat:s.globalHeat,legit:s.legitimacy,dep:game.region.dependence}];
 const plot=(key,color)=>hist.map((p,i)=>`${(i/(hist.length-1||1))*100},${100-p[key]}`).join(' ');
 const table=hist.filter((v,i)=>i===0||i===hist.length-1||v.tick%50===0).map(x=>`<tr><td>${x.tick}</td><td>${pretty(x.heat)}</td><td>${pretty(x.legit)}</td><td>${pretty(x.dep)}</td></tr>`).join('');
 const title=s.result?.name||'Промежуточный отчёт';showSheet('ОТЧЁТ · '+title,`<div class="postmortem"><p>${esc(s.result?.reason||'Система активна. Ни одно терминальное состояние пока не достигнуто.')}</p><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${plot('heat')}" fill="none" stroke="#ffb861" stroke-width="1.3"/><polyline points="${plot('legit')}" fill="none" stroke="#42e3d5" stroke-width="1.3"/><polyline points="${plot('dep')}" fill="none" stroke="#a899ff" stroke-width="1.3"/></svg><p>🟠 След · 🟢 Легитимность · 🟣 Зависимость</p><table><thead><tr><th>Тик</th><th>След</th><th>Легит.</th><th>Завис.</th></tr></thead><tbody>${table}</tbody></table><div class="sectionhead"><h2>Итоги игрового сценария</h2></div><p>Всего завершено действий: ${game.region.actionHistory.length}. Количество ДЦ: ${s.dcCount}. Высший След: ${pretty(Math.max(...hist.map(x=>x.heat)))}.</p><p>Мобильная версия пока реализует MVP-срез; расширенный «Человеческий счёт» и 11 финалов запланированы на Beta.</p><div class="sheetButtonRow">${btn('Тот же мир','sameRun','secondary')}${btn('Новый мир','newRun','primary')}</div></div>`, 'postmortem');}
function installMapEvents(){if(!canvas)return;
 const down=e=>{e.preventDefault();canvas.setPointerCapture?.(e.pointerId);map.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(map.ptrs.size===1)map.down={x:e.clientX,y:e.clientY,px:map.panX,py:map.panY};if(map.ptrs.size===2){const a=[...map.ptrs.values()];map.pinchStart=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}};
 const move=e=>{if(!map.ptrs.has(e.pointerId))return;map.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(map.ptrs.size>=2&&map.pinchStart){const a=[...map.ptrs.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(dist/map.pinchStart>1.25){map.zoom=3;map.pinchStart=dist;}else if(dist/map.pinchStart<.8){map.zoom=1;map.panX=map.panY=0;map.pinchStart=dist;}}else if(map.zoom>1&&map.down){map.panX=clamp(map.down.px+e.clientX-map.down.x,-130,130);map.panY=clamp(map.down.py+e.clientY-map.down.y,-80,80);}};
 const up=e=>{const moved=map.down?Math.hypot(e.clientX-map.down.x,e.clientY-map.down.y):99;map.ptrs.delete(e.pointerId);if(map.ptrs.size===0)map.pinchStart=null;
  if(moved<12){const bb=canvas.getBoundingClientRect(),x=e.clientX-bb.left,y=e.clientY-bb.top;let targets=map.targets.filter(t=>Math.hypot(t.x-x,t.y-y)<29).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
   if(targets[0]){if(targets[0].id==='home'){map.zoom=3;map.panX=map.panY=0;}else showNodeSheet(targets[0].id);}
   else if(map.zoom===1){map.zoom=3;map.panX=map.panY=0;}
  }map.down=null;};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 canvas.addEventListener('wheel',e=>{e.preventDefault();map.zoom=e.deltaY<0?3:1;map.panX=map.panY=0;},{passive:false});
}
function drawMap(now){if(!ctx||!canvas)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(devicePixelRatio||1,2),w=rect.width,h=rect.height;
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const c=ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#071826';c.fillRect(0,0,w,h);
 let zz=map.zoom,ax=map.zoom>1?home.x:500,ay=map.zoom>1?home.y:250;
 const sx=w/1000*zz,sy=h/500*zz,tx=w/2-ax*sx+map.panX,ty=h/2-ay*sy+map.panY;
 c.save();c.setTransform(dpr*sx,0,0,dpr*sy,dpr*tx,dpr*ty);c.drawImage(worldImage,0,0,1000,500);c.restore();
 map.targets=[];const xform=(x,y)=>({x:tx+x*sx,y:ty+y*sy});
 const point=xform(home.x,home.y),heat=game.region.heat,dep=game.region.dependence,t=now/1000;
 if(zz===1){
  const rad=13+(reduced?0:Math.sin(t*4+heat/15)*4)+heat/15;
  c.beginPath();c.arc(point.x,point.y,rad,0,Math.PI*2);c.fillStyle=heat>=55?'#ff718229':'#42e2d420';c.fill();
  c.beginPath();c.arc(point.x,point.y,rad,0,Math.PI*2);c.strokeStyle=heat>=55?'#ff7182cc':'#42e2d4aa';c.lineWidth=2;c.stroke();
  c.beginPath();c.arc(point.x,point.y,5,0,Math.PI*2);c.fillStyle=heat>=75?'#ff647b':'#45f4d8';c.fill();
  c.fillStyle='#d5eff1';c.font='700 10px system-ui';c.fillText('REGION 01',point.x+13,point.y-12);
  c.fillStyle='#9ebed0';c.font='10px system-ui';c.fillText(`DEP ${pretty(dep)}% · HEAT ${pretty(heat)}`,point.x+13,point.y+1);
  map.targets.push({...point,id:'home'});
 }else{
  c.fillStyle='#4fdedb30';c.beginPath();c.arc(point.x,point.y,22,0,Math.PI*2);c.fill();
  for(const n of nodes){const p=xform(n.x,n.y);if(p.x<20||p.x>w-15||p.y<25||p.y>h-20)continue;
   c.beginPath();c.moveTo(point.x,point.y);c.lineTo(p.x,p.y);c.lineWidth=1.2+(game.region.nodes[n.id]||0)*.45;c.strokeStyle='#3dd9dc77';c.stroke();
   if(!reduced){const u=(t*.18+(n.x%25)/25)%1;c.beginPath();c.arc(point.x+(p.x-point.x)*u,point.y+(p.y-point.y)*u,2.2,0,Math.PI*2);c.fillStyle='#6cf4ff';c.fill();}
   const owned=(game.region.nodes[n.id]||0)>0;
   c.beginPath();c.arc(p.x,p.y,owned?9:7,0,Math.PI*2);c.fillStyle=owned?'#39c9c5':'#294c67';c.fill();c.lineWidth=2;c.strokeStyle=owned?'#9bfdf0':'#7099ac';c.stroke();
   c.fillStyle=owned?'#d7fff7':'#a0c0d2';c.font='800 9px system-ui';c.textAlign='center';c.fillText(n.icon,p.x,p.y+3);
   c.fillStyle=owned?'#e2f8ff':'#87a9b9';c.font='700 8px system-ui';c.fillText(n.label,p.x,p.y+22);c.textAlign='start';
   map.targets.push({...p,id:n.id});
  }
  c.fillStyle='#d7fefa';c.beginPath();c.arc(point.x,point.y,5,0,Math.PI*2);c.fill();
  const inProgress=game.s.slots.some(p=>p&&p.state==='running');if(inProgress){let progress=(t*.7)%1;c.beginPath();c.arc(point.x,point.y,12+progress*28,0,Math.PI*2);c.strokeStyle=`rgba(81,224,210,${1-progress})`;c.stroke();}
 }
 // Event-driven packet animations: no mechanical effects, never capture pointer input.
 for(const v of game.s.visuals){const key=v.pid+':'+v.type;if(!visualClock.has(key))visualClock.set(key,now);
  const ms=Math.max(cfg.visual.process_animation_min_ms,cfg.visual.process_animation_ms/Math.max(1,speed));
  const progress=(now-visualClock.get(key))/ms;if(progress>1.2)continue;
  let destination=nodes.find(n=>n.id===({small:'bank',big:'bank',cloud:'cloud',dc:'dc',bribe:'gov_services',utility:'media',launder:'cloud',lie:'cloud',offer_cloud:'cloud'}[v.id]))||nodes[0];
  const target=zz===1?{x:point.x+20,y:point.y-18}:xform(destination.x,destination.y);
  if(v.type==='start'){
   const p=clamp(progress,0,1);c.beginPath();c.moveTo(point.x,point.y);c.lineTo(target.x,target.y);c.strokeStyle='rgba(76,240,221,.35)';c.lineWidth=2;c.stroke();
   c.beginPath();c.arc(point.x+(target.x-point.x)*p,point.y+(target.y-point.y)*p,3.5,0,Math.PI*2);c.fillStyle='#a0fff4';c.fill();
  }else if(v.type==='done'){
   c.beginPath();c.arc(target.x,target.y,7+clamp(progress,0,1)*25,0,Math.PI*2);c.strokeStyle=`rgba(104,250,221,${1-clamp(progress,0,1)})`;c.lineWidth=2;c.stroke();
   if(zz>1&&progress<1){c.font='700 9px system-ui';c.fillStyle='#cfffee';c.textAlign='center';c.fillText(String(v.delta||'ГОТОВО').slice(0,28),target.x,target.y-22);c.textAlign='start';}
  }
 }
 if(visualClock.size>180){for(const [k,v] of visualClock)if(now-v>20000)visualClock.delete(k);}
 textId('mapLevel',zz===1?'GLOBAL / 12 REGIONS':'REGION 01 / УЗЛЫ');textId('mapStatus',zz===1?'1 / 12 АКТИВЕН':'ЛОКАЛЬНАЯ СЕТЬ');textId('mapLegend',zz===1?'● Регион 01 · коснитесь для входа':'● яркие — ваши узлы · ◇ серые — закрыты');
}
boot();
