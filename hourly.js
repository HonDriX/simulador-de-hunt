(function(root){
  const E=typeof module!=='undefined'?require('./engine.js'):root.CooldownEngine;
  const parseSequence=typeof module!=='undefined'?require('./automation.js').parseSequence:root.parseSequence;
  const MOBS=6;
  // Simulação por eventos: o tempo salta direto para o fim do cooldown ou do intervalo, sem relógio real.
  function runHour(config,random){
    const team=config.team.map(p=>({...p,focusReady:false,moves:p.moves.map(m=>({...m,remaining:0,total:0}))}));
    const state={active:0,disk:config.disk,globalCrit:config.globalCrit,globalAtk:config.globalAtk,elapsed:0,team,box:null};
    const combos=config.combos.map((c,slot)=>c&&{slot,delay:c.delay,steps:parseSequence(c.sequence,team)}).filter(Boolean);
    if(!combos.length)throw Error('Salve pelo menos um combo para simular.');
    const stats=combos.map(c=>({slot:c.slot,runs:0,failures:0,survivors:0,hpLeft:0,time:0}));
    let boxes=0,done=0;
    while(state.elapsed<config.seconds){
      const i=boxes%combos.length,c=combos[i],s=stats[i],start=state.elapsed;
      state.box=E.newBox(MOBS);
      for(const step of c.steps){
        if(step.type==='revive'){team[state.active].moves.forEach(m=>{m.remaining=0;m.total=0;});continue;}
        const p=team.indexOf(step.pokemon);
        if(state.active!==p)E.swap(state,p);
        E.advance(state,step.move.remaining);
        E.cast(state,p,step.moveIndex,random,step.elixir);
        E.advance(state,c.delay);
        if(state.box.finishedAt!==null)break;
      }
      const alive=state.box.targets.filter(t=>t.hp>0);
      if(alive.length){
        s.failures++;s.survivors+=alive.length;s.hpLeft+=alive.reduce((sum,t)=>sum+t.hp,0);
        // Uma target finaliza cada sobrevivente. O intervalo após a última skill do combo
        // já avançou o relógio até a primeira target; cada target mantém o mesmo intervalo.
        alive.forEach((target,index)=>{
          target.hp=0;
          if(index===alive.length-1)state.box.finishedAt=state.elapsed;
          E.advance(state,c.delay);
        });
      }
      s.runs++;s.time+=state.elapsed-start;boxes++;
      // O intervalo após o golpe ainda avança os cooldowns, mas não adia uma morte já ocorrida.
      // A última target também registra a morte antes do intervalo posterior.
      const completedAt=state.box.finishedAt??state.elapsed;
      if(completedAt<=config.seconds)done++;
    }
    return {boxes:done,stats};
  }
  function simulateHour({team,disk=0,globalCrit=0,globalAtk=0,combos,seconds=3600,runs=100,random=Math.random}){
    const hours=Array.from({length:runs},()=>runHour({team,disk,globalCrit,globalAtk,combos,seconds},random));
    const boxes=hours.map(h=>h.boxes).sort((a,b)=>a-b),pick=q=>boxes[Math.min(boxes.length-1,Math.floor(q*boxes.length))];
    const combosOut=hours[0].stats.map((_,i)=>{
      const all=hours.map(h=>h.stats[i]),sum=k=>all.reduce((t,s)=>t+s[k],0);
      return {combo:all[0].slot+1,runs:sum('runs'),failures:sum('failures'),failuresPerHour:sum('failures')/runs,
        avgTime:sum('time')/sum('runs'),avgSurvivors:sum('failures')?sum('survivors')/sum('failures'):0,
        avgHpLeft:sum('survivors')?sum('hpLeft')/sum('survivors'):0};
    });
    // Mediana e faixa em boxes inteiras concluídas dentro do tempo; a box que passa de 1h não conta.
    return {runs,boxes:pick(0.5),p10:pick(0.1),p90:pick(0.9),combos:combosOut};
  }
  if(typeof module!=='undefined'){module.exports={simulateHour,MOBS};return;}

  const $=id=>document.getElementById(id),n=(v,d=0)=>v.toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
  $('simulate-hour').onclick=()=>{
    const out=$('hour-result');
    try{
      const s=root.pokeSimulator;s.sync();
      const r=simulateHour({team:s.state.team,disk:s.state.disk,globalCrit:s.state.globalCrit,globalAtk:s.state.globalAtk,combos:root.pokeCombos.snapshot()});
      const range=r.p10===r.p90?'':` · varia de ${r.p10} a ${r.p90} boxes (p10–p90)`;
      out.textContent=[`${r.boxes} boxes completas em 1h = ${r.boxes*MOBS} mobs (mediana de ${r.runs} horas${range})`,
        ...r.combos.map(c=>`Combo ${c.combo}: ${n(c.avgTime,1)}s por box · ${c.failures?`precisou de target ${n(c.failuresPerHour,1)}x/h (${c.failures}/${c.runs}) · ${n(c.avgSurvivors,1)} mobs restantes após o combo com ${n(c.avgHpLeft)} HP (${n(c.avgHpLeft/E.DUMMY_HP*100,1)}%) em média`:'fechou todas as boxes'}`),
        'Tempo entre boxes desconsiderado; o intervalo de cada combo conta como tempo de reação. Finalização incluída: 1 skill target por mob restante, com o mesmo intervalo do combo.'].join('\n');
    }catch(e){out.textContent=e.message;}
  };
})(globalThis);
