/* OUTBREAK: ATLAS — fictional strategy simulation, no external dependencies. */
(() => {
'use strict';
const POP = 1e6;
const DATA = [ // name, population in millions, map x/y in 1000×520, wealth, climate, travel hub
 ['Канада',39,158,105,0.9,'cold',0.7],['США',340,162,174,0.95,'temperate',1],['Мексика',129,154,242,0.52,'hot',0.7],['Бразилия',216,280,360,0.56,'hot',0.85],['Аргентина',46,271,440,0.65,'temperate',0.5],['Колумбия',52,229,298,0.55,'hot',0.6],['Перу',34,220,354,0.48,'hot',0.4],['Чили',20,244,426,0.72,'temperate',0.4],
 ['Великобритания',68,459,135,0.91,'temperate',1],['Франция',65,470,166,0.90,'temperate',1],['Испания',48,452,198,0.80,'hot',0.8],['Германия',84,502,154,0.93,'temperate',1],['Италия',59,501,193,0.83,'hot',0.8],['Швеция',11,509,92,0.95,'cold',0.55],['Россия',145,640,116,0.60,'cold',0.75],['Турция',85,558,206,0.60,'temperate',0.8],
 ['Египет',112,533,261,0.4,'hot',0.55],['Нигерия',224,470,323,0.30,'hot',0.65],['Эфиопия',126,551,339,0.20,'hot',0.4],['ЮАР',60,505,432,0.48,'temperate',0.65],['ДР Конго',102,506,365,0.17,'hot',0.3],['Кения',55,562,371,0.35,'hot',0.45],
 ['Индия',1430,682,298,0.38,'hot',1],['Пакистан',241,635,278,0.27,'hot',0.55],['Китай',1410,757,221,0.65,'temperate',1],['Япония',124,871,215,0.90,'temperate',1],['Южная Корея',52,840,219,0.91,'temperate',0.85],['Индонезия',277,763,369,0.44,'hot',0.8],['Таиланд',72,742,310,0.55,'hot',0.8],['Вьетнам',100,780,328,0.47,'hot',0.65],['Австралия',27,854,427,0.92,'hot',0.9],['Новая Зеландия',5,930,460,0.92,'temperate',0.35],['Саудовская Аравия',36,593,267,0.74,'hot',0.85],['Иран',89,611,236,0.43,'hot',0.5],['Казахстан',20,690,174,0.58,'cold',0.45],['Филиппины',117,834,336,0.42,'hot',0.55]
];
const LAND = [
 [[40,83],[108,58],[178,66],[215,96],[211,135],[252,155],[232,179],[217,210],[189,220],[176,262],[139,248],[118,214],[91,204],[68,156],[43,139]],
 [[207,265],[263,262],[314,289],[340,332],[327,379],[299,412],[289,461],[257,492],[240,458],[224,406],[207,364],[194,316]],
 [[422,114],[446,95],[478,110],[499,103],[528,122],[540,155],[512,179],[492,199],[452,184],[436,155]],
 [[449,226],[514,230],[564,252],[590,299],[580,362],[545,432],[520,471],[481,430],[458,381],[441,316]],
 [[527,106],[562,69],[634,61],[697,77],[764,63],[834,79],[900,111],[923,151],[877,181],[853,217],[807,242],[772,286],[741,286],[719,331],[678,305],[658,262],[612,248],[584,221],[555,197],[531,154]],
 [[738,337],[783,347],[801,378],[776,387],[741,373]],[[807,391],[876,370],[921,400],[924,440],[894,463],[835,468],[808,437]],[[917,442],[934,444],[950,479],[929,495]],[[838,319],[856,322],[863,347],[844,361]],[[874,197],[886,217],[879,242],[869,236]]
];
const UPGRADES = [
 {id:'air',name:'Воздушные пути',cat:'transfer',base:7,max:3,desc:'Повышает вероятность передачи между транспортными узлами.',effect:'+40% международная передача'},
 {id:'water',name:'Водная среда',cat:'transfer',base:7,max:3,desc:'Ускоряет распространение в жарком и влажном климате.',effect:'+35% распространение в жарких странах'},
 {id:'contact',name:'Социальные контакты',cat:'transfer',base:6,max:4,desc:'Увеличивает общий темп распространения внутри стран.',effect:'+25% заразность'},
 {id:'latent',name:'Скрытая фаза',cat:'traits',base:9,max:3,desc:'Замедляет выявление инфекции и раннее вмешательство.',effect:'−18% заметность'},
 {id:'resist',name:'Устойчивость к климату',cat:'traits',base:10,max:3,desc:'Сокращает штраф холодного климата.',effect:'улучшенная адаптация'},
 {id:'severity',name:'Выраженные симптомы',cat:'traits',base:8,max:4,desc:'Усиливает тяжесть заболевания, но ускоряет разработку лекарства.',effect:'+тяжесть, +летальность'},
 {id:'mutation',name:'Генетическая изменчивость',cat:'traits',base:12,max:3,desc:'Замедляет общий прогресс исследований.',effect:'−скорость исследований'},
 {id:'network',name:'Транспортные цепочки',cat:'abilities',base:11,max:2,desc:'Частично компенсирует закрытие транспортных коридоров.',effect:'+международные связи'},
 {id:'stealth',name:'Маскировка вспышек',cat:'abilities',base:12,max:3,desc:'Уменьшает заметность ранних вспышек.',effect:'−реакция властей'},
 {id:'evolve',name:'Адаптивная эволюция',cat:'abilities',base:14,max:2,desc:'Повышает доход игровых очков от новых стран.',effect:'+очки ДНК'}
];
const $ = id => document.getElementById(id), fmt = n => {if(n>=1e9)return(n/1e9).toFixed(2)+' млрд';if(n>=1e6)return(n/1e6).toFixed(1)+' млн';if(n>=1e3)return(n/1e3).toFixed(1)+' тыс';return Math.floor(n).toLocaleString('ru-RU')}, clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const totalPop=DATA.reduce((a,c)=>a+c[1]*POP,0);
const fresh=()=>({day:0,dna:14,cure:0,awareness:0,started:false,over:false,victory:false,speed:1,tab:'countries',category:'transfer',log:'Выберите страну, чтобы начать распространение вымышленного патогена.',up:{},countries:DATA.map((d,i)=>({id:i,name:d[0],pop:d[1]*POP,x:d[2],y:d[3],wealth:d[4],climate:d[5],hub:d[6],infected:0,dead:0,recovered:0,quarantine:0,firstSeen:false}))});
let state, timer=null, last=0, selected=null, frames=0;
function load(){try{let s=JSON.parse(localStorage.getItem('outbreak_atlas_v1'));if(s&&s.countries?.length===DATA.length&&typeof s.day==='number'&&s.up){state={...fresh(),...s};state.speed=1;return}}catch(e){}state=fresh()}
function save(){try{localStorage.setItem('outbreak_atlas_v1',JSON.stringify(state));showNotice('Партия сохранена на этом устройстве.')}catch(e){showNotice('Сохранение недоступно в этом браузере.')}}
function showNotice(s){state.log=s;renderHud()}
const level=id=>state.up[id]||0;
function cost(u){return Math.ceil(u.base*Math.pow(1.65,level(u.id)))}
function start(id){if(state.started)return;const c=state.countries[id];c.infected=12;state.started=true;state.log=`Первый очаг зарегистрирован: ${c.name}. Развивайте свойства и следите за действиями государств.`;renderAll()}
function chooseCountry(id){selected=id;const c=state.countries[id];const s=c.pop-c.infected-c.dead-c.recovered;openModal(c.name, `<p class="muted">Население: ${fmt(c.pop)} · Климат: ${{cold:'холодный',hot:'жаркий',temperate:'умеренный'}[c.climate]}</p><div class="detail-stat"><span>Восприимчивы</span><strong>${fmt(Math.max(0,s))}</strong></div><div class="detail-stat"><span>Заражено</span><strong>${fmt(c.infected)}</strong></div><div class="detail-stat"><span>Выздоровели</span><strong>${fmt(c.recovered)}</strong></div><div class="detail-stat"><span>Погибло</span><strong>${fmt(c.dead)}</strong></div><div class="detail-stat"><span>Ограничения</span><strong>${Math.round(c.quarantine*100)}%</strong></div><div class="progress red"><div style="width:${clamp(100*c.infected/c.pop,0,100)}%"></div></div>`,!state.started?[{label:'Начать здесь',action:()=>{closeModal();start(id)}},{label:'Отмена',action:closeModal,secondary:true}]:[{label:'Закрыть',action:closeModal}])}
function openModal(title,html,actions){$('modalTitle').textContent=title;$('modalBody').innerHTML=html;const el=$('modalActions');el.innerHTML='';const row=document.createElement('div');row.className='buttons';for(const a of actions){const b=document.createElement('button');b.className=a.secondary?'secondary':'primary';b.textContent=a.label;b.onclick=a.action;row.appendChild(b)}el.appendChild(row);$('modal').hidden=false}
function closeModal(){$('modal').hidden=true}
function buy(id){const u=UPGRADES.find(u=>u.id===id);if(!u||level(id)>=u.max||state.dna<cost(u)||state.over)return;state.dna-=cost(u);state.up[id]=(state.up[id]||0)+1;state.log=`Эволюция: ${u.name} — уровень ${level(id)}.`;renderAll()}
function simulate(){if(!state.started||state.over)return;state.day++;
 const cs=state.countries, upgrades=state.up, get=id=>upgrades[id]||0;
 const infectedTotal=cs.reduce((s,c)=>s+c.infected,0);
 const severity=get('severity'), stealth=get('latent')+get('stealth');
 const infectious=(0.23+get('contact')*.065)*(1+get('water')*.035);
 const fatality=(.0007+severity*.00165);
 const infectiousPressure=infectedTotal/totalPop;
 state.awareness=clamp(state.awareness+Math.min(.018,infectiousPressure*.45+severity*.00055)*Math.max(.30,1-stealth*.12),0,1);
 const borders=state.awareness>.13;
 const exposures=new Array(cs.length).fill(0);
 for(const a of cs){if(a.infected<80)continue;
  const sourcePower=Math.log10(a.infected+1)-1;
  for(const b of cs){if(a===b||b.infected>0||b.pop-b.dead-b.recovered<20)continue;
   const dx=a.x-b.x,dy=a.y-b.y,dist=Math.hypot(dx,dy);
   const hub=(a.hub*b.hub),adj=dist<125?1.7:dist<280?1.05:.6;
   const closure=(1-a.quarantine*.75)*(1-b.quarantine*.75);
   const chance=(.00028+get('air')*.00022+get('network')*.00011)*sourcePower*hub*adj*closure*(borders?.62:1)*(1+get('water')*.12);
   exposures[b.id]+=chance;
  }
 }
 let newCountries=0,newInfections=0;
 for(const c of cs){const susceptible=Math.max(0,c.pop-c.infected-c.dead-c.recovered);
  if(c.infected===0 && Math.random()<1-Math.exp(-exposures[c.id])){c.infected=4+Math.floor(Math.random()*12);if(!c.firstSeen){c.firstSeen=true;newCountries++;state.dna+=2+get('evolve')}}
  if(c.infected>0){const climateFactor=c.climate==='cold'?(.65+.1*get('resist')):c.climate==='hot'?1+.09*get('water'):1;
   const protection=(1-c.quarantine*.66);
   const rate=infectious*climateFactor*protection;
   const newCases=Math.min(susceptible,Math.floor(rate*c.infected*susceptible/c.pop));
   const healing=Math.min(c.infected,Math.floor(c.infected*(.065+state.cure*.00035)));
   const deaths=Math.min(c.infected-healing,Math.floor(c.infected*fatality*(1+c.wealth*-.30)));
   c.infected=clamp(c.infected+newCases-healing-deaths,0,c.pop);c.recovered+=healing;c.dead+=deaths;newInfections+=newCases;
   if(state.awareness>.07&&c.infected/c.pop>.00018){const target=clamp((state.awareness*.57)+(c.infected/c.pop)*.7+(c.wealth*.11)-get('stealth')*.018,0,.85);c.quarantine+=(target-c.quarantine)*.09}
   else c.quarantine*=.993;
  }
 }
 // Treat recovery as loss of susceptibility: fictional compact SIRD model.
 const totalInf=cs.reduce((s,c)=>s+c.infected,0), totalDead=cs.reduce((s,c)=>s+c.dead,0);
 if(state.awareness>.1){const funding=cs.reduce((s,c)=>s+c.wealth*c.pop,0)/totalPop;
  const research=.07+state.awareness*.27+funding*.13+(severity*.035);
  state.cure=clamp(state.cure+research*Math.max(.42,1-get('mutation')*.15),0,100);
 }
 if(state.cure>=100){state.over=true;state.victory=false;state.speed=0;state.log='Лекарство разработано. Человечество победило. Попробуйте другую стратегию.';endScreen();}
 else if(totalInf===0 && state.day>5){state.over=true;state.victory=false;state.speed=0;state.log='Активных случаев больше нет. Вспышка завершилась.';endScreen();}
 else if(totalDead/totalPop>.72){state.over=true;state.victory=true;state.speed=0;state.log='Глобальное поражение человечества — победа патогена.';endScreen();}
 else if(totalInf/totalPop>.34&&state.day%9===0){state.log='Критический уровень: медицинские системы перегружены во многих странах.'}
 else if(newCountries){const freshNames=cs.filter(c=>c.firstSeen&&c.infected<300).slice(0,3).map(c=>c.name).join(', ');state.log=`Новые очаги (${newCountries}): ${freshNames||'международные транспортные узлы'}. Получены очки ДНК.`}
 else if(state.day%15===0){state.log=state.awareness>.13?'Государства усиливают санитарный контроль и финансируют исследования.':'Международные перевозки продолжаются. Власти оценивают угрозу.'}
 if(state.day%5===0){state.dna+=1+Math.floor(Math.log10(newInfections+1)/3)}
 if(state.day%10===0){try{localStorage.setItem('outbreak_atlas_v1',JSON.stringify(state))}catch(e){}}
 renderAll();
}
function endScreen(){setTimeout(()=>openModal(state.victory?'Победа':'Поражение',`<p>${state.log}</p><p class="muted">Продолжительность: ${state.day} дней. Лекарство: ${state.cure.toFixed(1)}%.</p>`,[{label:'Новая партия',action:()=>{closeModal();reset()}},{label:'Посмотреть мир',action:closeModal,secondary:true}]),100)}
function reset(){state=fresh();selected=null;try{localStorage.removeItem('outbreak_atlas_v1')}catch(e){}renderAll()}
function totals(){return state.countries.reduce((a,c)=>{a.i+=c.infected;a.d+=c.dead;a.r+=c.recovered;if(c.infected>0)a.active++;if(c.infected+c.dead+c.recovered>0)a.affected++;return a},{i:0,d:0,r:0,active:0,affected:0})}
function renderHud(){const t=totals();$('infectedStat').textContent=fmt(t.i);$('deadStat').textContent=fmt(t.d);$('dnaStat').textContent=state.dna;$('cureStat').textContent=state.cure.toFixed(1)+'%';$('dayStat').textContent=state.day;$('dateText').textContent=`День ${state.day} · ${t.affected} из ${state.countries.length} стран`;$('newsText').textContent=state.log;$('phase').textContent=state.over?(state.victory?'ПОБЕДА':'ИГРА ОКОНЧЕНА'):state.started?(state.awareness>.25?'МИРОВОЙ КРИЗИС':state.awareness>.07?'ЭПИДЕМИЯ':'СКРЫТОЕ РАСПРОСТРАНЕНИЕ'):'НАБЛЮДЕНИЕ';document.querySelectorAll('.speed').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===state.speed))}
function renderTabs(){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));const el=$('tabContent');
 if(state.tab==='countries'){const sorted=[...state.countries].sort((a,b)=>b.infected-a.infected||b.pop-a.pop);el.innerHTML=`<div class="section-top"><b>Страны мира</b><small class="muted">${totals().affected}/${DATA.length} затронуто</small></div>${sorted.map(c=>`<button class="country-row" data-country="${c.id}"><div><b>${c.name}</b><small>Население ${fmt(c.pop)} · заражено ${fmt(c.infected)}</small></div><span class="pill ${c.infected/c.pop>.15?'hot':''}">${c.infected?((c.infected/c.pop)*100).toFixed(2)+'%':'Нет случаев'}</span></button>`).join('')}`;el.querySelectorAll('[data-country]').forEach(b=>b.addEventListener('click',()=>chooseCountry(+b.dataset.country)))}
 else if(state.tab==='evolution'){const categoryNames={transfer:'Передача',traits:'Свойства',abilities:'Способности'};el.innerHTML=`<div class="section-top"><b>Эволюция патогена</b><span class="pill">🧬 ${state.dna} ДНК</span></div><p class="muted">Улучшения — абстрактные игровые модификаторы, не отражающие реальную биологию.</p><div class="category-buttons">${Object.keys(categoryNames).map(k=>`<button class="category-btn ${state.category===k?'active':''}" data-category="${k}">${categoryNames[k]}</button>`).join('')}</div><div class="upgrades">${UPGRADES.filter(u=>u.cat===state.category).map(u=>{const lvl=level(u.id),maxed=lvl>=u.max;return `<article class="upgrade ${maxed?'owned':''}"><div class="upgrade-head"><div class="name">${u.name}</div><span class="pill">${lvl}/${u.max}</span></div><p class="desc">${u.desc}</p><div class="upgrade-bottom"><span>${u.effect}</span><button class="buy" data-buy="${u.id}" ${maxed||state.dna<cost(u)||state.over?'disabled':''}>${maxed?'MAX':'🧬 '+cost(u)}</button></div></article>`}).join('')}</div>`;el.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;renderTabs()});el.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy))}
 else{const t=totals();const stats=[['Население мира',fmt(totalPop),100],['Активные случаи',fmt(t.i),100*t.i/totalPop],['Выздоровели',fmt(t.r),100*t.r/totalPop],['Погибло',fmt(t.d),100*t.d/totalPop],['Прогресс лекарства',state.cure.toFixed(1)+'%',state.cure],['Готовность государств',Math.floor(state.awareness*100)+'%',state.awareness*100]];el.innerHTML=`<b>Глобальная статистика</b><p class="muted">Вымышленная модель с условными параметрами и агрегированными странами.</p>${stats.map((s,i)=>`<div class="world-kpi"><div class="section-top"><span>${s[0]}</span><b>${s[1]}</b></div><div class="progress ${i===3?'red':''}"><div style="width:${clamp(s[2],0,100)}%"></div></div></div>`).join('')}<p class="muted">Граница закрывается постепенно по мере роста тревоги. Состоятельные страны быстрее реагируют на вспышки; исследования ускоряются с ростом угрозы.</p>`}
}
const canvas=$('worldMap'),ctx=canvas.getContext('2d');let cw=1000,ch=520;
function paint(){const dpr=window.devicePixelRatio||1;const bounds=canvas.getBoundingClientRect();const width=Math.max(300,Math.round(bounds.width*dpr)),height=Math.max(150,Math.round(bounds.height*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}ctx.setTransform(width/1000,0,0,height/520,0,0);ctx.clearRect(0,0,1000,520);const g=ctx.createLinearGradient(0,0,950,520);g.addColorStop(0,'#0b2537');g.addColorStop(1,'#0c1729');ctx.fillStyle=g;ctx.fillRect(0,0,1000,520);
 ctx.lineWidth=.7;ctx.strokeStyle='#294052';for(let x=0;x<1000;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,520);ctx.stroke()}for(let y=0;y<520;y+=52){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1000,y);ctx.stroke()}
 LAND.forEach((poly,i)=>{ctx.beginPath();poly.forEach(([x,y],j)=>j?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=i%2?'#1b3c45':'#1d414b';ctx.strokeStyle='#36727b';ctx.lineWidth=1.4;ctx.fill();ctx.stroke()});
 // International transport links are abstract and shown only between affected hubs.
 if(state.started){const hubs=state.countries.filter(c=>c.hub>.75&&c.infected>0).slice(0,12);ctx.lineWidth=.65;ctx.strokeStyle='#efad5c44';for(let i=0;i<hubs.length;i++)for(let j=i+1;j<hubs.length;j++)if(Math.hypot(hubs[i].x-hubs[j].x,hubs[i].y-hubs[j].y)<350){ctx.beginPath();ctx.moveTo(hubs[i].x,hubs[i].y);ctx.lineTo(hubs[j].x,hubs[j].y);ctx.stroke()}}
 state.countries.forEach(c=>{let ratio=c.infected/c.pop;let r=4.2+(c.hub*1.8)+Math.min(8,Math.sqrt(ratio)*20);ctx.beginPath();ctx.arc(c.x,c.y,r,0,Math.PI*2);let color=ratio>.15?'#fb6478':ratio>0?'#f8c368':'#65cfb2';if(ratio>0){ctx.fillStyle=ratio>.15?'#fa667824':'#f5c96f20';ctx.beginPath();ctx.arc(c.x,c.y,r+5+Math.sin(frames/10+c.id)*2,0,Math.PI*2);ctx.fill()}ctx.fillStyle=color;ctx.beginPath();ctx.arc(c.x,c.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#071b29';ctx.lineWidth=1.7;ctx.stroke();if(c.id===selected){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.x,c.y,r+5,0,Math.PI*2);ctx.stroke()}});
 ctx.font='bold 12px system-ui';ctx.fillStyle='#93bbcd';ctx.fillText('АМЕРИКА',112,282);ctx.fillText('ЕВРОПА',452,71);ctx.fillText('АФРИКА',453,284);ctx.fillText('АЗИЯ',713,130);ctx.fillText('ОКЕАНИЯ',823,506);frames++}
function renderAll(){renderHud();renderTabs();paint()}
canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*1000/r.width,y=(e.clientY-r.top)*520/r.height;let best=null,dist=Infinity;for(const c of state.countries){const d=Math.hypot(c.x-x,c.y-y);if(d<dist){best=c;dist=d}}if(best&&dist<30)chooseCountry(best.id)});
document.querySelectorAll('.speed').forEach(b=>b.onclick=()=>{state.speed=Number(b.dataset.speed);renderHud()});document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;renderTabs()});$('saveBtn').onclick=save;$('resetBtn').onclick=()=>openModal('Новая игра','<p class="muted">Текущий прогресс будет удалён. Начать новую партию?</p>',[{label:'Новая игра',action:()=>{closeModal();reset()}},{label:'Отмена',secondary:true,action:closeModal}]);$('modal').querySelector('[data-close]').onclick=closeModal;
window.addEventListener('resize',paint);document.addEventListener('visibilitychange',()=>{last=performance.now()});
load();renderAll();last=performance.now();function loop(now){const delta=Math.min(100,now-last);last=now; if(!document.hidden&&state.speed>0&&state.started&&!state.over){acc+=delta;const step=950/state.speed;let n=0;while(acc>=step&&n<4){simulate();acc-=step;n++}}paint();requestAnimationFrame(loop)}let acc=0;requestAnimationFrame(loop);
})();
