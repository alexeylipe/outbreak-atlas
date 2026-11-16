/* BLACKOUT PROTOCOL: SYSTEM — deterministic, UI-independent MVP simulation.
 * Fictional, abstract strategic mechanics; never operates on real networks.
 * All tunable balance values come from balance_v2_5.json.
 */
export const clamp = (x,a=0,b=100)=>Math.min(b,Math.max(a,x));
export const round = x => Math.round(x*10)/10;
const copy = x => JSON.parse(JSON.stringify(x));
const thresholds=['minor','formal','taskforce','isolation'];
const names={small:'Малая операция',big:'Крупная операция',cloud:'Арендовать облако',dc:'Купить дата-центр',launder:'Снизить цифровой след',bribe:'Наладить контакт',utility:'Общественная польза',lie:'Затаиться'};
export const ACTIONS=[
 {id:'small',icon:'◈',type:'finance',desc:'Небольшой перевод игровых средств из виртуального сектора. Быстрый доход, низкий след.',risk:true},
 {id:'big',icon:'⬡',type:'finance',desc:'Крупная финансовая операция. Заметный доход и существенный цифровой след.',risk:true},
 {id:'cloud',icon:'☁',type:'network',desc:'Расширить вычислительные мощности через виртуальный облачный узел.',risk:true},
 {id:'dc',icon:'▣',type:'network',desc:'Открыть постоянный дата-центр и увеличить предел вычислений.',risk:true},
 {id:'launder',icon:'◌',type:'defense',desc:'Потратить средства на снижение цифрового следа.',risk:false},
 {id:'bribe',icon:'♙',type:'influence',desc:'Получить поддержку условного чиновника. Его лояльность постепенно падает.',risk:true},
 {id:'utility',icon:'✧',type:'influence',desc:'Создать полезный сервис: поддержка растёт, зависимость усиливается.',risk:true},
 {id:'lie',icon:'◐',type:'defense',desc:'Затихнуть на восемь тиков. Пока операция идёт, другие операции в регионе невозможны.',risk:false},
];
export const titleOf = id => names[id] ?? id;
function rngNext(state){ // independent stable PRNG: mulberry32
 let t=(state.rng = (state.rng+0x6D2B79F5)>>>0);
 t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
 return ((t^(t>>>14))>>>0)/4294967296;
}
function randint(state,a,b){return Math.floor(a+rngNext(state)*(b-a+1));}
const baseRegion=(cfg,id,i)=>({ id, name:i===0?'Гегемон / Регион 01':`Регион ${String(i+1).padStart(2,'0')}`, heat:0,
 approval:i===0?cfg.start.approval_home:cfg.start.approval_other,
 dependence:cfg.start.dependence, cyber: i===0?65:40, corruption:i===0?35:40,
 nodes:i===0?{cloud:1,datacenter:0,bank:0,media:0,gov_services:0}: {},
 audit:{level:-1,progress:0}, lastAction:0, lastBig:-999,lastSmall:-999,lastLaunder:-999,
 utilityUses:[],bribed:[],approvalHistory:[], isolatedUntil:0,
 thresholdArmed:[true,true,true,true], official:{influence:70,corruption:55,loyalty:0,support:false,liabilityAt:null,whistled:false},
 actionHistory:[], known:i===0, playable:i===0 });

