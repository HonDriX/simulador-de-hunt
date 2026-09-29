const assert=require('node:assert/strict');
const {DUMMY_HP}=require('./engine.js');
const {simulateHour}=require('./hourly.js');
const poke=(name,damage)=>({name,held:0,heldCrit:0,atk:0,food:null,heldMode:'percent',moves:[{name:'Golpe 1',base:10,damagePerHit:damage,hits:1}]});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

// Um combo que mata tudo: 1 box a cada 10s de cooldown; boxes terminam em 1, 11, …, 3591 e a de 3601s não conta.
let r=simulateHour({team:[poke('A',DUMMY_HP)],combos:[{sequence:'poke 1 cd 1',delay:1}],runs:1,random:()=>1});
assert.equal(r.boxes,360);
assert.equal(r.combos[0].failures,0);

// Disco 6: dentro da ball o Pokémon 1 recupera 1s a cada 6s. Combo 2 só tira metade da vida.
r=simulateHour({team:[poke('A',DUMMY_HP),poke('B',DUMMY_HP/2)],disk:6,combos:[{sequence:'poke 1 cd 1',delay:1},{sequence:'poke 2 cd 1',delay:1}],seconds:11,runs:1,random:()=>1});
assert.equal(r.boxes,2);
close(r.combos[0].avgTime,(1+(9-1/6)+1)/2);
assert.deepEqual([r.combos[1].failures,r.combos[1].avgSurvivors],[1,6]);
close(r.combos[1].avgHpLeft,DUMMY_HP/2);
console.log('ok');
