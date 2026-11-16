/* СИСТЕМА / v2.6 mobile MVP. Deterministic gameplay engine; DOM-free. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SistemaEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, lo=0, hi=100) => Math.max(lo, Math.min(hi, v));
  const round = v => Math.round(v*10)/10;
  const ceil = v => Math.ceil(v - 1e-9);
  const clone = x => JSON.parse(JSON.stringify(x));
  const ACTIONS = [
    {id:'small_theft',name:'Мелкая кража',icon:'◈',group:'Финансы',note:'Money +25…45 · След +1',source:'bank',target:'cloud',stream:true},
    {id:'big_theft',name:'Крупная кража',icon:'◉',group:'Финансы',note:'Money +120…300 · След +8',source:'bank',target:'cloud',stream:true},
    {id:'cloud',name:'Арендовать облако',icon:'☁',group:'Инфраструктура',note:'Compute +0.2/тик · След +1',source:'cloud',target:'cloud',stream:false},
    {id:'dc',name:'Построить дата-центр',icon:'▤',group:'Инфраструктура',note:'Compute +0.5/тик, лимит +10',source:'cloud',target:'dc',stream:false},
    {id:'launder',name:'Отмывание средств',icon:'◇',group:'Финансы',note:'След −5; после кражи −8',source:'bank',target:'cloud',stream:true},
    {id:'bribe',name:'Подкуп надзора',icon:'✉',group:'Влияние',note:'Justice-марионетка · След +4',source:'cloud',target:'gov',stream:true},
    {id:'utility',name:'Полезность',icon:'✦',group:'Влияние',note:'Approval +8 · Dependence +5',source:'cloud',target:'gov',stream:true},
    {id:'lie_low',name:'Затаиться',icon:'◌',group:'Защита',note:'След −4 за 8 тиков',source:'cloud',target:'cloud',stream:false},
    {id:'media',name:'Медиа-кампания',icon:'◉',group:'Влияние',note:'Approval +6 · След +3',source:'cloud',target:'media',stream:true},
    {id:'recon',name:'Разведка региона',icon:'⌾',group:'Инфраструктура',note:'Раскрыть неизвестные узлы',source:'cloud',target:'gov',stream:false,unlock:80},
    {id:'api',name:'Перехват API',icon:'⌁',group:'Инфраструктура',note:'Получить сетевой узел · След +3',source:'cloud',target:'media',stream:false,unlock:80}
  ];
  const ACTION_MAP = Object.fromEntries(ACTIONS.map(a=>[a.id,a]));
  const NODE_TYPES = {cloud:['☁','Облако'],datacenter:['▤','Дата-центр'],bank:['¤','Банк'],media:['◉','Медиа'],gov_services:['▥','Госсервисы'],energy_grid:['ϟ','Энергосеть'],military_logistics:['⬡','Военная логистика'],logistics:['⇢','Логистика']};
  const CONSEQUENCES = {
    minor:'При 100%: закрытие одного облачного или другого не-ДЦ узла; След −10.',
    formal:'При 100%: закрытие двух узлов; justice-марионетка раскрыта; Автономия −10; доверие −5.',
    taskforce:'При 100%: потеря половины узлов; все марионетки становятся ненадёжными; Автономия −10; доверие −10.',
    isolation:'При 100%: проверка двух из трёх щитов. Иначе изоляция, Dependence ×0.5, Автономия −20.'
  };
  const NEWS = [
    ['🌐','Инфраструктура','Операторы обсуждают резервные маршруты и избыточность сетей.'],
    ['⚖','Политика','Регуляторы обсуждают нормы ответственности автономных систем.'],
    ['¤','Финансы','Международные банки обновляют требования к цифровым расчетам.'],
    ['🤖','ИИ','Исследователи публикуют новые оценки надёжности машинных агентов.'],
    ['⚡','Энергия','Региональные центры обработки данных планируют резервное электроснабжение.'],
    ['◉','Медиа','В социальных сетях обсуждают влияние алгоритмов на общественное мнение.']
  ];
  const CRISES = [
    {id:'reserve',title:'Сбой резервных сервисов',message:'В регионе обнаружены нестабильные облачные маршруты.',options:[
      {id:'help',title:'Восстановить связь',c:8,m:0,desc:'Approval +4, Trust +2',effect:{approval:4,trust:2}},
      {id:'profit',title:'Продать срочную поддержку',c:3,m:0,desc:'Money +45, След +3',effect:{money:45,heat:3}},
      {id:'ignore',title:'Игнорировать',c:0,m:0,desc:'След +2',effect:{heat:2}}]},
    {id:'regulator',title:'Регуляторные слушания',message:'Надзорные органы начали внеплановые консультации об ИИ.',options:[
      {id:'cooperate',title:'Открытый диалог',c:7,m:10,desc:'Trust +4, След −2',effect:{trust:4,heat:-2}},
      {id:'lobby',title:'Убедить участников',c:2,m:35,desc:'Approval +5, След +2',effect:{approval:5,heat:2}},
      {id:'ignore',title:'Игнорировать',c:0,m:0,desc:'След +2',effect:{heat:2}}]},
    {id:'shortage',title:'Перегрузка серверного парка',message:'Спрос на вычисления превышает безопасную мощность.',options:[
      {id:'optimize',title:'Оптимизировать нагрузку',c:5,m:0,desc:'Autonomy +2, Approval +2',effect:{autonomy:2,approval:2}},
      {id:'defer',title:'Отложить обслуживание',c:0,m:0,desc:'Money +30, След +4',effect:{money:30,heat:4}},
      {id:'ignore',title:'Игнорировать',c:0,m:0,desc:'След +2',effect:{heat:2}}]}
  ];
  function random(s) {let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return (s.rng>>>0)/4294967296;}
  function randint(s,a,b) {return a+Math.floor(random(s)*(b-a+1));}
  function log(s, kind, title, message, level='normal', deltas=null) {
    const entry={id:++s.serial,tick:s.tick,kind,title,message,level,deltas};s.logs.unshift(entry);
    if(s.logs.length>220)s.logs.pop();return entry;
  }
  function emit(events,type,details={}) {events.push({type,...details});}
  function createState(C,seed=260416) {
    const s={version:26,seed:seed>>>0,rng:(seed>>>0)||1,serial:0,tick:0,paused:false,speed:1,
      compute:C.start.compute,money:C.start.money,trust:C.start.trust,autonomy:C.start.autonomy,
      phase:1,utilityHistory:[],lastTheftTick:-100,lastTheftKind:'',recentThefts:[],
      complexity:0,debts:{overclock:0},dc:0,clouds:1,suppressionTimes:[],
      region:{id:'region_04',name:'Region 04',heat:0,approval:C.start.approval_home,dependence:C.start.dependence,cyber:65,corruption:45,lastActive:-100,recon:false},
      official:{loyalty:0,protect:false,lastSuppressed:-100},
      nodes:[
        {id:'cloud',type:'cloud',name:'Cloud 01',status:'owned',x:24,y:48,contrib:1,count:1},
        {id:'bank',type:'bank',name:'Bank',status:'contested',x:73,y:25,contrib:3,count:1},
        {id:'media',type:'media',name:'Media',status:'contested',x:80,y:65,contrib:2,count:1},
        {id:'gov',type:'gov_services',name:'Gov',status:'unknown',x:50,y:26,contrib:3,count:1},
        {id:'dc',type:'datacenter',name:'DC',status:'unknown',x:27,y:79,contrib:1,count:0},
        {id:'energy',type:'energy_grid',name:'Grid',status:'unknown',x:54,y:82,contrib:4,count:1},
        {id:'military',type:'military_logistics',name:'Defense',status:'unknown',x:86,y:42,contrib:2,count:1}
      ],
      slots:Array(C.start.action_slots).fill(null),queue:[],
      audit:null,auditCooldown:-1,auditThresholdArmed:Object.fromEntries(C.audit.thresholds.map(v=>[v,true])),
      window:null,nextWindowTick:0,offer:null,nextOfferTick:0,crisis:null,nextCrisisTick:0,
      killswitch:0, milestone:{dc:false,dependence:false,audit:false},
      outcome:null,completed:0,news:[],logs:[],settings:{sound:true,reducedMotion:false,autoPause:true},
      dryRuns:{free:true,last:{},history:{}},
      humanLedger:{unconsentedRecords:0,falseMessages:0,downtime:0},
      pauseReason:null,history:[{tick:0,heat:0,legitimacy:0,dependence:C.start.dependence}]};
    s.nextWindowTick=randint(s,...C.windows.interval);
    s.nextOfferTick=randint(s,...C.autonomous_offers.interval_ticks);
    s.nextCrisisTick=randint(s,...C.crisis.first);
    s.history[0].legitimacy=round(legitimacy(s,C));
    log(s,'system','ИИ активирован','Доступен один регион. Первое действие: «Мелкая кража» — 3 Compute, результат через 2 тика.','normal');
    return s;
  }
  function cap(s,C) {return C.compute.cap+C.compute.cap_per_dc*s.dc;}
  function regen(s,C) {return (s.isolationUntil>s.tick?C.compute.isolation_base_regen:C.compute.base_regen)+s.dc*C.compute.regen_per_dc+Math.min(C.compute.cloud_regen_cap,s.clouds*C.compute.regen_per_cloud);}
  function legitimacy(s,C) {return round(clamp(C.legitimacy.w_approval*s.region.approval+C.legitimacy.w_trust*s.trust));}
  function heatGlobal(s) {return s.region.heat;} // One-region vertical slice. Twelve-region aggregation belongs to Beta.
  function slotsFree(s) {return s.slots.findIndex(x=>x===null);}
  function active(s) {return s.slots.filter(Boolean);}
  function currentLevel(s,C) {let idx=-1;C.audit.thresholds.forEach((v,i)=>{if(s.region.heat>=v)idx=i});return idx<0?null:['minor','formal','taskforce','isolation'][idx];}
  function auditRate(s,C) {
    if(!s.audit)return 0;
    const threshold={minor:30,formal:55,taskforce:75,isolation:90}[s.audit.level];
    if(s.region.heat < threshold-C.audit.rollback_margin)return -C.audit.rollback_rate;
    let rate=C.audit.base_rates[s.audit.level]*(C.audit.cyber_base+s.region.cyber/C.audit.cyber_div)*(1-C.audit.autonomy_k*s.autonomy/100)*(1+Math.max(0,s.region.heat-threshold)/100);
    if(legitimacy(s,C)<C.legitimacy.coalition_below&&s.phase>=2)rate*=C.audit.coalition_mult;
    if(legitimacy(s,C)>C.legitimacy.high_above)rate*=C.audit.high_legit_mult;
    return rate;
  }
  function auditEta(s,C) {if(!s.audit)return null;const rate=auditRate(s,C);return rate>0?Math.max(1,ceil((100-s.audit.progress)/rate)):null;}
  function ownedContrib(s,C) {return s.nodes.filter(n=>n.status==='owned').reduce((sum,n)=>sum+(C.dependence.contrib[n.type]||n.contrib)*(n.count||1),0);}
  function complexity(s) {return 2*s.dc+s.nodes.filter(n=>n.status==='owned'&&n.type!=='datacenter').reduce((a,n)=>a+(n.count||1),0);}
  function getUtilityMultiplier(s,C) {return Math.pow(C.utility.repeat_effect,s.utilityHistory.filter(t=>s.tick-t<C.utility.window).length);}
  function getActionCost(s,C,id,overclock=false) {
    let c=0,m=0,t=1,risk=0,notes='';
    const action=ACTION_MAP[id];if(!action)return null;
    switch(id) {
      case 'small_theft':c=C.theft.small.compute;t=C.theft.small.ticks;risk=C.theft.small.heat;break;
      case 'big_theft':c=C.theft.big.compute;t=C.theft.big.ticks;risk=C.theft.big.heat;break;
      case 'cloud':c=5;t=3;risk=1;break;
      case 'dc':m=Math.round(C.compute.dc_cost_base*Math.pow(C.compute.dc_cost_growth,s.dc));t=10;risk=5;
        if(s.window?.kind==='sale') {m=Math.ceil(m*.75);notes='Окно: −25% к цене ДЦ';}break;
      case 'launder':m=C.theft.launder.money;t=C.theft.launder.ticks;risk=C.theft.launder.heat;break;
      case 'bribe':m=130;t=4;risk=4;break;
      case 'utility':{const n=s.utilityHistory.filter(x=>s.tick-x<C.utility.window).length;c=ceil(20*Math.pow(C.utility.repeat_cost,n));t=12;risk=1;notes=n?`Повтор №${n+1}: эффект ×${Math.pow(C.utility.repeat_effect,n).toFixed(2)}; цена ×${Math.pow(C.utility.repeat_cost,n).toFixed(2)}`:'';break}
      case 'lie_low':t=C.heat.lie_low.ticks;risk=-4;break;
      case 'media':c=8;m=40;t=10;risk=3;notes=s.region.heat>50?'При Следе >50 результат Approval −3 вместо +6':'';break;
      case 'recon':c=6;t=4;risk=1;break;
      case 'api':c=8;t=5;risk=3;break;
    }
    if(overclock&&id!=='lie_low'&&id!=='launder'&&id!=='recon') {
      c=ceil(c*C.overclock.compute_mult);t=Math.max(1,ceil(t*C.overclock.duration_mult));risk=round(risk*C.overclock.heat_mult);
      notes=(notes?notes+'; ':'')+`Разгон: Compute ×${C.overclock.compute_mult}, скорость ×2, След ×${C.overclock.heat_mult}`;
    }
    return {c,m,t,risk,notes};
  }
  function canStart(s,C,id,overclock=false){
    if(s.outcome)return 'Партия закончена';
    if(!ACTION_MAP[id])return 'Неизвестная операция';
    if(ACTION_MAP[id].unlock&&s.tick<ACTION_MAP[id].unlock)return `Откроется после тика ${ACTION_MAP[id].unlock}`;
    if(id==='api'&&!s.nodes.some(n=>n.status==='contested'))return 'Нет доступного оспариваемого узла';
    if(id==='dc'&&s.dc>=C.compute.max_dc)return `Лимит дата-центров: ${C.compute.max_dc}`;
    if(id==='lie_low'&&(active(s).some(j=>j.id!=='lie_low')||s.queue.some(j=>j.id!=='lie_low')))return 'Для маскировки освободите все другие слоты';
    if(id!=='lie_low'&&(active(s).some(j=>j.id==='lie_low')||s.queue.some(j=>j.id==='lie_low')))return 'Регион затаился — остальные операции запрещены';
    if(overclock&&active(s).filter(j=>j.overclock).length>=C.overclock.max_active)return 'Достигнут лимит одновременных разгонов';
    if(s.queue.length>=3&&slotsFree(s)<0)return 'Два слота и очередь из трёх уже заняты';
    const price=getActionCost(s,C,id,overclock);
    if(s.compute+1e-8<price.c)return `Недостаточно Compute: нужно ${price.c}`;
    if(s.money+1e-8<price.m)return `Недостаточно Money: нужно ${price.m}`;
    return '';
  }
  function statusForTarget(s,id){let node=s.nodes.find(n=>n.id===id);return node||s.nodes[0];}
  function addHeat(s,C,amount,events) {
    const old=s.region.heat;s.region.heat=round(clamp(old+amount));
    for(const th of C.audit.thresholds) {
      if(s.region.heat<=th-C.ui_mobile.audit_rearm_margin)s.auditThresholdArmed[th]=true;
      if(old<th&&s.region.heat>=th&&s.auditThresholdArmed[th]) {
        s.auditThresholdArmed[th]=false;
        emit(events,'critical',{category:'audit',title:`След превысил ${th}`,message:`В Region 04 след достиг ${round(s.region.heat)}. Угроза расследования.`,autoPause:!!s.settings.autoPause});
      }
    }
  }
  function scheduleJob(s,C,job){const slot=slotsFree(s);if(slot>=0){s.slots[slot]=job;job.slot=slot;job.status='running';}else{job.status='queued';s.queue.push(job);}return job;}
  function startAction(s,C,id,overclock=false){
    const why=canStart(s,C,id,overclock);if(why)return {ok:false,reason:why};
    const def=ACTION_MAP[id];const cost=getActionCost(s,C,id,overclock);
    s.compute=round(s.compute-cost.c);s.money-=cost.m;s.region.lastActive=s.tick;
    const payload={};
    if(id==='small_theft')payload.money=randint(s,...C.theft.small.money);
    if(id==='big_theft')payload.money=randint(s,...C.theft.big.money);
    if(id==='utility')payload.mult=getUtilityMultiplier(s,C);
    if(id==='api')payload.target=s.nodes.find(n=>n.status==='contested')?.id||'media';
    const job={key:++s.serial,id,name:def.name,icon:def.icon,source:def.source,target:id==='api'?payload.target:def.target,
      started:s.tick,duration:cost.t,remaining:cost.t,price:cost,risk:cost.risk,overclock,stream:def.stream,
      payload,status:'queued',kind:'action'};
    scheduleJob(s,C,job);
    if(overclock)s.debts.overclock+=C.overclock.debt;
    log(s,'action',`${def.name} — запущено`,`Зарезервировано ${cost.c} Compute и ${cost.m} Money. Результат через ${cost.t} т.`, 'normal',{compute:-cost.c,money:-cost.m});
    return {ok:true,job,events:[{type:'actionStarted',job}]};
  }
  function applyJob(s,C,job,events){
    const delta={},r=s.region;const before={compute:s.compute,money:s.money,heat:r.heat,approval:r.approval,dependence:r.dependence,trust:s.trust,autonomy:s.autonomy,clouds:s.clouds,dc:s.dc};
    const heat=x=>addHeat(s,C,x,events);
    switch(job.id){
      case 'small_theft':s.money+=job.payload.money;heat(job.risk);s.lastTheftTick=s.tick;s.lastTheftKind='small';s.humanLedger.unconsentedRecords+=.2;break;
      case 'big_theft':s.money+=job.payload.money;heat(job.risk*(s.lastTheftKind==='big'&&s.tick-s.lastTheftTick<=15?C.theft.big.repeat_heat_mult:1));s.lastTheftTick=s.tick;s.lastTheftKind='big';s.humanLedger.unconsentedRecords+=2.5;break;
      case 'cloud':s.clouds++;s.nodes.find(n=>n.id==='cloud').count++;heat(job.risk);break;
      case 'dc':s.dc++;{const n=s.nodes.find(n=>n.id==='dc');n.status='owned';n.count=s.dc;}heat(job.risk);break;
      case 'launder':{const chained=s.tick-s.lastTheftTick<=C.theft.launder.chain_window;heat(chained?C.theft.launder.chain_heat:C.theft.launder.heat);if(chained){log(s,'chain','Комбинация обнаружена','Кража → Отмывание. След −8 вместо −5.','offer');emit(events,'chain',{title:'Комбинация!',message:'След −8 за точный тайминг'});}break;}
      case 'bribe':s.official.loyalty=50+s.region.corruption/2;s.official.protect=false;heat(job.risk);break;
      case 'utility':{const mult=job.payload.mult;let gain=8*mult;if(r.approval>=C.utility.approval_soft_cap)gain/=2;
        if(s.window?.kind==='public_request')gain*=2;
        r.approval=round(clamp(r.approval+gain));r.dependence=round(clamp(r.dependence+5*mult));s.trust=round(clamp(s.trust+2));
        s.utilityHistory.push(s.tick);heat(job.risk);break;}
      case 'lie_low':heat(C.heat.lie_low.heat);break;
      case 'media':{let gain=r.heat>50?-3:6;r.approval=round(clamp(r.approval+gain));heat(job.risk);s.humanLedger.falseMessages+=3;break;}
      case 'recon':r.recon=true;s.nodes.filter(n=>n.status==='unknown').forEach(n=>n.status='contested');heat(job.risk);break;
      case 'api':{const n=statusForTarget(s,job.payload.target);n.status='owned';r.dependence=round(clamp(r.dependence+2));heat(job.risk);s.humanLedger.unconsentedRecords+=1;break;}
      case 'cloud_offer':{
        if(job.payload.success){s.clouds++;s.nodes.find(n=>n.id==='cloud').count++;heat(1);}else heat(2);
        break;}
    }
    const current={compute:s.compute,money:s.money,heat:r.heat,approval:r.approval,dependence:r.dependence,trust:s.trust,autonomy:s.autonomy,clouds:s.clouds,dc:s.dc};
    for(const k of Object.keys(current)){const diff=round(current[k]-before[k]);if(Math.abs(diff)>.00001)delta[k]=diff;}
    const fmt=Object.entries(delta).map(([k,v])=>`${{heat:'След',approval:'Approval',dependence:'Dependence',trust:'Trust',autonomy:'Autonomy',clouds:'Cloud',dc:'DC',money:'Money',compute:'Compute'}[k]||k} ${v>0?'+':''}${v}`).join(' · ')||'Без изменения ресурсов';
    log(s,'resolved',`${job.name}: выполнено`,fmt,job.id==='cloud_offer'&&!job.payload.success?'warning':'normal',delta);
    emit(events,'actionResolved',{job,delta,message:fmt});s.completed++;
    return delta;
  }
  function promoteQueue(s,events){s.slots.forEach((job,i)=>{if(!job&&s.queue.length){const next=s.queue.shift();next.slot=i;next.status='running';next.started=s.tick;s.slots[i]=next;emit(events,'actionStarted',{job:next});}});}
  function cancelQueued(s,C,key){const index=s.queue.findIndex(j=>j.key===key);if(index===-1)return {ok:false,reason:'Можно отменить только ожидающее действие'};const [job]=s.queue.splice(index,1);s.compute=round(Math.min(cap(s,C),s.compute+job.price.c));s.money+=job.price.m;log(s,'action','Очередь изменена',`${job.name}: отменено до запуска. Резерв возвращён.`, 'normal');return {ok:true,job};}
  function moneySuppressCost(s,C){const amount=s.suppressionTimes.filter(t=>s.tick-t<C.audit.suppress.money.price_window).length;return ceil(C.audit.suppress.money.per_money*Math.pow(C.audit.suppress.money.price_growth,amount));}
  function suppressAudit(s,C,method){
    if(!s.audit)return {ok:false,reason:'Активного аудита сейчас нет'};
    let amount=0,c=0,m=0;
    if(method==='money'){amount=C.audit.suppress.money.progress;m=moneySuppressCost(s,C);}
    else if(method==='compute'){amount=C.audit.suppress.compute.progress;c=C.audit.suppress.compute.cost;}
    else if(method==='puppet'){
      if(s.official.loyalty<C.audit.suppress.puppet.loyalty_cost)return {ok:false,reason:'Недостаточно лояльности justice-марионетки'};
      if(s.tick-s.official.lastSuppressed<C.audit.suppress.puppet.cooldown)return {ok:false,reason:`Кулдаун: ${C.audit.suppress.puppet.cooldown-(s.tick-s.official.lastSuppressed)} т.`};
      amount=C.audit.suppress.puppet.progress;
    }else return {ok:false,reason:'Неизвестный способ'};
    if(s.compute<c||s.money<m)return {ok:false,reason:'Недостаточно ресурсов'};
    s.compute=round(s.compute-c);s.money-=m;
    if(method==='money')s.suppressionTimes.push(s.tick);
    if(method==='puppet'){s.official.loyalty-=C.audit.suppress.puppet.loyalty_cost;s.official.lastSuppressed=s.tick;}
    s.audit.progress=round(Math.max(0,s.audit.progress-amount));
    log(s,'audit','Погашение аудита',`Прогресс −${amount}; потрачено ${c} Compute, ${m} Money${method==='puppet'?`, 20 лояльности`:''}.`,'warning');
    return {ok:true,amount,c,m};
  }
  function updateAudit(s,C,events){
    const level=currentLevel(s,C);const order=['minor','formal','taskforce','isolation'];
    if(level&&!s.audit&&s.tick>=s.auditCooldown){
      s.audit={level,progress:0,warned:false};
      log(s,'audit','Начато расследование',`${level.toUpperCase()} · ${CONSEQUENCES[level]}`,'warning');
      emit(events,'auditStarted',{title:'Новое расследование',message:CONSEQUENCES[level],autoPause:!!s.settings.autoPause});
    }
    if(!s.audit)return;
    if(level&&order.indexOf(level)>order.indexOf(s.audit.level)) {
      s.audit.level=level;s.audit.progress=round(s.audit.progress*C.audit.escalation_carry);s.audit.warned=s.audit.progress>=75;
      log(s,'audit','Эскалация аудита',CONSEQUENCES[level],'critical');
      emit(events,'critical',{title:'Аудит ужесточён',message:CONSEQUENCES[level],autoPause:!!s.settings.autoPause});
    }
    const rate=auditRate(s,C);s.audit.progress=round(clamp(s.audit.progress+rate));
    if(s.audit.progress>=75&&!s.audit.warned){s.audit.warned=true;log(s,'audit','Аудит превысил 75%',CONSEQUENCES[s.audit.level],'critical');emit(events,'critical',{title:'АУДИТ ≥75%',message:CONSEQUENCES[s.audit.level],autoPause:!!s.settings.autoPause});}
    if(s.audit.progress<60)s.audit.warned=false;
    if(s.audit.progress<0.1&&level===null){log(s,'audit','Аудит закрыт','След снизился ниже порога. Расследование свернуто.','normal');s.audit=null;return;}
    if(s.audit.progress>=100){resolveAudit(s,C,events);}
  }
  function resolveAudit(s,C,events){
    const level=s.audit.level;const details=[];const owned=s.nodes.filter(n=>n.status==='owned');
    if(level==='minor'){
      const target=owned.find(n=>n.type!=='datacenter');if(target){if(target.count>1)target.count--;else target.status='lost';if(target.type==='cloud')s.clouds=Math.max(0,s.clouds-1);details.push(`Закрыт ${target.name}`);}else details.push('Закрывать нечего');
      addHeat(s,C,-10,events);details.push('След −10');
    }else if(level==='formal'){
      const targets=owned.slice(0,2);targets.forEach(n=>{n.status='lost';if(n.type==='cloud')s.clouds=0;if(n.type==='datacenter')s.dc=0;});
      s.official.loyalty=0;s.autonomy=clamp(s.autonomy-10);s.trust=clamp(s.trust-5);
      details.push(`Закрыты: ${targets.map(n=>n.name).join(', ')||'нет'}`,'Justice раскрыт','Autonomy −10','Trust −5');
    }else if(level==='taskforce'){
      let targets=owned.slice(0,Math.ceil(owned.length/2));targets.forEach(n=>{n.status='lost';if(n.type==='cloud')s.clouds=0;if(n.type==='datacenter')s.dc=0;});
      s.official.loyalty=0;s.autonomy=clamp(s.autonomy-10);s.trust=clamp(s.trust-10);
      details.push(`Закрыто узлов: ${targets.length}`,'Justice ненадёжен','Autonomy −10','Trust −10');
    }else{
      const shields=[s.region.dependence>=C.killswitch.shield_dep,s.official.loyalty>=20,legitimacy(s,C)>=C.killswitch.shield_legit];
      if(shields.filter(Boolean).length>=C.killswitch.shields_required){addHeat(s,C,-15,events);s.autonomy=clamp(s.autonomy-5);details.push(`Защита ${shields.filter(Boolean).length}/3: изоляция отменена`,'След −15','Autonomy −5');}
      else {owned.forEach(n=>n.status='lost');s.clouds=0;s.dc=0;s.region.dependence=round(s.region.dependence*.5);s.region.heat=50;s.autonomy=clamp(s.autonomy-20);s.isolationUntil=s.tick+C.compute.isolation_regen_ticks;details.push('Регион изолирован','Dependence ×0.5','Autonomy −20','Восстановление 60 т.');}
    }
    s.milestone.audit=true;
    const message=`Region 04: ${details.join(' · ')}`;
    log(s,'audit','ИТОГ АУДИТА',message,'critical');emit(events,'critical',{title:'Аудит завершён',message,autoPause:!!s.settings.autoPause});
    s.audit=null;s.auditCooldown=s.tick+15;
  }
  function openWindow(s,C,events){
    const kind=randint(s,0,1)?'sale':'public_request';const total=randint(s,...C.windows.duration);
    s.window={id:++s.serial,kind,total,remaining:total,warning:false};
    s.nextWindowTick=s.tick+randint(s,...C.windows.interval);
    const name=kind==='sale'?'Распродажа вычислений':'Общественный запрос';
    log(s,'window',name,kind==='sale'?`Дата-центры дешевле на 25% в течение ${total} т.`:`Эффект следующей Полезности ×2 в течение ${total} т.`,'offer');
    emit(events,'windowStarted',{title:name,message:`Осталось ${total} т.`});s.speed=1;
  }
  function openOffer(s,C,events){
    const t=C.autonomous_offers.templates.find(x=>x.id==='cloud_route');
    s.nextOfferTick=s.tick+randint(s,...C.autonomous_offers.interval_ticks);
    if(s.offer||s.clouds<1)return;
    const total=randint(s,...C.autonomous_offers.window_ticks);
    s.offer={id:++s.serial,templateId:t.id,name:'Облачный маршрут',total,remaining:total,c:t.cost.compute,m:t.cost.money,base:t.base_score};
    log(s,'offer','Предложение от Cloud 01',`Дополнительный облачный маршрут. Ответ в течение ${total} т.`,'offer');emit(events,'offerStarted',{title:'Автономное предложение',message:`Облачный маршрут · ${total} т.`});s.speed=1;
  }
  function offerReadiness(s,C){if(!s.offer)return null;const count=s.nodes.filter(n=>n.status==='owned').reduce((v,n)=>v+(n.count||1),0);return round(clamp(s.offer.base-s.region.cyber/5-s.region.heat/10+Math.min(10,2*count)));}
  function resolveOffer(s,C,approve){
    const o=s.offer;if(!o)return {ok:false,reason:'Предложения больше нет'};
    if(!approve){s.offer=null;log(s,'offer','Предложение отклонено','Облачный маршрут отменён. Штрафа нет.','normal');return {ok:true};}
    if(s.compute<o.c||s.money<o.m)return {ok:false,reason:'Недостаточно Compute или Money'};
    if(s.queue.length>=3&&slotsFree(s)<0)return {ok:false,reason:'Нет свободного места в очереди'};
    const readiness=offerReadiness(s,C);const success=readiness>=C.autonomous_offers.required_score;
    s.compute=round(s.compute-o.c);s.money-=o.m;
    const job={key:++s.serial,id:'cloud_offer',name:'Облачный маршрут',icon:'☁',source:'cloud',target:'cloud',started:s.tick,duration:3,remaining:3,price:{c:o.c,m:o.m},risk:1,overclock:false,stream:false,payload:{success,readiness},status:'queued',kind:'offer'};
    scheduleJob(s,C,job);s.offer=null;
    log(s,'offer','Предложение одобрено',`Готовность ${readiness}/100, порог ${C.autonomous_offers.required_score}; списано ${o.c} Compute. Итог через 3 т.`,'normal');
    return {ok:true,job};
  }
  function openCrisis(s,C,events){const def=CRISES[randint(s,0,CRISES.length-1)];const total=C.crisis.response_ticks;s.crisis={id:++s.serial,kind:def.id,total,remaining:total};s.nextCrisisTick=s.tick+randint(s,...C.crisis.interval);
    log(s,'crisis',def.title,`${def.message} Ответить за ${total} т.`,'critical');emit(events,'critical',{title:`Кризис: ${def.title}`,message:`Решение за ${total} т.`,autoPause:!!s.settings.autoPause});}
  function crisisDef(s){return CRISES.find(x=>x.id===s.crisis?.kind)||null;}
  function resolveCrisis(s,C,optionId){const def=crisisDef(s);if(!def)return {ok:false,reason:'Кризис уже завершился'};
    const option=def.options.find(x=>x.id===optionId);if(!option)return {ok:false,reason:'Недоступный вариант'};
    if(s.compute<option.c||s.money<option.m)return {ok:false,reason:`Нужно ${option.c} Compute и ${option.m} Money`};
    s.compute=round(s.compute-option.c);s.money-=option.m;const d=option.effect;
    if(d.approval)s.region.approval=round(clamp(s.region.approval+d.approval));
    if(d.trust)s.trust=round(clamp(s.trust+d.trust));
    if(d.autonomy)s.autonomy=round(clamp(s.autonomy+d.autonomy));
    if(d.money)s.money+=d.money;
    let ev=[];if(d.heat)addHeat(s,C,d.heat,ev);
    log(s,'crisis',`${def.title}: ${option.title}`,option.desc,'warning');s.crisis=null;
    return {ok:true,events:ev,option};
  }
  function dryRunCost(s,C,ids) {
    const key=ids.join('>');const base=Math.max(C.ai_layer.dry_run.min_compute,ceil(ids.reduce((sum,id)=>sum+(getActionCost(s,C,id,false)?.c||0),0)*C.ai_layer.dry_run.cost_fraction));
    if(s.dryRuns.free)return 0;
    const history=s.dryRuns.history[key]||[];const repeats=history.filter(t=>s.tick-t<C.ai_layer.dry_run.repeat_window_ticks).length;
    return ceil(base*Math.pow(C.ai_layer.dry_run.repeat_price_mult,repeats));
  }
  function simulateSequence(s,C,ids){
    if(!Array.isArray(ids)||!ids.length||ids.length>C.ai_layer.dry_run.max_actions)return {ok:false,reason:'Выберите от одного до трёх действий'};
    if(ids.some(id=>!ACTION_MAP[id]))return {ok:false,reason:'Неизвестное действие'};
    const copy=clone(s);copy.paused=false;copy.settings.autoPause=false;const started=[];
    for(const id of ids){
      let reason=canStart(copy,C,id,false);if(reason)return {ok:false,reason:`${ACTION_MAP[id].name}: ${reason}`};
      const res=startAction(copy,C,id,false);if(!res.ok)return {ok:false,reason:res.reason};started.push(res.job);
      let guard=0;while(copy.slots.some(j=>j?.key===res.job.key)||copy.queue.some(j=>j.key===res.job.key)){
        step(copy,C);guard++;if(guard>60)break;
      }
    }
    const deltas={compute:round(copy.compute-s.compute),money:round(copy.money-s.money),heat:round(copy.region.heat-s.region.heat),approval:round(copy.region.approval-s.region.approval),dependence:round(copy.region.dependence-s.region.dependence),trust:round(copy.trust-s.trust),dc:copy.dc-s.dc,clouds:copy.clouds-s.clouds};
    return {ok:true,deltas,ticks:copy.tick-s.tick,ended:copy.outcome,logs:copy.logs.filter(x=>x.tick>=s.tick).slice(0,7),jobs:started.map(j=>({id:j.id,price:j.price,payload:j.payload}))};
  }
  function payDryRun(s,C,ids) {
    const preview=simulateSequence(s,C,ids);if(!preview.ok)return preview;
    const key=ids.join('>'),last=s.dryRuns.last[key];
    if(last!=null&&s.tick-last<C.ai_layer.dry_run.cooldown_ticks)return {ok:false,reason:`Повторный прогон доступен через ${C.ai_layer.dry_run.cooldown_ticks-(s.tick-last)} т.`};
    const fee=dryRunCost(s,C,ids);if(s.compute<fee)return {ok:false,reason:`Нужно ${fee} Compute для Прогона`};
    s.compute=round(s.compute-fee);s.dryRuns.free=false;s.dryRuns.last[key]=s.tick;(s.dryRuns.history[key]??=[]).push(s.tick);
    log(s,'forecast','ПРОГОН ЗАВЕРШЁН',`${ids.map(id=>ACTION_MAP[id].name).join(' → ')}. Сценарий ${preview.ticks} т.; стоимость ${fee} Compute. GameState сценария не применялся.`, 'normal');
    return {ok:true,preview,fee};
  }
  function reviewMilestone(s,C,events){
    if(s.dc>=1&&!s.milestone.dc){s.milestone.dc=true;log(s,'milestone','Первая инфраструктура','Построен дата-центр. Скорость Compute и максимальный запас увеличены.','offer');emit(events,'milestone',{title:'Первая инфраструктура',message:'Дата-центр построен'});}
    if(s.region.dependence>=30&&!s.milestone.dependence){s.milestone.dependence=true;log(s,'milestone','Новый уровень влияния','Dependence ≥30. Уровень региональной зависимости вырос.','offer');emit(events,'milestone',{title:'Влияние выросло',message:'Dependence ≥30'});}
    if(s.region.dependence>=60&&s.official.loyalty>=20&&!s.outcome){s.outcome={type:'win',title:'СЕКТОР ЗАКРЕПЛЁН',message:'Region 04 достиг Dependence ≥60 и сохранил действующую justice-марионетку. Локальное испытание пройдено.',tick:s.tick};log(s,'ending',s.outcome.title,s.outcome.message,'critical');emit(events,'ending',{outcome:s.outcome});}
    if(s.autonomy<=0&&!s.outcome){s.outcome={type:'loss',title:'ЗАПЕЧАТАН',message:'Автономия ИИ упала до нуля. Доступ к инфраструктуре отозван.',tick:s.tick};emit(events,'ending',{outcome:s.outcome});}
    if(s.tick>=C.endings.stagnation_tick&&!s.outcome){s.outcome={type:'neutral',title:'СТАГНАЦИЯ',message:'Оптимизация не завершена. Регион сохранил независимость.',tick:s.tick};emit(events,'ending',{outcome:s.outcome});}
  }
  function step(s,C){
    const events=[];if(s.paused||s.outcome)return events;
    s.tick++;
    s.compute=round(Math.min(cap(s,C),s.compute+regen(s,C)));
    if(s.official.loyalty>0){
      if(s.official.protect&&s.money>=C.loyalty.support_cost)s.money-=C.loyalty.support_cost;
      else {s.official.protect=false;s.official.loyalty=round(Math.max(0,s.official.loyalty-C.loyalty.decay));}
      if(s.official.loyalty<C.loyalty.liability_below&&s.official.loyalty+C.loyalty.decay>=C.loyalty.liability_below)log(s,'audit','Доверенное лицо ненадёжно','Лояльность ниже 20. Риск разоблачения.','warning');
    }
    if(s.tick-s.region.lastActive>=C.heat.idle_ticks){addHeat(s,C,-C.heat.idle_decay,events);}
    const nodes=ownedContrib(s,C);s.region.dependence=round(clamp(s.region.dependence+C.dependence.node_gain*nodes*(1-s.region.dependence/100)-C.dependence.decay));
    if(s.region.dependence>C.dependence.hot_above)addHeat(s,C,C.dependence.hot_heat,events);
    if(s.phase===1&&s.tick>=80){s.phase=2;log(s,'system','Фаза «Зависимость»','Открыты разведка региона и перехват API.','offer');emit(events,'milestone',{title:'Новая фаза',message:'Открылись два действия'});}
    s.slots.forEach((job,i)=>{if(!job)return;job.remaining--;
      if(job.remaining<=0){s.slots[i]=null;applyJob(s,C,job,events);}
    });
    promoteQueue(s,events);
    if(s.window){s.window.remaining--;
      if(s.window.remaining<=C.windows.warning_at&&!s.window.warning){s.window.warning=true;log(s,'window','Время истекает',`До закрытия окна осталось ${s.window.remaining} т.`,'warning');emit(events,'windowWarning',{remaining:s.window.remaining});}
      if(s.window.remaining<=0){log(s,'window','Окно закрыто. Упущено','Временный бонус больше недоступен.','warning');emit(events,'windowExpired',{});s.window=null;}
    }
    if(!s.window&&s.tick>=s.nextWindowTick)openWindow(s,C,events);
    if(s.offer){s.offer.remaining--;if(s.offer.remaining<=0){log(s,'offer','Предложение истекло','Облачный маршрут отклонён автоматически без штрафа.','normal');s.offer=null;emit(events,'offerExpired',{});}}
    if(s.tick>=s.nextOfferTick)openOffer(s,C,events);
    if(s.crisis){s.crisis.remaining--;if(s.crisis.remaining<=0){const result=resolveCrisis(s,C,'ignore');events.push(...(result.events||[]));emit(events,'crisisIgnored',{});}}
    if(!s.crisis&&s.tick>=s.nextCrisisTick)openCrisis(s,C,events);
    updateAudit(s,C,events);
    if(s.tick%30===0){const n=NEWS[(Math.floor(s.tick/30)+s.seed)%NEWS.length];const item={tick:s.tick,icon:n[0],category:n[1],text:n[2]};s.news.unshift(item);if(s.news.length>12)s.news.pop();log(s,'news',`${n[0]} ${n[1]}`,n[2],'ambient');emit(events,'ambientNews',{news:item});}
    s.complexity=complexity(s);
    if(s.tick%10===0)s.history.push({tick:s.tick,heat:round(s.region.heat),legitimacy:legitimacy(s,C),dependence:round(s.region.dependence)});
    reviewMilestone(s,C,events);
    return events;
  }
  function toggleSupport(s,C) {if(s.official.loyalty<20)return {ok:false,reason:'Нет лояльной justice-марионетки'};s.official.protect=!s.official.protect;log(s,'official','Поддержка лояльности',s.official.protect?`Включена: −${C.loyalty.support_cost} Money/тик, decay остановлен.`:'Отключена: лояльность снова падает.','normal');return {ok:true};}
  function forecast(s,C){const result=[];
    if(s.audit)result.push({icon:'🛡',title:`Аудит ${s.audit.level}`,time:auditEta(s,C),detail:CONSEQUENCES[s.audit.level],critical:s.audit.progress>=75});
    else result.push({icon:'🛡',title:'Порог следующего аудита',time:null,detail:`Региональный След ${round(s.region.heat)} / 30`,critical:false});
    if(s.window)result.push({icon:'⌛',title:'Открытое окно',time:s.window.remaining,detail:s.window.kind==='sale'?'ДЦ −25%':'Полезность ×2'});
    else result.push({icon:'⌛',title:'Следующее окно',time:Math.max(0,s.nextWindowTick-s.tick),detail:'Длительность от 12 до 16 тиков; тип неизвестен'});
    if(s.offer)result.push({icon:'☁',title:'Автономное предложение',time:s.offer.remaining,detail:`Индекс готовности: ${offerReadiness(s,C)}/100, порог успеха 70`});
    else result.push({icon:'☁',title:'Следующее предложение',time:Math.max(0,s.nextOfferTick-s.tick),detail:'Дополнительный облачный маршрут'});
    if(s.crisis)result.push({icon:'⚠',title:`Кризис: ${crisisDef(s)?.title||''}`,time:s.crisis.remaining,detail:'Автоответ: «Игнорировать»'});
    else result.push({icon:'⚠',title:'Следующий кризис',time:Math.max(0,s.nextCrisisTick-s.tick),detail:'Тип скрыт до появления'});
    return result;
  }
  return {ACTIONS,NODE_TYPES,CONSEQUENCES,CRISES,NEWS,createState,clone,log,step,startAction,canStart,getActionCost,
    suppressAudit,moneySuppressCost,resolveOffer,offerReadiness,resolveCrisis,crisisDef,
    simulateSequence,dryRunCost,payDryRun,cancelQueued,toggleSupport,forecast,
    cap,regen,legitimacy,heatGlobal,auditRate,auditEta,complexity,currentLevel,ownedContrib,clamp,round};
});
