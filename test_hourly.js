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
assert.equal(r.boxes,3);
close(r.combos[0].avgTime,(1+(9-1/6)+1)/2);
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

// Preserva a premissa de que target finaliza os sobreviventes ao fim do combo.
r=simulateHour({team:[poke('Target',DUMMY_HP/2)],combos:[{sequence:'poke 1 cd 1',delay:1}],seconds:11,runs:1,random:()=>1});
assert.equal(r.boxes,2);
assert.equal(r.combos[0].failures,2);
assert.equal(r.combos[0].avgSurvivors,6);
console.log('ok');
