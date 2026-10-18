const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const H=require('./hourly.js');
const clone=o=>JSON.parse(JSON.stringify(o));
const poke=(name,damage)=>({name,held:0,heldCrit:0,atk:0,food:null,heldMode:'percent',moves:Array.from({length:6},(_,i)=>({name:'Golpe '+(i+1),base:10,damagePerHit:damage,hits:1,remaining:0,total:0}))});
function harness(team=[poke('A',E.DUMMY_HP/2)]){
 class Element{
  constructor(){this.value='';this.checked=false;this.textContent='';this.listeners={};this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(n,fn){(this.listeners[n]||=[]).push(fn);}
  dispatchEvent(e){e.target??=this;for(const fn of this.listeners[e.type]||[])fn(e);}
  replaceChildren(...children){this.children=children;}
  querySelector(){return {focus(){}};}
  querySelectorAll(){return [];}
 }
 const nodes={},el=id=>nodes[id]??=new Element(),timers=[];
 const state={active:0,disk:0,globalAtk:0,globalCrit:0,team:clone(team),elapsed:0,box:E.newBox(),reviveRemaining:0};
 let library=clone(team);
 const cards={snapshot:()=>({version:1,team:clone(state.team),disk:0,globalCrit:0,globalAtk:0,active:state.active}),
 library:()=>clone(library),validate(){},validateLibrary(){},
 restore(p,l){state.team=clone(p.team);library=clone(l);state.active=p.active||0;},reset(){}};
 const ctx=vm.createContext({console,TextEncoder,CooldownEngine:E,
 document:{getElementById:el,querySelectorAll:()=>[]},Event:class{constructor(type){this.type=type;}},
 Option:function(text,value){this.text=text;this.value=value;},
 addEventListener(){},confirm:()=>true,prompt:()=>null,setInterval(fn,delay){timers.push({fn,delay});},
 pokeCards:cards,pokeSimulator:{state,sync(){},resume(){},isPaused:()=>false,swap:i=>E.swap(state,i),cast:(p,m,x)=>E.cast(state,p,m,()=>1,x)}});
 vm.runInContext(fs.readFileSync(__dirname+'/automation.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync(__dirname+'/builder.js','utf8'),ctx);
 const cloud=fs.readFileSync(__dirname+'/cloud.js','utf8').split('async function load(migrateLocal=false)')[0].split('\n').slice(2).join('\n');
 vm.runInContext(cloud+'\nglobalThis.reviewCloud={snapshot,normalize,apply};',ctx);
 const select=i=>el('combo-tabs').dispatchEvent({type:'click',target:{closest:selector=>selector==='[data-tab]'?{dataset:{tab:i}}:null}});
 const edit=sequence=>{el('auto-sequence').value=sequence;el('auto-sequence').dispatchEvent({type:'input'});};
 const tick=()=>timers.find(t=>t.delay===100).fn();
 return {ctx,state,el,select,edit,tick};
}

let cases=0;
const check=(name,fn)=>{fn();cases++;console.log('ok - '+name);};
const legacy=h=>({version:1,cards:h.ctx.pokeCards.snapshot(),library:[],combos:Array(6).fill(null),automation:{sequence:'poke 1 cd 1',delay:1,repeat:false}});
check('Migração preserva a sequência antiga e seleciona o combo recuperado',()=>{
 const h=harness(),backup=legacy(h);
 h.ctx.reviewCloud.apply(backup);
 assert.equal(h.el('auto-sequence').value,'A cds 1');
 assert.equal(h.el('auto-delay').value,1);
 assert.equal(h.ctx.pokeCombos.snapshot().filter(Boolean).length,1);
 assert.equal(h.ctx.reviewCloud.snapshot().automation.sequence,'A cds 1');
});
check('Migração não duplica uma sequência já salva',()=>{
 const h=harness(),backup=legacy(h);
 backup.combos[2]={...backup.automation};
 h.ctx.reviewCloud.apply(backup);
 assert.equal(h.ctx.pokeCombos.snapshot().filter(Boolean).length,1);
 assert.equal(h.ctx.pokeCombos.modes().combo,2);
});
check('Migração de seis combos ocupados não sobrescreve nenhum deles',()=>{
 const h=harness(),backup=legacy(h);
 backup.combos=Array.from({length:6},(_,i)=>({sequence:'A cd '+(i+1),delay:0.5,repeat:false}));
 h.ctx.reviewCloud.apply(backup);
 const payload=h.ctx.reviewCloud.snapshot();
 assert.equal(payload.combos.length,6);
 assert.equal(payload.modes[0].combos.length,7);
 assert.equal(payload.combo,6);
 assert.equal(payload.modes[0].combos[6].delay,1);
 h.ctx.reviewCloud.apply(clone(payload));
 assert.equal(h.el('auto-delay').value,1);
 assert.equal(h.ctx.pokeCombos.snapshot().length,7);
});
check('Migração com vinte combos usa outro modo para recuperar o editor',()=>{
 const h=harness(),backup=legacy(h);
 backup.combos=Array.from({length:20},()=>({sequence:'A cd 2',delay:0.5,repeat:false}));
 h.ctx.reviewCloud.apply(backup);
 assert.equal(h.ctx.pokeCombos.modes().modes.length,2);
 assert.equal(h.ctx.pokeCombos.modes().mode,1);
 assert.equal(h.el('auto-sequence').value,'A cds 1');
});
check('Elixir incompleto sobrevive à troca de aba e ao backup',()=>{
 const h=harness();h.el('builder-elixir').onclick();
 assert.equal(h.el('auto-sequence').value,'elixir');
 assert.match(h.el('auto-status').textContent,/Rascunho/);
 assert.equal(h.ctx.pokeCombos.snapshot()[0].sequence,'elixir');
 h.select(1);h.select(0);
 assert.equal(h.el('auto-sequence').value,'elixir');
 const payload=clone(h.ctx.reviewCloud.snapshot());
 const next=harness();next.ctx.reviewCloud.apply(payload);
 assert.equal(next.el('auto-sequence').value,'elixir');
});
check('Combo selecionado, nomes e rascunho são preservados entre modos',()=>{
 const h=harness();
 h.ctx.pokeCombos.restore([{name:'Hunt A',team:['A'],combos:[null,{sequence:'elixir',delay:0.5,repeat:false}]},{name:'Hunt B',team:['A'],combos:[null]}],0,1);
 h.el('mode-select').value=1;h.el('mode-select').onchange();
 h.el('mode-select').value=0;h.el('mode-select').onchange();h.select(1);
 const backup=h.ctx.reviewCloud.snapshot();
 assert.equal(backup.mode,0);assert.equal(backup.combo,1);
 const next=harness();next.ctx.reviewCloud.apply(clone(backup));
 assert.equal(next.el('auto-sequence').value,'elixir');
});
check('Um a vinte combos mantêm seis slots legados e nenhum combo é perdido',()=>{
 for(let count=1;count<=20;count++){
   const h=harness(),combos=Array.from({length:count},(_,i)=>({sequence:'A cd 1',delay:0.1*(i+1),repeat:false}));
   h.ctx.pokeCombos.restore([{name:'Modo teste',combos}],0,count-1);
   const payload=h.ctx.reviewCloud.normalize(h.ctx.reviewCloud.snapshot());
   assert.equal(payload.combos.length,6); // contrato hardening.sql, sem chamada ao banco real
   assert.equal(payload.modes[0].combos.length,count);
   const next=harness();next.ctx.reviewCloud.apply(clone(payload));
   assert.equal(next.ctx.pokeCombos.snapshot().length,count);
   assert.equal(next.ctx.pokeCombos.modes().combo,count-1);
 }
});
check('Revive tem a mesma linha do tempo na box ao vivo e na projeção',()=>{
 const h=harness(),seq='A cd 1\nrevive 4\nA cd 1';
 h.edit(seq);h.el('auto-delay').value=1;h.el('auto-start').onclick();
 E.advance(h.state,1);h.tick();E.advance(h.state,1);h.tick();
 assert.equal(h.state.box.finishedAt,2);
 const cast=E.cast;let projected;
 E.cast=(...args)=>{const result=cast(...args);if(args[0].box.finishedAt!==null)projected=args[0].box.finishedAt;return result;};
 try{H.simulateLaps({team:[poke('A',E.DUMMY_HP/2)],combos:[{sequence:seq,delay:1}],laps:1,runs:1,random:()=>1});}
 finally{E.cast=cast;}
 assert.equal(projected,h.state.box.finishedAt);
});
check('Próximo lure troca antes do intervalo final em ambos os caminhos',()=>{
 const team=[poke('A',E.DUMMY_HP),poke('B',E.DUMMY_HP)];
 const combos=[{sequence:'A cd 1',delay:1,repeat:false,pullNext:true},{sequence:'B cd 1',delay:1,repeat:false}];
 const h=harness(team),deaths=[];
 h.ctx.pokeCombos.restore([{name:'Modo 1',combos}]);
 for(let i=0;i<4;i++){
   if(i)h.state.box=E.newBox();h.select(i%2);h.el('auto-start').onclick();
   for(let guard=0;h.state.box.finishedAt===null&&guard<100;guard++){E.advance(h.state,1);h.tick();}
   assert.notEqual(h.state.box.finishedAt,null);
   deaths.push(h.state.box.finishedAt);E.advance(h.state,1);
 }
 const cast=E.cast,projected=[];
 E.cast=(...args)=>{const result=cast(...args);if(args[0].box.finishedAt!==null)projected.push(args[0].box.finishedAt);return result;};
 try{H.simulateLaps({team,disk:0,combos,laps:2,runs:1,random:()=>1});}finally{E.cast=cast;}
 assert.deepEqual(projected,deaths);
 assert.equal(deaths[2],12);
});
check('Elixir global só libera novamente após 210 segundos',()=>{
 const state={team:[poke('A',100)],active:0,elapsed:0,disk:0};
 assert.equal(E.elixir(state),true);
 assert.equal(E.elixir(state),false);
 E.advance(state,209.9);assert.equal(E.elixir(state),false);
 E.advance(state,0.1);assert.equal(E.elixir(state),true);
 assert.equal(state.elixirRemaining,210);
});
check('Elixir melhora todos os hits apenas da próxima etapa de Pokémon',()=>{
 const h=harness([poke('A',100)]);
 h.state.team[0].moves[0].hits=3;
 h.edit('elixir\nA cd 1 2\nA cd 3');h.el('auto-delay').value=1;
 h.el('auto-start').onclick();
 assert.equal(h.state.box.targets[0].lastDamage,510);
 E.advance(h.state,1);h.tick();
 assert.equal(h.state.box.targets[0].lastDamage,170);
 E.advance(h.state,1);h.tick();
 assert.equal(h.state.box.targets[0].lastDamage,100);
 assert.equal(h.state.elixirRemaining,208);
});
check('Elixir espera entre combos e a projeção coincide com a box ao vivo',()=>{
 const team=[poke('A',E.DUMMY_HP/1.5)],h=harness(team),seq='elixir\nA cd 1';
 h.edit(seq);h.el('auto-delay').value=1;h.el('auto-start').onclick();
 assert.equal(h.state.box.finishedAt,0);
 E.advance(h.state,1);h.state.box=E.newBox();h.el('auto-start').onclick();
 assert.equal(h.state.box.finishedAt,null);assert.match(h.el('auto-status').textContent,/Aguardando elixir/);
 E.advance(h.state,208);h.tick();assert.equal(h.state.box.finishedAt,null);
 E.advance(h.state,1);h.tick();assert.equal(h.state.box.finishedAt,210);
 const rows=H.simulateLaps({team,combos:[{sequence:seq,delay:1}],laps:2,runs:1,random:()=>1});
 assert.equal(rows[1].avgElixirWait,209);
 assert.equal(rows[1].avgTime,210);
});
console.log(cases+' testes de regressão passaram.');
