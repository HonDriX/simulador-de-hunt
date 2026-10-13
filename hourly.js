(function(root){
  const E=typeof module!=='undefined'?require('./engine.js'):root.CooldownEngine;
  const parseSequence=typeof module!=='undefined'?require('./automation.js').parseSequence:root.parseSequence;
  const MOBS=6;
  // Simulação por eventos: o tempo salta direto para o fim do cooldown ou do intervalo, sem relógio real.
  function runHour(config,random){
    const team=config.team.map(p=>({...p,focusReady:false,moves:p.moves.map(m=>({...m,remaining:0,total:0}))}));
    const state={active:0,disk:config.disk,globalCrit:config.globalCrit,globalAtk:config.globalAtk,elapsed:0,team,box:null};
    const combos=config.combos.map((c,slot)=>c&&{slot,delay:c.delay,pullNext:!!c.pullNext,steps:parseSequence(c.sequence,team)}).filter(Boolean);
    combos.forEach(c=>{c.first=team.indexOf(c.steps.find(step=>step.pokemon).pokemon);});
    if(!combos.length)throw Error('Salve pelo menos um combo para simular.');
    const stats=combos.map(c=>({slot:c.slot,runs:0,failures:0,survivors:0,hpLeft:0,time:0,waits:0,waited:0,skipped:0,cut:0}));
    const log=[],limit=config.reviveWait??5;
    let turn=0,done=0,idle=0;
    // Com laps, roda um número fixo de voltas pelos combos em vez de preencher o tempo.
    while(config.laps?turn<config.laps*combos.length:state.elapsed<config.seconds){
      const i=turn%combos.length,c=combos[i],s=stats[i],start=state.elapsed,reviveStart=state.reviveRemaining||0;
      turn++;
      state.box=E.newBox(MOBS);
      let revives=0,waited=0,casts=0,cut=false;
      for(const step of c.steps){
        if(step.type==='revive'){
          const wait=state.reviveRemaining||0;
          // Revive pulável acima do limite: o resto do combo não roda nesta volta.
          if(step.skip&&wait>limit){cut=true;break;}
          // Revive em cooldown: espera liberar e anota o tempo perdido.
          if(wait>0.000001){E.advance(state,wait);waited+=wait;s.waits++;s.waited+=wait;}
          E.revive(state,step.cooldown);revives++;continue;
        }
        const p=team.indexOf(step.pokemon);
        if(state.active!==p)E.swap(state,p);
        E.advance(state,step.move.remaining);
        E.cast(state,p,step.moveIndex,random,step.elixir);casts++;
        E.advance(state,c.delay);
        if(state.box.finishedAt!==null)break;
      }
      // Pokémon para o próximo lure: sai da ball ao fim do combo, antes das targets, mesmo se o revive foi pulado.
      if(c.pullNext)E.swap(state,combos[i+1<combos.length?i+1:0].first);
      if(cut&&!casts){
        // Nenhum golpe usado: o combo foi pulado inteiro, não conta box nem gasta tempo.
        s.skipped++;log.push({slot:c.slot,skipped:true,survivors:0,hpLeft:0,revives:0,waited:0,time:0,reviveStart,reviveEnd:reviveStart});
        // Volta inteira pulada sem o tempo andar: espera o revive caber no limite para não girar em falso.
        if(++idle>=combos.length){E.advance(state,Math.max(state.reviveRemaining-limit,0.001));idle=0;}
        continue;
      }
      idle=0;if(cut)s.cut++;
      const alive=state.box.targets.filter(t=>t.hp>0);
      const entry={slot:c.slot,cut,survivors:alive.length,hpLeft:alive.reduce((sum,t)=>sum+t.hp,0),revives,waited,reviveStart};
      if(alive.length){
        s.failures++;s.survivors+=alive.length;s.hpLeft+=entry.hpLeft;
        // Uma target finaliza cada sobrevivente. O intervalo após a última skill do combo
        // já avançou o relógio até a primeira target; cada target mantém o mesmo intervalo.
        alive.forEach((target,index)=>{
          target.hp=0;
          if(index===alive.length-1)state.box.finishedAt=state.elapsed;
          E.advance(state,c.delay);
        });
      }
      s.runs++;s.time+=state.elapsed-start;
      entry.time=state.elapsed-start;entry.reviveEnd=state.reviveRemaining;log.push(entry);
      // O intervalo após o golpe ainda avança os cooldowns, mas não adia uma morte já ocorrida.
      // A última target também registra a morte antes do intervalo posterior.
      const completedAt=state.box.finishedAt??state.elapsed;
      if(completedAt<=config.seconds)done++;
    }
    return {boxes:done,stats,log};
  }
  function simulateHour({team,disk=0,globalCrit=0,globalAtk=0,combos,reviveWait,seconds=3600,runs=100,random=Math.random}){
    const hours=Array.from({length:runs},()=>runHour({team,disk,globalCrit,globalAtk,combos,reviveWait,seconds},random));
    const boxes=hours.map(h=>h.boxes).sort((a,b)=>a-b),pick=q=>boxes[Math.min(boxes.length-1,Math.floor(q*boxes.length))];
    const combosOut=hours[0].stats.map((_,i)=>{
      const all=hours.map(h=>h.stats[i]),sum=k=>all.reduce((t,s)=>t+s[k],0);
      return {combo:all[0].slot+1,runs:sum('runs'),failures:sum('failures'),failuresPerHour:sum('failures')/runs,waitsPerHour:sum('waits')/runs,avgWait:sum('waits')?sum('waited')/sum('waits'):0,
        skippedPerHour:sum('skipped')/runs,cutPerHour:sum('cut')/runs,
        avgTime:sum('runs')?sum('time')/sum('runs'):0,avgSurvivors:sum('failures')?sum('survivors')/sum('failures'):0,
        avgHpLeft:sum('survivors')?sum('hpLeft')/sum('survivors'):0};
    });
    // Mediana e faixa em boxes inteiras concluídas dentro do tempo; a box que passa de 1h não conta.
    return {runs,boxes:pick(0.5),p10:pick(0.1),p90:pick(0.9),combos:combosOut};
  }
  // Volta a volta: mostra se cada combo fecha o dano, o cooldown do revive e se o combo esperou ou foi pulado por ele.
  function simulateLaps({team,disk=0,globalCrit=0,globalAtk=0,combos,reviveWait,laps=2,runs=100,random=Math.random}){
    const logs=Array.from({length:runs},()=>runHour({team,disk,globalCrit,globalAtk,combos,reviveWait,laps},random).log),perLap=logs[0].length/laps;
    return logs[0].map((first,i)=>{
      const all=logs.map(l=>l[i]),ran=all.filter(b=>!b.skipped),sum=f=>ran.reduce((t,b)=>t+f(b),0),failures=ran.filter(b=>b.survivors).length,waits=ran.filter(b=>b.waited).length,survivors=sum(b=>b.survivors);
      return {lap:Math.floor(i/perLap)+1,combo:first.slot+1,runs,ran:ran.length,skipped:runs-ran.length,cut:ran.filter(b=>b.cut).length,failures,
        avgSurvivors:failures?survivors/failures:0,avgHpLeft:survivors?sum(b=>b.hpLeft)/survivors:0,avgTime:ran.length?sum(b=>b.time)/ran.length:0,
        reviveUsed:ran.filter(b=>b.revives).length,reviveWaits:waits,avgWait:waits?sum(b=>b.waited)/waits:0,
        avgReviveStart:all.reduce((t,b)=>t+b.reviveStart,0)/runs,avgReviveEnd:all.reduce((t,b)=>t+b.reviveEnd,0)/runs};
    });
  }
  if(typeof module!=='undefined'){module.exports={simulateHour,simulateLaps,MOBS};return;}

  const $=id=>document.getElementById(id),n=(v,d=0)=>v.toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
  const inputs=()=>{const s=root.pokeSimulator;s.sync();return {team:s.state.team,disk:s.state.disk,globalCrit:s.state.globalCrit,globalAtk:s.state.globalAtk,combos:root.pokeCombos.snapshot(),reviveWait:root.pokeCombos.reviveWait()};};
  const leftover=c=>`${n(c.avgSurvivors,1)} mobs restantes após o combo com ${n(c.avgHpLeft)} HP (${n(c.avgHpLeft/E.DUMMY_HP*100,1)}%) em média`;
  const span=s=>s<60?`${n(s,1)}s`:`${Math.floor(s/60)}min ${Math.round(s%60)}s`;
  $('simulate-hour').onclick=()=>{
    const out=$('hour-result');
    try{
      const r=simulateHour(inputs());
      const range=r.p10===r.p90?'':` · varia de ${r.p10} a ${r.p90} boxes (p10–p90)`;
      out.textContent=[`${r.boxes} boxes completas em 1h = ${r.boxes*MOBS} mobs (mediana de ${r.runs} horas${range})`,
        ...r.combos.map(c=>`Combo ${c.combo}: `+[c.runs?`${n(c.avgTime,1)}s por box`:'', !c.runs?'':c.failures?`precisou de target ${n(c.failuresPerHour,1)}x/h (${c.failures}/${c.runs}) · ${leftover(c)}`:'fechou todas as boxes',
          c.waitsPerHour?`esperou o revive ${n(c.waitsPerHour,1)}x/h (${span(c.avgWait)} em média)`:'',
          c.skippedPerHour?`pulado ${n(c.skippedPerHour,1)}x/h (revive em cooldown)`:'',
          c.cutPerHour?`resto pulado no revive ${n(c.cutPerHour,1)}x/h`:''].filter(Boolean).join(' · ')),
        'Tempo entre boxes desconsiderado; o intervalo de cada combo conta como tempo de reação. Finalização incluída: 1 skill target por mob restante, com o mesmo intervalo do combo.'].join('\n');
    }catch(e){out.textContent=e.message;}
  };
  $('simulate-laps').onclick=()=>{
    const out=$('hour-result');
    try{
      const count=Number($('lap-count').value),laps=Number.isInteger(count)&&count>=1&&count<=20?count:2;
      const rows=simulateLaps({...inputs(),laps}),share=(count,runs)=>count<runs?` em ${count}/${runs}`:'';
      const clock=s=>{const t=Math.round(s);return t?`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`:'pronto';};
      const line=c=>!c.ran?`Combo ${c.combo} · pulado · revive ${clock(c.avgReviveStart)}`:[`Combo ${c.combo}`,
        c.failures?`não fechou${share(c.failures,c.ran)} (${n(c.avgSurvivors,1)} mobs com ${n(c.avgHpLeft/E.DUMMY_HP*100,1)}% de HP)`:'fechou',
        `${n(c.avgTime,1)}s`,
        `revive ${clock(c.avgReviveStart)} → ${clock(c.avgReviveEnd)}`,
        c.reviveWaits?`esperou ${span(c.avgWait)} pelo revive${share(c.reviveWaits,c.ran)}`:'',
        c.cut?`resto pulado no revive${share(c.cut,c.ran)}`:'',
        c.skipped?`pulado em ${c.skipped}/${c.runs}`:''].filter(Boolean).join(' · ');
      const blocks=[...new Set(rows.map(c=>c.lap))].map(lap=>[`Volta ${lap}`,...rows.filter(c=>c.lap===lap).map(line)].join('\n'));
      out.textContent=[`Teste de ${laps} ${laps===1?'volta':'voltas'} · boxes de ${MOBS} · ${rows[0].runs} execuções`,...blocks,
        'Revive: cooldown no início → no fim da box (min:s). Combo pulado não conta box. Mobs restantes são finalizados com 1 target cada.'].join('\n\n');
    }catch(e){out.textContent=e.message;}
  };
})(globalThis);
