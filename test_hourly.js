const assert=require('node:assert/strict');
const {DUMMY_HP}=require('./engine.js');
const {simulateHour,simulateLaps}=require('./hourly.js');
const {parseSequence,namedSequence}=require('./automation.js');
const poke=(name,damage)=>({name,held:0,heldCrit:0,atk:0,food:null,heldMode:'percent',moves:[{name:'Golpe 1',base:10,damagePerHit:damage,hits:1}]});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

// Um combo que mata tudo: mortes em 0, 10, …, 3600. O intervalo posterior não exclui a última box.
let r=simulateHour({team:[poke('A',DUMMY_HP)],combos:[{sequence:'poke 1 cd 1',delay:1}],runs:1,random:()=>1});
assert.equal(r.boxes,361);
assert.equal(r.combos[0].failures,0);

// Disco 6: dentro da ball o Pokémon 1 recupera 1s a cada 6s. Combo 2 só tira metade da vida.
r=simulateHour({team:[poke('A',DUMMY_HP),poke('B',DUMMY_HP/2)],disk:6,combos:[{sequence:'poke 1 cd 1',delay:1},{sequence:'poke 2 cd 1',delay:1}],seconds:11,runs:1,random:()=>1});
assert.equal(r.boxes,2);
// As seis targets de B também recuperam os cooldowns de A dentro da ball.
close(r.combos[0].avgTime,(1+(9-7/6)+1)/2);
close(r.combos[1].avgTime,7);
assert.deepEqual([r.combos[1].failures,r.combos[1].avgSurvivors],[1,6]);
close(r.combos[1].avgHpLeft,DUMMY_HP/2);
// Limite de 1h: a segunda box morre antes, exatamente no limite ou depois dele.
// Em todos os casos, o intervalo de 1s termina depois de 3600s.
for(const [cooldown,expected] of [[3599.5,2],[3600,2],[3600.5,1]]){
  const p=poke('Limite',DUMMY_HP);p.moves[0].base=cooldown;
  r=simulateHour({team:[p],combos:[{sequence:'poke 1 cd 1',delay:1}],runs:1,random:()=>1});
  assert.equal(r.boxes,expected,'Cooldown '+cooldown+'s');
  assert.equal(r.p10,expected);
  assert.equal(r.p90,expected);
}

// A primeira morte ocorre em t=0, que também é um finishedAt válido.
r=simulateHour({team:[poke('Imediato',DUMMY_HP)],combos:[{sequence:'poke 1 cd 1',delay:1}],seconds:0.5,runs:1,random:()=>1});
assert.equal(r.boxes,1);

// Seis sobreviventes exigem seis targets: a última morre em t=6, não no fim da skill em área.
r=simulateHour({team:[poke('Target',DUMMY_HP/2)],combos:[{sequence:'poke 1 cd 1',delay:1}],seconds:11,runs:1,random:()=>1});
assert.equal(r.boxes,1);
assert.equal(r.combos[0].failures,2);
assert.equal(r.combos[0].avgSurvivors,6);

// Críticos determinísticos deixam 0, 1, 3 ou 6 mobs vivos. Intervalo de 0,5s por target.
// Para 3 sobreviventes: última target em t=1,5s e próximo combo liberado em t=2s.
for(const survivors of [0,1,3,6]){
  const p=poke('Críticos',DUMMY_HP/2);p.heldCrit=50;
  let hit=0;
  r=simulateHour({team:[p],combos:[{sequence:'poke 1 cd 1',delay:0.5}],
    seconds:Math.max(0.25,survivors*0.5),runs:1,random:()=>hit++<survivors?1:0});
  assert.equal(r.boxes,1);
  assert.equal(r.combos[0].runs,1);
  assert.equal(r.combos[0].avgSurvivors,survivors);
  close(r.combos[0].avgTime,0.5+survivors*0.5);
}

// Não contabiliza a box enquanto ainda faltam targets, mesmo que o combo já tenha acabado.
r=simulateHour({team:[poke('Targets pendentes',DUMMY_HP/2)],combos:[{sequence:'poke 1 cd 1',delay:0.5}],seconds:1.5,runs:1,random:()=>1});
assert.equal(r.boxes,0);

