const assert=require('node:assert/strict');
const {DUMMY_HP}=require('./engine.js');
const {simulateHour}=require('./hourly.js');
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
console.log('ok');

