(function(root){
  function decode(text){
    return text.split(/\r?\n/).filter(l=>l.trim()).map(line=>{
      const s=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      if(/^revive$/i.test(s))return {type:'revive'};
      const e=s.match(/^elixir(?:\s+(\d+(?:[.,]\d+)?)\s*%?)?$/i);
      if(e)return {type:'elixir',value:e[1]?Number(e[1].replace(',','.')):70};
      const p=s.match(/^poke(?:mon)?\s+(\d+)\s+(?:cds?|golpes?)\s+(.+)$/i);
      if(!p)throw Error('Há um comando não reconhecido. Corrija no Modo avançado.');
      const r=p[2].match(/^(\d+)\s*(?:a|ate|-)\s*(\d+)$/i);
      let moves;
      if(r){if(+r[1]<1||+r[2]>6||+r[2]<+r[1])throw Error('Intervalo de golpes inválido.');moves=Array.from({length:+r[2]-+r[1]+1},(_,i)=>+r[1]+i);}
      else if(/^\d+(?:\s+\d+)*$/.test(p[2]))moves=p[2].split(/\s+/).map(Number);
      else throw Error('Lista de golpes inválida.');
      if(moves.some(n=>n<1||n>6))throw Error('Escolha golpes de 1 a 6.');
      return {type:'pokemon',pokemon:+p[1],moves};
    });
  }
  function encode(steps){return steps.map(s=>s.type==='pokemon'?`poke ${s.pokemon} cds ${s.moves.join(' ')}`:s.type==='revive'?'revive':s.value===70?'elixir':`elixir ${s.value}%`).join('\n');}
  if(typeof module!=='undefined'){module.exports={decode,encode};return;}
  const $=id=>document.getElementById(id),source=$('auto-sequence');
  let steps=[],editing=null,lastText=null,lastTeam='',valid=true;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function message(s){$('builder-status').textContent=s;}
  function render(){
    $('builder-steps').innerHTML=steps.map((s,i)=>{
      const p=root.pokeSimulator.state.team[s.pokemon-1];
      const title=s.type==='pokemon'?`${p?.name||'Pokémon removido'} · golpes ${s.moves.join(', ')}`:s.type==='revive'?'Revive · recupera os cooldowns':`Elixir · +${s.value}% no próximo Pokémon`;
      return `<li><span class="step-number">${i+1}</span><span class="step-title">${escape(title)}</span><div class="step-actions">${s.type==='pokemon'?`<button type="button" data-step="${i}" data-op="edit">Editar</button>`:''}<button type="button" data-step="${i}" data-op="up" aria-label="Subir etapa ${i+1}" ${i===0?'disabled':''}>↑</button><button type="button" data-step="${i}" data-op="down" aria-label="Descer etapa ${i+1}" ${i===steps.length-1?'disabled':''}>↓</button><button type="button" data-step="${i}" data-op="remove">Remover</button></div></li>`;
    }).join('');
    $('builder-empty').hidden=!!steps.length;
  }
  function cancel(){editing=null;$('builder-editor').hidden=true;}
  function sync(){
    const team=root.pokeSimulator.state.team,signature=JSON.stringify(team.map(p=>[p.name,p.moves.map(m=>m.name)]));
    if(signature!==lastTeam){lastTeam=signature;const selected=$('builder-pokemon').value;$('builder-pokemon').innerHTML=team.map((p,i)=>`<option value="${i+1}">${i+1}. ${escape(p.name)}</option>`).join('');if(team[+selected-1])$('builder-pokemon').value=selected;render();}
    if(source.value!==lastText){lastText=source.value;cancel();try{steps=decode(lastText);valid=true;message('');render();}catch(e){valid=false;steps=[];render();message(e.message);$('builder-advanced').open=true;}}
    $('builder-fields').disabled=source.disabled||!valid;
  }
  function commit(){source.value=encode(steps);lastText=source.value;source.dispatchEvent(new Event('input',{bubbles:true}));render();message('Sequência atualizada. Salve no combo desejado.');}
  function openEditor(index=null){editing=index;const step=index===null?null:steps[index];$('builder-pokemon').value=String(step?.pokemon||1);document.querySelectorAll('[name="builder-move"]').forEach(c=>c.checked=step?step.moves.includes(+c.value):true);$('builder-apply').textContent=step?'Aplicar alteração':'Adicionar etapa';$('builder-editor').hidden=false;}
  $('builder-add').onclick=()=>openEditor();
  $('builder-cancel').onclick=cancel;
  $('builder-apply').onclick=()=>{
    const moves=[...document.querySelectorAll('[name="builder-move"]:checked')].map(c=>+c.value);
    if(!moves.length){message('Marque pelo menos um golpe.');return;}
    const step={type:'pokemon',pokemon:+$('builder-pokemon').value,moves};
    if(!root.pokeSimulator.state.team[step.pokemon-1]){message('Selecione um Pokémon válido.');return;}
    if(editing===null)steps.push(step);else steps[editing]=step;cancel();commit();
  };
  $('builder-elixir').onclick=()=>{cancel();steps.push({type:'elixir',value:70});commit();};
  $('builder-revive').onclick=()=>{cancel();steps.push({type:'revive'});commit();};
  $('builder-steps').onclick=event=>{const b=event.target.closest('[data-step]');if(!b||source.disabled)return;const i=+b.dataset.step,op=b.dataset.op;if(op==='edit'){openEditor(i);return;}cancel();if(op==='remove')steps.splice(i,1);else{const j=i+(op==='up'?-1:1);if(j<0||j>=steps.length)return;[steps[i],steps[j]]=[steps[j],steps[i]];}commit();};
  $('builder-save').onclick=()=>{const i=$('builder-slot').value;document.querySelector(`#combo-list [data-action="save"][data-combo="${i}"]`).click();message($('combo-status').textContent);};
  source.addEventListener('input',sync);sync();setInterval(sync,200);
})(globalThis);