// A segunda box precisa de 6s para finalizar os seis sobreviventes.
// A contagem usa a morte da última target; o intervalo posterior não descarta uma morte válida.
for(const [cooldown,expected] of [[3593.5,2],[3594,2],[3594.5,1]]){
  const p=poke('Limite target',DUMMY_HP/2);p.moves[0].base=cooldown;
  r=simulateHour({team:[p],combos:[{sequence:'poke 1 cd 1',delay:1}],runs:1,random:()=>1});
  assert.equal(r.boxes,expected,'Targets com cooldown '+cooldown+'s');
}
// Revive: 5 min por padrão, 4 min com "revive 4"; um cooldown só para os dois.
const half=[poke('A',DUMMY_HP/2)];
assert.deepEqual(parseSequence('poke 1 cd 1\nrevive\nrevive 4',half).slice(1).map(s=>s.cooldown),[300,240]);
// Volta 1: golpe em t=0, revive em t=1 e golpe em t=2. Volta 2: golpe em t=12, espera pelo revive de t=13 a t=241 e golpe em t=242.
const laps=simulateLaps({team:half,combos:[{sequence:'poke 1 cd 1\nrevive 4\npoke 1 cd 1',delay:1}],runs:1,random:()=>1});
assert.deepEqual(laps.map(l=>[l.lap,l.failures,l.reviveUsed,l.reviveWaits]),[[1,0,1,0],[2,0,1,1]]);
close(laps[1].avgWait,228);
// Cooldown do revive no início e no fim de cada box; o golpe seguinte usa um intervalo e o pós-golpe usa outro.
assert.deepEqual(laps.map(l=>[l.avgReviveStart,l.avgReviveEnd]),[[0,238],[238,238]]);
// Revive pulável ("revive 4 pular") com limite padrão de 5s.
const kill=[poke('A',DUMMY_HP)],extra=[{sequence:'poke 1 cd 1',delay:1},{sequence:'revive 4 pular\npoke 1 cd 1',delay:1}];
assert.equal(parseSequence('revive 4 pular\npoke 1 cd 1',kill)[0].skip,true);
// Box nova: na volta 2 o revive ainda tem 228s, então o combo 2 é pulado inteiro e não conta box.
let rows=simulateLaps({team:kill,combos:extra,runs:1,random:()=>1});
assert.deepEqual(rows.map(l=>[l.lap,l.combo,l.skipped]),[[1,1,0],[1,2,0],[2,1,0],[2,2,1]]);
close(rows[3].avgReviveStart,228);
// Com limite alto o mesmo combo espera o revive em vez de pular.
rows=simulateLaps({team:kill,combos:extra,reviveWait:300,runs:1,random:()=>1});
assert.deepEqual([rows[3].skipped,rows[3].reviveWaits],[0,1]);
close(rows[3].avgWait,228);
// Mesma box: com golpe já usado, a box conta e os seis mobs vão para as targets.
rows=simulateLaps({team:half,combos:[{sequence:'poke 1 cd 1\nrevive 4 pular\npoke 1 cd 1',delay:1}],runs:1,random:()=>1});
assert.deepEqual([rows[1].skipped,rows[1].cut,rows[1].failures,rows[1].avgSurvivors],[0,1,1,6]);
// Só combos puláveis: o relógio avança até o revive caber no limite. Boxes em t=1, 241 e 481.
r=simulateHour({team:kill,combos:[extra[1]],seconds:600,runs:1,random:()=>1});
assert.equal(r.boxes,3);
// Pokémon para o próximo lure, disco 0 (na ball o cooldown não anda). Tempos por box de duas voltas.
const duo=[poke('A',DUMMY_HP/2),poke('B',DUMMY_HP)],times=combos=>simulateLaps({team:duo,combos,runs:1,random:()=>1}).map(l=>l.avgTime);
const pair=pullNext=>[{sequence:'poke 1 cd 1',delay:1,pullNext},{sequence:'poke 2 cd 1',delay:1}];
assert.deepEqual(times(pair(false)),[7,1,10,10]);
// Com a opção, B sai da ball antes das seis targets do combo 1 e recupera 7s; A fica parado na ball e atrasa o combo 1.
assert.deepEqual(times(pair(true)),[7,1,17,3]);
// O resto pulado no revive também puxa o Pokémon do próximo combo antes das targets.
const cutCombo=pullNext=>[{sequence:'poke 1 cd 1\nrevive 4 pular\npoke 1 cd 1',delay:1,pullNext},{sequence:'poke 2 cd 1',delay:1}];
assert.deepEqual(times(cutCombo(false)),[3,1,16,10]);
assert.deepEqual(times(cutCombo(true)),[3,1,17,4]);
// Combos por nome: acha o Pokémon sem diferenciar acentos nem maiúsculas; "poke N" antigo vale pela posição, depois do nome.
const named=[poke('Zoroark',1),poke('Pokémon 2',1)];
assert.equal(parseSequence('zoroark cd 1\npokemon 2 cd 1\npoke 2 cd 1',named).map(s=>s.pokemon.name).join(),'Zoroark,Pokémon 2,Pokémon 2');
assert.equal(namedSequence('poke 1 cds 1\nrevive 4 pular\nPOKÉMON 2 cd 1\nMew cd 1',named),'Zoroark cds 1\nrevive 4 pular\nPokémon 2 cds 1\nMew cd 1');
assert.throws(()=>parseSequence('Mew cd 1',named),/"Mew" não está no time/);
console.log('ok');
