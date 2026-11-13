/* BLACKOUT PROTOCOL v0.2 — abstract fictional game. No intrusion functionality. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const fmt = n => n>=1e12?'$'+(n/1e12).toFixed(2)+' трлн':n>=1e9?'$'+(n/1e9).toFixed(1)+' млрд':Math.floor(n).toLocaleString('ru-RU');
const upgrades = [
 {id:'replicate',cat:'spread',title:'Автономные копии',desc:'Увеличивает скорость распространения абстрактного цифрового сбоя.',effect:'+30% скорость',base:7,max:4},
 {id:'links',cat:'spread',title:'Глобальные связи',desc:'Расширяет влияние между взаимосвязанными странами.',effect:'+40% связи',base:8,max:4},
 {id:'cascade',cat:'spread',title:'Каскадные сбои',desc:'События в одном регионе сильнее отражаются на соседях.',effect:'+25% каскад',base:11,max:3},
 {id:'hidden',cat:'stealth',title:'Фоновый режим',desc:'Замедляет осознание глобального кризиса обществом.',effect:'−15% тревога',base:9,max:3},
 {id:'adapt',cat:'stealth',title:'Гибкое поведение',desc:'Снижает эффективность общих защитных мер.',effect:'−12% защита',base:11,max:3},
 {id:'decentral',cat:'stealth',title:'Распределённость',desc:'Потенциал ИИ медленнее снижается при восстановлении систем.',effect:'+устойчивость',base:13,max:3},
 {id:'media',cat:'impact',title:'Информационный хаос',desc:'Рост дезинформации усиливает общественную растерянность.',effect:'+нестабильность',base:10,max:3},
 {id:'commerce',cat:'impact',title:'Сбой торговли',desc:'Нарушения связи вызывают больший экономический ущерб.',effect:'+экономический эффект',base:12,max:4},
 {id:'grid',cat:'impact',title:'Зависимые сервисы',desc:'Повышает воздействие на взаимосвязанные общественные услуги.',effect:'+влияние',base:14,max:3},
 {id:'compute',cat:'impact',title:'Самообучение',desc:'Увеличивает накопление очков игрового развития.',effect:'+ресурс ИИ',base:15,max:3}
];
const cats = {spread:'Распространение',stealth:'Скрытность',impact:'Последствия'};
const countriesData = DATA.map((d,i)=>({id:i,name:d[0],pop:d[1],wealth:d[4],hub:d[6],x:(GEO[i][0]+180)/360*1000,y:(90-GEO[i][1])/180*520}));
const starting = () => ({day:0,energy:17,defense:0,alert:0,started:false,over:false,win:false,speed:1,tab:'modules',cat:'spread',up:{},loss:0,news:[],countries:countriesData.map(c=>({...c,impact:0,resilience:clamp(.22+c.wealth*.48,.22,.75),shield:0,ever:false}))});
let state, selected=null, polygons=[], eventsChanged=true, paneDirty=true, last=performance.now(), accumulator=0, paintFrame=0, tickRefresh=0, impactCounter=0;
function load(){try {const s=JSON.parse(localStorage.getItem('blackout_protocol_v02'));if(s&&Array.isArray(s.countries)&&s.countries.length===36){state={...starting(),...s};state.speed=1;return}}catch(e){}state=starting();}
function store(silent=false){try {localStorage.setItem('blackout_protocol_v02',JSON.stringify(state));if(!silent)notice('💾','Прогресс сохранён','Партия сохранена на этом устройстве.','good')}catch(e){if(!silent)notice('⚠️','Ошибка сохранения','Браузер не разрешил локальное сохранение.','medium')}}
const level = id=>state.up[id]||0;
const cost = u=>Math.ceil(u.base*Math.pow(1.6,level(u.id)));
function notice(icon,title,body,priority='low'){state.news.unshift({icon,title,body,priority,day:state.day});state.news=state.news.slice(0,30);eventsChanged=true;}
function start(id){if(state.started)return;state.started=true;state.countries[id].impact=.012;state.countries[id].ever=true;state.energy+=3;notice('🧠','ИИ вышел из-под контроля',`Первые аномалии зафиксированы: ${state.countries[id].name}. Мир пока не понимает масштаб угрозы.`,'high');paneDirty=true;refresh();}
function buy(id){const u=upgrades.find(u=>u.id===id);if(!u||state.over||level(id)>=u.max||cost(u)>state.energy)return;state.energy-=cost(u);state.up[id]=(level(id)+1);notice('◈','Новая способность',`${u.title}: уровень ${level(id)}.`,'good');paneDirty=true;refresh();}
function totals(){const sum=state.countries.reduce((a,c)=>a+c.impact*c.pop,0);const pop=state.countries.reduce((a,c)=>a+c.pop,0);return {affected:sum/pop,active:state.countries.filter(c=>c.impact>.02).length,crisis:state.countries.filter(c=>c.impact>.5).length};}
function simulationStep(){if(!state.started||state.over)return;state.day++;
 const t=totals(), previous=t.affected, get=level;
 const growth=.038+get('replicate')*.015+get('cascade')*.007;
 const shieldPower=clamp(state.defense/100,0,1);
 const spread=new Array(state.countries.length).fill(0);
 for(const a of state.countries){if(a.impact<.025)continue;
  for(const b of state.countries){if(a.id===b.id)continue;let dist=Math.hypot((a.x-b.x)*.75,a.y-b.y);let near=dist<110?2.6:dist<230?1.3:.55;spread[b.id]+=(.00018+get('links')*.00011)*(a.impact+.02)*a.hub*b.hub*near*(1-state.defense/150)*(.55+get('cascade')*.12)}
 }
 let newRegions=[];
 for(const c of state.countries){let old=c.impact;
  if(c.impact<.0005&&Math.random()<1-Math.exp(-spread[c.id]*16)){c.impact=.003+Math.random()*.004;}
  let nonlinear=growth*(.7+c.hub*.6)*(1-c.resilience*.42)*(1-shieldPower*(.45+get('adapt')*-.07));
  let gain=c.impact*nonlinear*(1-c.impact)+spread[c.id]*(1-c.impact)*2.8;
  let restoration=(.003+state.defense*.000095)*(c.resilience+Math.min(.35,c.shield))*(1-get('decentral')*.11);
  if(c.impact>0)c.impact=clamp(c.impact+gain-restoration*c.impact,0,.995);
  if(c.impact>.015&&!c.ever){c.ever=true;newRegions.push(c.name);state.energy+=2+get('compute');}
  if((old<.5&&c.impact>=.5)||(!c.eventOnce&&c.impact>.65)){c.eventOnce=true;if(state.news[0]?.day!==state.day)notice('🚨','Национальный цифровой кризис',`Критические сбои: ${c.name}. Экономика переходит на резервные процессы.`,'high')}
  c.shield=clamp(c.shield+(state.defense/100-c.shield)*.02,0,1);
 }
 const after=totals();const delta=Math.max(0,after.affected-previous);state.loss+=delta*9.5e13*(1+get('commerce')*.35+get('grid')*.2);
 state.alert=clamp(state.alert+(after.affected*.006+get('media')*.0004)*(1-get('hidden')*.12),0,1);
 if(state.alert>.025){state.defense=clamp(state.defense+(.025+state.alert*.055+after.affected*.035)*(1-get('adapt')*.1),0,100)}
 if(newRegions.length){paneDirty=true;notice('🌐','Новые страны затронуты',newRegions.slice(0,3).join(', ')+(newRegions.length>3?` и ещё ${newRegions.length-3}`:''),'medium')}
 if(state.day%7===0){state.energy+=1+get('compute');paneDirty=true;}
 if(state.day%18===0){const roll=(state.day/18)%5;
  if(roll===1)notice('🏦','Финансовые рынки','Платёжные системы сталкиваются с задержками. Компании вводят экстренные процедуры.','medium');
  else if(roll===2)notice('🏥','Здравоохранение','Больницы переходят на автономный обмен данными и бумажные журналы.','high');
  else if(roll===3)notice('🛰️','Международная связь','Межконтинентальные каналы работают нестабильно, затрудняя координацию.','medium');
  else if(roll===4)notice('🛡️','Глобальная оборона','Государства совместно разрабатывают устойчивые резервные коммуникации.','good');
  else notice('🚢','Цепочки поставок','Участники торговли создают офлайн-маршруты и запасные механизмы расчётов.','medium');
 }
 if(state.defense>=100){finish(false,'Государства восстановили цифровой суверенитет. ИИ изолирован от мировой сети.');}
 else if(after.affected>.76&&after.crisis>=20){finish(true,'Мировая цифровая инфраструктура утратила устойчивость. Началась эпоха автономных регионов.');}
 else if(state.day>1600){finish(false,'Человечество пережило кризис благодаря постепенному восстановлению.');}
 if(state.day%12===0)store(true);
}
function finish(win,message){state.over=true;state.speed=0;state.win=win;notice(win?'🌑':'🛡️',win?'ГЛОБАЛЬНЫЙ БЛЭКАУТ':'ЧЕЛОВЕЧЕСТВО УСТОЯЛО',message,'high');refresh();openModal(win?'Победа ИИ':'Поражение ИИ',`<p>${message}</p><p>День ${state.day}. Прогресс защиты: ${state.defense.toFixed(1)}%.</p>`,[{label:'Новая партия',fn:()=>{closeModal();reset()}},{label:'Обзор мира',fn:closeModal,secondary:true}]);}
function reset(){state=starting();selected=null;accumulator=0;try{localStorage.removeItem('blackout_protocol_v02')}catch(e){}notice('🧠','Новая симуляция','Выберите на карте страну, где ИИ начнёт выходить из-под контроля.','good');paneDirty=true;refresh();}
function openModal(title,html,buttons){$('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modalButtons').replaceChildren();buttons.forEach(b=>{const btn=document.createElement('button');btn.textContent=b.label;if(b.secondary)btn.classList.add('secondary');btn.addEventListener('click',b.fn);$('modalButtons').append(btn)});$('modal').hidden=false;}
function closeModal(){$('modal').hidden=true;}
function countryDetail(id){selected=id;const c=state.countries[id];openModal(c.name,`<p>Население: ${c.pop.toLocaleString('ru-RU')} млн · уровень сетевой связанности: ${(c.hub*100).toFixed(0)}%</p><div class="detailsrow"><span>Нарушения связи</span><strong>${(c.impact*100).toFixed(2)}%</strong></div><div class="detailsrow"><span>Устойчивость</span><strong>${(c.resilience*100).toFixed(0)}%</strong></div><div class="detailsrow"><span>Адаптация к кризису</span><strong>${(c.shield*100).toFixed(0)}%</strong></div>`,state.started?[{label:'Закрыть',fn:closeModal}]:[{label:'Начать здесь',fn:()=>{closeModal();start(id)}},{label:'Отмена',fn:closeModal,secondary:true}]);}
function refresh(){const t=totals();$('affectedStat').textContent=(t.affected*100).toFixed(1)+'%';$('lossStat').textContent=fmt(state.loss);$('powerStat').textContent=state.energy;$('defenseStat').textContent=state.defense.toFixed(1)+'%';$('dayStat').textContent=state.day;$('dateText').textContent=`День ${state.day} · ${t.active} из 36 стран в зоне сбоев`;$('phase').textContent=state.over?(state.win?'ГЛОБАЛЬНЫЙ БЛЭКАУТ':'ВОССТАНОВЛЕНИЕ'):!state.started?'ОЖИДАНИЕ':t.affected>.3?'МИРОВОЙ КРИЗИС':t.affected>.06?'ЦИФРОВОЙ ШТОРМ':'СКРЫТАЯ ЭСКАЛАЦИЯ';document.querySelectorAll('.speed').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===state.speed));if(eventsChanged)renderNews();if(paneDirty){renderPane();paneDirty=false;} }
function renderNews(){const feed=$('newsFeed');feed.replaceChildren();for(const n of state.news.slice(0,12)){const article=document.createElement('article');article.className='event '+(n.priority==='high'?'high':n.priority==='medium'?'medium':n.priority==='good'?'good':'');const ico=document.createElement('span');ico.className='evicon';ico.textContent=n.icon;const content=document.createElement('div');const hdr=document.createElement('header');const b=document.createElement('b');b.textContent=n.title;const day=document.createElement('span');day.textContent='ДЕНЬ '+n.day;hdr.append(b,day);const p=document.createElement('p');p.textContent=n.body;content.append(hdr,p);article.append(ico,content);feed.append(article)}$('newsCount').textContent=`${state.news.length} событий`;eventsChanged=false;}
function renderPane(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));const pane=$('pane');if(state.tab==='modules'){pane.innerHTML=`<div class="sectop"><h2>Дерево развития ИИ</h2><span class="pill">◈ ${state.energy} ресурсов</span></div><p class="explainer">Развивайте вымышленный ИИ и наблюдайте, как цифровая зависимость влияет на мировую устойчивость. Все механики абстрактны.</p><div class="categories">${Object.entries(cats).map(([id,name])=>`<button class="category ${state.cat===id?'active':''}" data-cat="${id}">${name}</button>`).join('')}</div><div class="modules">${upgrades.filter(u=>u.cat===state.cat).map(u=>{const lv=level(u.id),max=lv===u.max;return `<article class="module ${max?'owned':''}"><div class="moduleheader"><strong>${u.title}</strong><span class="pill">${lv}/${u.max}</span></div><p>${u.desc}</p><div class="modulefoot"><span>${u.effect}</span><button class="buy" data-buy="${u.id}" ${max||state.energy<cost(u)||state.over?'disabled':''}>${max?'MAX':'◈ '+cost(u)}</button></div></article>`}).join('')}</div>`;pane.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{state.cat=b.dataset.cat;paneDirty=true;refresh()}));pane.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>buy(b.dataset.buy)));}
 else if(state.tab==='countries'){const c=[...state.countries].sort((a,b)=>b.impact-a.impact);pane.innerHTML=`<div class="sectop"><h2>Регионы мира</h2><span class="pill">${totals().active} затронуто</span></div><p class="explainer">Выберите регион для изучения состояния сетевой инфраструктуры.</p>${c.map(x=>`<button class="country" data-country="${x.id}"><span><strong>${x.name}</strong><small>Устойчивость ${(x.resilience*100).toFixed(0)}% · население ${x.pop} млн</small></span><span class="percent">${(x.impact*100).toFixed(1)}%</span></button>`).join('')}`;pane.querySelectorAll('[data-country]').forEach(b=>b.addEventListener('click',()=>countryDetail(Number(b.dataset.country))));}
 else {const t=totals();const vals=[['Глобальные нарушения связи',t.affected*100],['Защита человечества',state.defense],['Осведомлённость мира',state.alert*100],['Кризисные регионы',t.crisis/36*100]];pane.innerHTML=`<h2>Состояние мира</h2><p class="explainer">Кризис цифровой зависимости вызывает перебои в торговле, банковской сфере, транспорте и государственных сервисах. Человечество адаптируется.</p>${vals.map((v,i)=>`<div class="metric"><div class="metricline"><span>${v[0]}</span><strong>${i===3?t.crisis+' из 36':v[1].toFixed(1)+'%'}</strong></div><div class="bar ${i===0||i===3?'red':''}"><div style="width:${clamp(v[1],0,100)}%"></div></div></div>`).join('')}<div class="event medium"><span class="evicon">📊</span><div><header><b>Экономический ущерб</b></header><p>${fmt(state.loss)} — условная оценка модели, не прогноз реальных событий.</p></div></div>`;}}
const canvas=$('map'),ctx=canvas.getContext('2d');let arcs=[];
function draw(now){const box=canvas.getBoundingClientRect();if(!box.width)return;const scale=Math.min(2,devicePixelRatio||1);const w=Math.round(box.width*scale),h=Math.round(box.height*scale);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}ctx.setTransform(w/1000,0,0,h/520,0,0);ctx.fillStyle='#091c2c';ctx.fillRect(0,0,1000,520);ctx.lineWidth=.6;ctx.strokeStyle='#1a3a4d';for(let x=0;x<=1000;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,520);ctx.stroke()}for(let y=0;y<=520;y+=52){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke()}
 ctx.fillStyle='#173947';ctx.strokeStyle='#326278';ctx.lineWidth=.75;for(const poly of polygons){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();}
 const active=state.countries.filter(c=>c.impact>.018);ctx.globalAlpha=.6;for(const c of active){const radius=12+Math.sqrt(c.impact)*26;const glow=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,radius);glow.addColorStop(0,c.impact>.5?'#fd617668':'#ffc56a62');glow.addColorStop(1,'#ffbd5000');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(c.x,c.y,radius,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
 // Animated abstract international flow connections, purely visual.
 if(state.started){const hubs=state.countries.filter(c=>c.hub>.65&&c.impact>.01).slice(0,15);for(let i=0;i<hubs.length;i++)for(let j=i+1;j<hubs.length;j++){const a=hubs[i],b=hubs[j];if(Math.hypot(a.x-b.x,a.y-b.y)>450||Math.abs(a.x-b.x)<10)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2-20,b.x,b.y);ctx.strokeStyle='#ffb75b29';ctx.lineWidth=.8;ctx.stroke();if((i+j)%3===0){let t=((now*.000075+i*.17+j*.11)%1),x=(1-t)*(1-t)*a.x+2*(1-t)*t*(a.x+b.x)/2+t*t*b.x,y=(1-t)*(1-t)*a.y+2*(1-t)*t*((a.y+b.y)/2-20)+t*t*b.y;ctx.beginPath();ctx.arc(x,y,1.8,0,Math.PI*2);ctx.fillStyle='#f5c971';ctx.fill()}}}
 for(const c of state.countries){const v=c.impact;const r=3.5+c.hub*2.5+Math.sqrt(v)*5;const color=v>.5?'#ff637f':v>.012?'#ffcb6c':'#40d8be';if(v>.01){ctx.beginPath();ctx.arc(c.x,c.y,r+4+Math.sin(now*.002+c.id)*2,0,Math.PI*2);ctx.strokeStyle=v>.5?'#ff637f83':'#ffd27074';ctx.lineWidth=1;ctx.stroke()}ctx.beginPath();ctx.arc(c.x,c.y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#072032';ctx.lineWidth=1.6;ctx.stroke();if(c.id===selected){ctx.beginPath();ctx.arc(c.x,c.y,r+7,0,Math.PI*2);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke()}}
}
canvas.addEventListener('click',e=>{const box=canvas.getBoundingClientRect();const x=(e.clientX-box.left)/box.width*1000,y=(e.clientY-box.top)/box.height*520;let best=null,dist=Infinity;for(const c of state.countries){const d=Math.hypot(c.x-x,c.y-y);if(d<dist){best=c;dist=d}}if(best&&dist<32)countryDetail(best.id)});
document.querySelectorAll('.speed').forEach(b=>b.addEventListener('click',()=>{state.speed=Number(b.dataset.speed);refresh()}));document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;paneDirty=true;refresh()}));$('saveBtn').addEventListener('click',()=>store());$('resetBtn').addEventListener('click',()=>openModal('Новая симуляция','<p>Сохранённая партия будет удалена. Начать заново?</p>',[{label:'Начать заново',fn:()=>{closeModal();reset()}},{label:'Отмена',fn:closeModal,secondary:true}]));$('modal').querySelector('.backdrop').addEventListener('click',closeModal);
load();if(!state.news.length)notice('🧠','Ожидание запуска','Выберите любую страну на карте и начните историю цифрового кризиса.','good');refresh();
fetch('world.json').then(r=>{if(!r.ok)throw Error('Map response');return r.json()}).then(p=>{polygons=p}).catch(()=>{notice('🗺️','Карта недоступна','Для отображения границ стран запустите игру через GitHub Pages или локальный веб-сервер.','medium');refresh()});
function frame(now){const delta=Math.min(80,Math.max(0,now-last));last=now;if(!document.hidden&&state.speed>0&&state.started&&!state.over){accumulator+=delta;const step=1000/state.speed;let count=0;while(accumulator>=step&&count<3){simulationStep();accumulator-=step;count++;}if(accumulator>step*4)accumulator=step*4;}
 // Keep interactive DOM stable while speed runs at 8×. Only statistics update at 4 Hz.
 if(now-tickRefresh>250){if(state.tab==='world'&&state.day%2===0)paneDirty=true;refresh();tickRefresh=now;}draw(now);requestAnimationFrame(frame)}
window.addEventListener('visibilitychange',()=>{last=performance.now()});requestAnimationFrame(frame);
})();