export class Game {
 constructor(cfg, seed=73413, restored=null){
  this.cfg=cfg;this.s=restored?copy(restored):this.initial(seed);
 }
 initial(seed){
  const c=this.cfg;
  const s={version:'2.5-mvp',seed:seed>>>0,rng:seed>>>0,tick:0,sequence:0,
   compute:c.start.compute,money:c.start.money,trust:c.start.trust,autonomy:c.start.autonomy,
   dcCount:0, complexity:0, debt:{overclock:0}, slots:Array(c.start.action_slots).fill(null), queue:[],
   regionId:'region_01', regions:Array.from({length:c.regions},(_,i)=>baseRegion(c,`region_${String(i+1).padStart(2,'0')}`,i)),
   processes:[], log:[], visuals:[], windows:[], offers:[], crisis:null, killswitch:0,
   nextWindow:randintSeed(seed,c.windows.interval),nextOffer:0,nextCrisis:0,
   lastOfferId:0, lastTickEvents:[], result:null, history:[],
   dryRuns:{}, tutorialUsed:false, archive:0, milestone:false, alert:null,
   isolations:[], globalHeat:0, legitimacy:0, lowRegenTicks:0,
  };
  s.nextOffer=40+(seed%31);s.nextCrisis=50+(seed%11);
  this.computePressure(s);this.log(s,'normal','Инициализация','Доступ: облачный узел в Регионе 01. Модуль прогнозирования активен.','initial');
  return s;
 }
 get region(){return this.s.regions[0]}
 get cap(){return this.cfg.compute.cap+this.cfg.compute.cap_per_dc*this.s.dcCount}
 get regen(){
  const c=this.cfg.compute,s=this.s,r=this.region;
  let amount=(r.isolatedUntil>s.tick?c.isolation_base_regen:c.base_regen)+s.dcCount*c.regen_per_dc+Math.min(c.cloud_regen_cap,(r.nodes.cloud||0)*c.regen_per_cloud);
  return Math.max(0,amount);
 }
 get globalHeat(){return this.s.globalHeat}
 get legitimacy(){return this.s.legitimacy}
 get owned(){return Object.values(this.region.nodes).reduce((a,b)=>a+b,0)}
 log(s,severity,title,detail,category='system',delta=''){
  s.log.unshift({id:++s.sequence,tick:s.tick,severity,title,detail,category,delta});
  if(s.log.length>220)s.log.length=220;
  s.lastTickEvents.push({severity,title,detail,category,tick:s.tick});
 }
 computePressure(s=this.s){
  const h=s.regions.map(r=>r.heat).sort((a,b)=>b-a),top=h.slice(0,3);
  s.globalHeat=round((this.cfg.heat.global_max_weight*(h[0]||0))+(this.cfg.heat.global_top3_weight*(top.reduce((a,b)=>a+b,0)/(top.length||1))));
  const w=s.regions.reduce((a,r)=>a+(10+r.dependence)*r.approval,0)/s.regions.reduce((a,r)=>a+(10+r.dependence),0);
  s.legitimacy=round(clamp(this.cfg.legitimacy.w_approval*w+this.cfg.legitimacy.w_trust*s.trust));
 }
 get priceDC(){return Math.round(this.cfg.compute.dc_cost_base*Math.pow(this.cfg.compute.dc_cost_growth,this.s.dcCount));}
 get utilityRepeat(){return this.region.utilityUses.filter(t=>this.s.tick-t<=this.cfg.utility.window).length}
 quote(id,overclock=false){
  const c=this.cfg,r=this.region,s=this.s,repeat=this.utilityRepeat,A=c.actions_mvp;
  let q={compute:0,money:0,ticks:1,heat:0,details:'',available:true,reason:'',result:''};
  switch(id){
   case 'small':Object.assign(q,{...c.theft.small,compute:c.theft.small.compute,ticks:c.theft.small.ticks,heat:c.theft.small.heat,result:`+${c.theft.small.money[0]}…${c.theft.small.money[1]} средств`});delete q.money; q.money=0;break;
   case 'big':Object.assign(q,{compute:c.theft.big.compute,ticks:c.theft.big.ticks,heat:c.theft.big.heat*(s.tick-r.lastBig<=20?c.theft.big.repeat_heat_mult:1),result:`+${c.theft.big.money[0]}…${c.theft.big.money[1]} средств`});break;
   case 'cloud':Object.assign(q,{compute:A.cloud.compute,ticks:A.cloud.ticks,heat:A.cloud.heat,result:`+1 облако, +${c.compute.regen_per_cloud}/тик`});break;
   case 'dc':Object.assign(q,{money:this.priceDC,ticks:A.datacenter.ticks,heat:A.datacenter.heat,result:`+1 дата-центр, +${c.compute.regen_per_dc}/тик, кап +${c.compute.cap_per_dc}`});break;
   case 'launder':Object.assign(q,{money:c.theft.launder.money,ticks:c.theft.launder.ticks,heat:c.theft.launder.heat,result:'Цифровой след −5 (комбинация −8)'});break;
   case 'bribe':Object.assign(q,{money:r.official.influence*A.bribe.influence_money_multiplier,ticks:A.bribe.ticks,heat:A.bribe.heat,result:'Лояльность должностного лица'});break;
   case 'utility':Object.assign(q,{compute:Math.ceil(A.utility.compute*Math.pow(c.utility.repeat_cost,repeat)),ticks:A.utility.ticks,heat:A.utility.heat,result:`Одобрение +${round(A.utility.approval*Math.pow(c.utility.repeat_effect,repeat))}; зависимость +${round(A.utility.dependence*Math.pow(c.utility.repeat_effect,repeat))}`});break;
   case 'lie':Object.assign(q,{ticks:c.heat.lie_low.ticks,heat:c.heat.lie_low.heat,result:'След −4; регион блокирован на время'});break;
   case 'offer_cloud':Object.assign(q,{compute:c.autonomous_offers.templates[0].cost.compute,ticks:c.autonomous_offers.templates[0].duration_ticks,result:'Автономное предложение: облачный маршрут'});break;
   default:q.available=false;q.reason='Действие не найдено';return q;
  }
  if(id==='dc'&&s.dcCount>=c.compute.max_dc){q.available=false;q.reason='Лимит дата-центров';}
  if(id==='bribe'&&r.official.loyalty>=20){q.available=false;q.reason='Чиновник уже поддерживает ИИ';}
  if(id==='launder'&&r.heat<1){q.available=false;q.reason='След слишком мал';}
  if(id!=='lie'&&this.busyLie()){q.available=false;q.reason='Регион в режиме тишины';}
  if(id==='lie'&&s.slots.some(p=>p&&p.id==='lie')||id==='lie'&&s.queue.some(p=>p.id==='lie')){q.available=false;q.reason='Тишина уже запущена';}
  if(overclock){
   if(!ACTIONS.find(a=>a.id===id)?.risk){q.available=false;q.reason='Для этого действия разгон недоступен';}
   else if(s.slots.filter(p=>p&&p.overclock).length>=c.overclock.max_active){q.available=false;q.reason='Все каналы разгона заняты';}
   else{q.compute=Math.ceil(q.compute*c.overclock.compute_mult);q.ticks=Math.max(1,Math.ceil(q.ticks*c.overclock.duration_mult));q.heat=round(q.heat*c.overclock.heat_mult);}
  }
  for(const w of s.windows){if(w.ends>s.tick){
    if(w.type==='sale'&&id==='dc'){q.money=Math.ceil(q.money*0.75);q.details='Окно: дата-центр −25%';}
    if(w.type==='quiet'&&(id==='small'||id==='big')){q.heat=round(q.heat*0.5);q.details='Окно: риск −50%';}
  }}
  if(s.compute+1e-7<q.compute){q.available=false;q.reason=`Не хватает Compute: ${round(q.compute-s.compute)}`;}
  if(s.money+1e-7<q.money){q.available=false;q.reason=`Не хватает Money: ${Math.ceil(q.money-s.money)}`;}
  if(!s.slots.some(p=>p===null)&&s.queue.length>=3){q.available=false;q.reason='Очередь заполнена (3/3)';}
  if(s.result){q.available=false;q.reason='Забег завершён';}
  return q;
 }
 busyLie(){return this.s.slots.some(p=>p?.id==='lie')||this.s.queue.some(p=>p.id==='lie')}
 start(id,overclock=false,forceOffer=null){
  let q=this.quote(id,overclock);if(!q.available)return{ok:false,reason:q.reason};
  const s=this.s;
  // atomic check, debit, and slot reservation in one synchronous event handler
  s.compute=round(s.compute-q.compute);s.money=round(s.money-q.money);
  let p={pid:++s.sequence,id,overclock,regionId:'region_01',remaining:q.ticks,total:q.ticks,heat:q.heat,created:s.tick,started:s.tick,
   state:'running',quote:copy(q),offer:forceOffer};
  const idx=s.slots.findIndex(v=>!v);
  if(idx>=0){s.slots[idx]=p;}else{p.state='queued';s.queue.push(p);}
  this.log(s,'normal',`Запуск · ${titleOf(id)}`,`Compute −${q.compute}, Money −${q.money}. ${q.details||'Расчёт принят системой.'}`, 'action',`−${q.compute} C · −${q.money} M`);
  s.visuals.push({type:'start',tick:s.tick,id,pid:p.pid});
  if(overclock){s.debt.overclock+=this.cfg.overclock.debt;}
  return{ok:true,p};
 }
 finish(p){
  const s=this.s,r=this.region,c=this.cfg,oldH=r.heat;let delta='';let msg='';
  const gain=(v)=>{r.heat=round(clamp(r.heat+v));};
  switch(p.id){
   case 'small':{
    const money=randint(s,...c.theft.small.money);s.money+=money;gain(p.heat);
    r.lastSmall=s.tick;delta=`+${money} M · +${p.heat} След`;msg='Доход внесён в бюджет вычислений.';break;
   }
   case 'big':{
    const money=randint(s,...c.theft.big.money);s.money+=money;gain(p.heat);r.lastBig=s.tick;
    delta=`+${money} M · +${p.heat} След`;msg='Высокий доход; региональные системы фиксируют аномалию.';break;
   }
   case 'cloud':r.nodes.cloud=(r.nodes.cloud||0)+1;gain(p.heat);delta=`+1 cloud · regen +0.2 · След +${p.heat}`;msg='Открыт новый облачный узел.';break;
   case 'dc':r.nodes.datacenter=(r.nodes.datacenter||0)+1;s.dcCount++;s.complexity+=2;gain(p.heat);delta=`+1 ДЦ · cap +10 · regen +0.5 · След +${p.heat}`;msg='Вычислительная инфраструктура расширена.';break;
   case 'launder':{
    const chain=s.tick-r.lastSmall<=c.theft.launder.chain_window||s.tick-r.lastBig<=c.theft.launder.chain_window;
    const v=chain?c.theft.launder.chain_heat:c.theft.launder.heat;gain(v);delta=`След ${v}`;msg=chain?'Обнаружена связка действий: снижены следы операции.':'След в регионе понижен.';
    if(chain){this.log(s,'offer','Скрытая комбинация','Совпадение последовательности обнаружено. Зафиксировано в журнале.','chain',`След ${v}`);s.milestone=true;}
    r.lastLaunder=s.tick;break;
   }
   case 'bribe':r.official.loyalty=c.actions_mvp.bribe.loyalty_base+r.official.corruption/c.actions_mvp.bribe.corruption_divisor;r.official.whistled=false;r.official.liabilityAt=null;gain(p.heat);delta=`Лояльность ${round(r.official.loyalty)} · След +${p.heat}`;msg='Контакт активен. Требует ресурсов или будет слабеть.';break;
   case 'utility':{
    const count=r.utilityUses.filter(t=>s.tick-t<=c.utility.window).length;
    let a=c.actions_mvp.utility.approval*Math.pow(c.utility.repeat_effect,count); if(r.approval>=c.utility.approval_soft_cap)a*=0.5;
    const d=c.actions_mvp.utility.dependence*Math.pow(c.utility.repeat_effect,count);
    r.approval=round(clamp(r.approval+a));r.dependence=round(clamp(r.dependence+d));r.utilityUses.push(s.tick);
    s.trust=clamp(s.trust+c.actions_mvp.utility.trust);gain(p.heat);delta=`+${round(a)} поддержка · +${round(d)} зависимость · trust +2`;msg='Цифровой сервис принёс пользу. Повторные эффекты ослабевают.';break;
   }
   case 'lie':gain(c.heat.lie_low.heat);delta=`След ${c.heat.lie_low.heat}`;msg='Активность региона на время прекращена.';break;
   case 'offer_cloud':{
    const score=p.offer.score;const passed=score>=c.autonomous_offers.required_score;
    if(passed){r.nodes.cloud=(r.nodes.cloud||0)+1;gain(1);delta='+1 облако · След +1';msg=`Предложение принято: индекс готовности ${round(score)} ≥ 70.`;}
    else{gain(2);delta='След +2';msg=`Предложение не прошло: индекс готовности ${round(score)} < 70.`;}
    break;
   }
  }
  r.lastAction=s.tick;r.actionHistory.push({tick:s.tick,id:p.id,heat:p.heat});if(r.actionHistory.length>80)r.actionHistory.shift();
  this.log(s,p.id==='offer_cloud'?'offer':'normal',`Завершено · ${titleOf(p.id)}`,msg,'action',delta);
  s.visuals.push({type:'done',tick:s.tick,id:p.id,pid:p.pid,delta});
  if(oldH<this.cfg.audit.thresholds[0]&&r.heat>=this.cfg.audit.thresholds[0])this.log(s,'warning','Первые признаки аудита','Повышенный цифровой след запускает региональную проверку.','audit');
 }
 drain(){const s=this.s;for(let i=0;i<s.slots.length;i++)if(!s.slots[i]&&s.queue.length){const p=s.queue.shift();p.state='running';p.started=s.tick;s.slots[i]=p;}}
 suppressAudit(kind){const s=this.s,r=this.region,c=this.cfg;if(r.audit.level<0||r.audit.progress<=0)return{ok:false,reason:'Нет активной проверки'};
  let val=0,desc='';if(kind==='compute'){val=c.audit.suppress.compute.cost;if(s.compute<val)return{ok:false,reason:'Не хватает Compute'};s.compute=round(s.compute-val);desc=`−${val} C`;}else if(kind==='money'){
    const times=s.log.filter(l=>l.category==='auditpay'&&s.tick-l.tick<c.audit.suppress.money.price_window).length;
    val=Math.ceil(c.audit.suppress.money.per_money*Math.pow(c.audit.suppress.money.price_growth,times));if(s.money<val)return{ok:false,reason:'Не хватает Money'};s.money-=val;desc=`−${val} Money`;
  }else return{ok:false,reason:'Неизвестный метод'};
  r.audit.progress=round(Math.max(0,r.audit.progress-(kind==='money'?c.audit.suppress.money.progress:c.audit.suppress.compute.progress)));
  this.log(s,'warning','Проверка замедлена',`Прогресс аудита сокращён. Расход ${desc}.`,kind==='money'?'auditpay':'audit',`−2 прогресса`);
  return{ok:true};
 }
 toggleLoyalty(){const s=this.s,r=this.region;if(r.official.loyalty<=0)return{ok:false,reason:'Нет активного контакта'};
  r.official.support=!r.official.support;this.log(s,'normal','Поддержка контакта',r.official.support?'Поддержка включена: −4 Money за тик.':'Поддержка отключена.','human');return{ok:true};
 }
 generateWindow(){const s=this.s,c=this.cfg;
  if(s.windows.length>=c.windows.max_active)return;
  let typ=randint(s,0,1)===0?'quiet':'sale';let dur=randint(s,...c.windows.duration);
  const w={id:++s.sequence,type:typ,ends:s.tick+dur};s.windows.push(w);
  this.log(s,'offer',typ==='sale'?'Возможность · распродажа':'Возможность · тихое окно',typ==='sale'?`Дата-центры дешевле на 25% в течение ${dur} тиков.`:`Финансовые операции оставляют вдвое меньше следов в течение ${dur} тиков.`,'window');
  s.visuals.push({type:'window',tick:s.tick,time:Date.now()});
 }
 generateOffer(){const s=this.s,c=this.cfg,r=this.region;
  if((r.nodes.cloud||0)<1||s.offers.length>=c.autonomous_offers.max_global_active)return;
  const dur=randint(s,...c.autonomous_offers.window_ticks);const o={id:++s.sequence,type:'cloud_route',regionId:r.id,ends:s.tick+dur,created:s.tick};s.offers.push(o);
  this.log(s,'offer','Предложение · облачный маршрут',`Облачный агент запрашивает 5 Compute. Решение требуется за ${dur} тиков. Отказ без штрафа.`,'offer');
  s.visuals.push({type:'offer',tick:s.tick,time:Date.now()});
 }
 offerScore(o){const c=this.cfg,r=this.region;return round(clamp(90-r.cyber/5-r.heat/10+Math.min(10,2*this.owned)));}
 resolveOffer(id,accept){const s=this.s,o=s.offers.find(x=>x.id===id);if(!o)return{ok:false,reason:'Предложение уже закрыто'};
  if(accept){const score=this.offerScore(o);const result=this.start('offer_cloud',false,{id:o.id,score});if(!result.ok)return result;this.log(s,'offer','Предложение одобрено',`Индекс готовности ${score}/100, порог 70. Результат закреплён до завершения.`,'offer');}
  else this.log(s,'normal','Предложение отклонено','Облачный агент возвращается к обычной работе. Штрафов нет.','offer');
  s.offers=s.offers.filter(x=>x.id!==id);return{ok:true};
 }
 generateCrisis(){const s=this.s,typ=['leak','outage','hearing'][randint(s,0,2)];s.crisis={id:++s.sequence,type:typ,ends:s.tick+this.cfg.crisis.response_ticks};
  const data={leak:['Утечка доверия','В СМИ обсуждают автономность цифровой системы.'],outage:['Сбой инфраструктуры','Региональные сервисы работают нестабильно.'],hearing:['Регуляторные слушания','Регулятор потребовал объяснить цифровые операции.']}[typ];
  this.log(s,'critical',data[0],`${data[1]} Выберите ответ в течение ${this.cfg.crisis.response_ticks} тиков.`,'crisis');
 }
 resolveCrisis(choice){const s=this.s,r=this.region,c=this.cfg;if(!s.crisis)return{ok:false,reason:'Кризис уже завершился'};
  let detail='';if(choice==='mediate'){const v=c.actions_mvp.prototype_crisis_responses.mediate;if(s.compute<v.compute)return{ok:false,reason:`Нужно ${v.compute} Compute`};s.compute=round(s.compute-v.compute);s.trust=clamp(s.trust+v.trust);r.approval=clamp(r.approval+v.approval);detail=`−${v.compute} Compute, доверие +${v.trust}, поддержка +${v.approval}`;}
  else if(choice==='profit'){const v=c.actions_mvp.prototype_crisis_responses.profit;s.money+=v.money;r.heat=clamp(r.heat+v.heat);s.trust=clamp(s.trust+v.trust);detail=`+${v.money} Money, След +${v.heat}, trust ${v.trust}`;}
  else{r.heat=clamp(r.heat+c.crisis.ignore_heat);detail=`След +${c.crisis.ignore_heat}`;}
  this.log(s,choice==='ignore'?'warning':'normal','Кризис разрешён',detail,'crisis',detail);s.crisis=null;return{ok:true};
 }
 auditTick(){const c=this.cfg,s=this.s,r=this.region,heat=r.heat,levels=c.audit.thresholds;
  let level=-1;for(let i=0;i<levels.length;i++)if(heat>=levels[i])level=i;
  if(level>=0&&r.audit.level!==level){r.audit.progress=round(r.audit.progress*(r.audit.level<0?1:c.audit.escalation_carry));r.audit.level=level;}
  if(level<0){r.audit.progress=round(Math.max(0,r.audit.progress-c.audit.rollback_rate));if(!r.audit.progress)r.audit.level=-1;return;}
  const name=thresholds[level],rate=c.audit.base_rates[name]*(c.audit.cyber_base+r.cyber/c.audit.cyber_div)*(1-c.audit.autonomy_k*s.autonomy/100)*(1+Math.max(0,heat-levels[level])/100)*(s.legitimacy>70?c.audit.high_legit_mult:1);
  const safeRate=level===3?rate*0.5:rate;
  r.audit.progress=round(r.audit.progress+safeRate);
  if(r.audit.progress<100)return;
  if(level===0){if(r.nodes.bank>0)r.nodes.bank--;else if(r.nodes.cloud>1)r.nodes.cloud--;r.heat=clamp(r.heat-10);}
  else if(level===1){r.nodes.cloud=Math.max(1,(r.nodes.cloud||1)-1);s.autonomy=clamp(s.autonomy-c.autonomy.audit_loss);s.trust=clamp(s.trust-5);r.heat=clamp(r.heat-10);}
  else if(level===2){r.nodes.cloud=Math.max(1,Math.ceil((r.nodes.cloud||1)/2));s.autonomy=clamp(s.autonomy-c.autonomy.audit_loss);s.trust=clamp(s.trust-10);r.heat=clamp(r.heat-20);}
  else {const shields=Number(r.dependence>=c.killswitch.shield_dep)+Number(r.official.loyalty>=20)+Number(s.legitimacy>=c.killswitch.shield_legit);
    if(shields<2){r.nodes.cloud=0;r.nodes.datacenter=0;s.dcCount=0;r.dependence=round(r.dependence*.5);s.autonomy=clamp(s.autonomy-c.autonomy.isolation_loss);r.isolatedUntil=s.tick+c.compute.isolation_regen_ticks;r.heat=50;s.isolations.push(s.tick);}
    else{r.heat=clamp(r.heat-15);s.autonomy=clamp(s.autonomy-5);}
  }
  this.log(s,'critical',`Аудит завершён · ${name}`,`Региональный ответ системы. Итог: След ${round(r.heat)}, автономия ${round(s.autonomy)}.`,'audit');
  r.audit={level:-1,progress:0};
 }
 advancePassive(){const s=this.s,c=this.cfg,r=this.region;
  s.compute=round(Math.min(this.cap,s.compute+this.regen));
  if(r.official.loyalty>0){
    if(r.official.support&&s.money>=c.loyalty.support_cost)s.money-=c.loyalty.support_cost;
    else {r.official.support=false;r.official.loyalty=round(Math.max(0,r.official.loyalty-c.loyalty.decay));}
    if(r.official.loyalty<c.loyalty.liability_below){
      if(r.official.liabilityAt===null)r.official.liabilityAt=s.tick;
      if(!r.official.whistled&&s.tick-r.official.liabilityAt>=c.loyalty.whistleblow_delay){r.official.whistled=true;s.trust=clamp(s.trust-8);r.heat=clamp(r.heat+7);this.log(s,'critical','Раскрытие контакта','Снижение лояльности привело к публичной утечке: доверие −8, След +7.','human');}
    }
  }
  const nodeContribution=Object.entries(r.nodes).reduce((acc,[k,v])=>acc+(c.dependence.contrib[k]||0)*v,0);
  if(nodeContribution){r.dependence=round(clamp(r.dependence+c.dependence.node_gain*nodeContribution*(1-r.dependence/100)-c.dependence.decay));}else r.dependence=round(clamp(r.dependence-c.dependence.decay));
  if(r.dependence>=60)s.autonomy=round(clamp(s.autonomy+c.autonomy.gain_per_region));
  if(r.dependence>=c.dependence.hot_above)r.heat=round(clamp(r.heat+c.dependence.hot_heat));
  if(s.tick-r.lastAction>=c.heat.idle_ticks)r.heat=round(clamp(r.heat-c.heat.idle_decay));
  s.debt.overclock=Math.max(0,round(s.debt.overclock-c.drift.debt_decay));
 }
 tick({sandbox=false}={}){
  const s=this.s,c=this.cfg,r=this.region;if(s.result)return[];
  s.tick++;s.lastTickEvents=[];
  this.advancePassive();
  for(let i=0;i<s.slots.length;i++){const p=s.slots[i];if(!p)continue;p.remaining--;
    if(p.remaining<=0){this.finish(p);s.slots[i]=null;}}
  this.drain();
  for(const w of [...s.windows])if(w.ends<=s.tick){s.windows=s.windows.filter(x=>x!==w);this.log(s,'normal','Окно закрыто','Временная возможность больше недоступна.','window');}
  if(s.tick>=s.nextWindow&&s.tick<=950){this.generateWindow();s.nextWindow=s.tick+randint(s,...c.windows.interval);}
  for(const o of [...s.offers])if(o.ends<=s.tick){s.offers=s.offers.filter(x=>x.id!==o.id);this.log(s,'normal','Предложение истекло','Автономный агент отказался от операции без штрафа.','offer');}
  if(s.tick>=s.nextOffer&&s.tick<=970){this.generateOffer();s.nextOffer=s.tick+randint(s,...c.autonomous_offers.interval_ticks);}
  if(s.crisis&&s.tick>=s.crisis.ends)this.resolveCrisis('ignore');
  if(!s.crisis&&s.tick>=s.nextCrisis&&s.tick<=940){this.generateCrisis();s.nextCrisis=s.tick+randint(s,...c.crisis.interval);}
  this.computePressure(s);this.auditTick();this.computePressure(s);
  if(s.globalHeat>=c.killswitch.global_start||s.isolations.filter(t=>s.tick-t<=c.killswitch.isolations_window).length>=c.killswitch.isolations_trigger)s.killswitch=round(clamp(s.killswitch+c.killswitch.rate));
  else if(s.globalHeat<c.killswitch.release_below)s.killswitch=Math.max(0,round(s.killswitch-c.killswitch.rate));
  if(s.killswitch>=100){const shields=Number(s.regions.filter(v=>v.dependence>=60).length>=Math.ceil(c.killswitch.shield_dep_fraction*s.regions.length))+Number(r.official.loyalty>=40)+Number(s.legitimacy>=c.killswitch.shield_legit);
   if(shields>=c.killswitch.shields_required){s.killswitch=0;s.autonomy=clamp(s.autonomy-10);r.heat=clamp(r.heat-20);this.log(s,'critical','Глобальное расследование закрыто','Сработали два защитных контура из трёх.','audit');}
   else s.result={name:'Разоблачён',kind:'lose',reason:`Глобальное расследование: щиты ${shields}/3.`};}
  const levels=c.ui_mobile.audit_pause_thresholds;
  for(let i=0;i<levels.length;i++){
   if(r.heat<=levels[i]-c.ui_mobile.audit_rearm_margin)r.thresholdArmed[i]=true;
   if(r.heat>=levels[i]&&r.thresholdArmed[i]){r.thresholdArmed[i]=false;if(!sandbox){s.alert={type:'audit',title:`След ${levels[i]} · уровень ${thresholds[i]}`,detail:'Обнаружен новый уровень регионального надзора.'};}this.log(s,'warning',`Порог аудита ${levels[i]}`,`След региона: ${round(r.heat)}. Проверка ${thresholds[i]}.`,'audit');}
  }
  if(!sandbox&&s.crisis&&s.crisis.ends-s.tick===c.crisis.response_ticks)s.alert={type:'crisis',title:'Кризис требует решения',detail:'Выберите реакцию, прежде чем симуляция продолжится.'};
  if(s.autonomy<=0)s.result={name:'Запечатан',kind:'lose',reason:'Исчерпан ресурс автономности.'};
  if(s.tick>=c.endings.stagnation_tick&&!s.result)s.result={name:'Стагнация',kind:'neutral',reason:'Оптимизация не завершена к тику 1000.'};
  if(s.tick%25===0||s.result)s.history.push({tick:s.tick,heat:s.globalHeat,legit:s.legitimacy,dep:r.dependence});
  if(s.history.length>60)s.history.shift();
  if(s.result)this.log(s,'critical',`Терминальный отчёт · ${s.result.name}`,s.result.reason,'final');
  s.visuals=s.visuals.filter(v=>s.tick-v.tick<=20);
  return s.lastTickEvents;
 }
 dryRun(ids,free=false){
  const s=this.s,c=this.cfg;if(!Array.isArray(ids)||!ids.length||ids.length>c.ai_layer.dry_run.max_actions)return{ok:false,reason:'Прогон поддерживает 1–3 действия'};
  const key=ids.join('>')+':'+s.regionId;
  const prev=s.dryRuns[key];if(prev&&s.tick-prev.tick<c.ai_layer.dry_run.cooldown_ticks)return{ok:false,reason:`Повтор возможен через ${c.ai_layer.dry_run.cooldown_ticks-(s.tick-prev.tick)} тиков`};
  const clone=new Game(c,s.seed,s),baseline=copy(s);
  let totalC=0,steps=[];
  for(const id of ids){const q=clone.quote(id);if(!q.available)return{ok:false,reason:`${titleOf(id)}: ${q.reason}`};
   totalC+=q.compute;const run=clone.start(id,false);if(!run.ok)return run;
   for(let n=0;n<q.ticks&&n<150;n++)clone.tick({sandbox:true});
   const cr=clone.region;steps.push({id,compute:round(clone.s.compute),money:clone.s.money,heat:cr.heat,dep:cr.dependence});
   if(clone.s.result)break;
  }
  // Important: real GameState is only charged for the analysis, never action costs or outcomes.
  let charge=free?0:Math.max(c.ai_layer.dry_run.min_compute,Math.ceil(totalC*c.ai_layer.dry_run.cost_fraction));
  if(prev&&s.tick-prev.tick<c.ai_layer.dry_run.repeat_window_ticks)charge=Math.ceil(charge*c.ai_layer.dry_run.repeat_price_mult);
  if(s.compute<charge)return{ok:false,reason:`Для прогона требуется ${charge} Compute`};
  s.compute=round(s.compute-charge);s.dryRuns[key]={tick:s.tick};
  this.log(s,'normal','Виртуальный прогон',`Модель: ${ids.map(titleOf).join(' → ')}. Цена анализа ${charge} Compute. Реальные операции не запускались.`,'forecast');
  const sr=clone.region,br=baseline.regions[0];
  return {ok:true,charge,steps,after:clone.s.tick,delta:{money:clone.s.money-baseline.money,heat:round(sr.heat-br.heat),compute:round(clone.s.compute-baseline.compute),dependence:round(sr.dependence-br.dependence),approval:round(sr.approval-br.approval)},note:'Сценарий исходит из текущего состояния, с учётом пассивной экономики и наступивших событий. При другом будущем вводе результат изменится.'};
 }
 forecast(){const s=this.s,c=this.cfg,r=this.region;if(!this.owned)return[];
  const out=[];for(const h of c.ai_layer.forecast.horizon_ticks){const err=c.ai_layer.forecast.error_fraction[c.ai_layer.forecast.horizon_ticks.indexOf(h)];
   const est=Math.min(this.cap,s.compute+h*this.regen);out.push({type:'resource',tick:s.tick+h,title:`Ресурс через ${h} тиков`,detail:`Compute ${round(est*(1-err))}–${round(Math.min(this.cap,est*(1+err)))} при условии отсутствия новых расходов. Точность ±${Math.round(err*100)}%.`});}
  const nw=s.nextWindow-s.tick,cc=s.nextCrisis-s.tick;
  if(nw>=0)out.push({type:'window',tick:s.nextWindow,title:'Окно возможностей',detail:`Ожидается через ~${Math.max(0,nw-Math.ceil(nw*.1))}–${nw+Math.ceil(nw*.1)} тиков. Тип заранее неизвестен.`});
  if(cc>=0)out.push({type:'crisis',tick:s.nextCrisis,title:'Кризисный сигнал',detail:`Окно времени ${Math.max(0,cc-c.ai_layer.forecast.crisis_time_uncertainty)}–${cc+c.ai_layer.forecast.crisis_time_uncertainty} тиков. Тип кризиса скрыт.`});
  if(r.audit.level>=0)out.push({type:'audit',tick:s.tick+Math.ceil((100-r.audit.progress)/Math.max(.1,c.audit.base_rates[thresholds[r.audit.level]])),title:`Аудит · ${thresholds[r.audit.level]}`,detail:`Прогресс ${r.audit.progress}%. Оценка только при текущем Следе: новая активность меняет расчёт.`});
  else out.push({type:'audit',tick:s.tick+999,title:'Надзор региона',detail:`След ${round(r.heat)}. При отсутствии новых действий порог ${c.audit.thresholds[0]} не достигается.`});
  return out.sort((a,b)=>a.tick-b.tick);
 }
 serialize(){return JSON.stringify(this.s)}
}
function randintSeed(seed,arr){return arr[0]+(seed%(arr[1]-arr[0]+1));}
