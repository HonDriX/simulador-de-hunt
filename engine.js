(function (root) {
  const effective = (base, held, mode) => Math.max(0, mode === 'seconds' ? base - held : base * (1 - held / 100));
  function advance(state, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Tempo inválido');
    state.elapsed += seconds;
    state.team.forEach((p, index) => {
      const rate = index === state.active ? 1 : state.disk ? 1 / state.disk : 0;
      p.moves.forEach(m => { m.remaining = Math.max(0, m.remaining - seconds * rate); });
    });
  }
  function cast(state, pokemon, move, random = Math.random, elixir = 0) {
    const p = state.team[pokemon], m = p?.moves[move];
    if (!m || pokemon !== state.active || m.remaining > 0.000001) return false;
    m.total = effective(m.base, p.held, p.heldMode);
    m.remaining = m.total;
    if (m.focus === true) { p.focusReady = true; return true; }
    const focusMultiplier = p.focusReady ? 1.5 : 1;
    p.focusReady = false;
    if (state.box && state.box.finishedAt === null) {
      const box = state.box;
      const damage = (m.damagePerHit || 0) * focusMultiplier * attackMultiplier(p, state) * 2 * (1 + Math.max(0, Number(elixir) || 0) / 100);
      if (damage > 0) {
        if (box.startedAt === null) box.startedAt = state.elapsed;
        box.casts++;
        const results = damagePerTarget(state, p, box.targets.filter(t => t.hp > 0).map(t => ({ id: t.id, damage, hits: m.hits || 1 })), random);
        box.targets.forEach(t => { t.lastDamage = 0; t.critical = false; t.criticalHits = 0; t.hits = 0; });
        results.forEach(r => {
          box.criticalHits = (box.criticalHits || 0) + r.criticalHits;
          box.hits = (box.hits || 0) + r.hits;
          const t = box.targets[r.id];
          t.lastDamage = Math.min(t.hp, r.damage);
          t.hp = Math.max(0, t.hp - r.damage);
          t.critical = r.critical;
          t.criticalHits = r.criticalHits;
          t.totalCriticalHits = (t.totalCriticalHits || 0) + r.criticalHits;
          t.totalHits = (t.totalHits || 0) + r.hits;
          t.hits = r.hits;
        });
        box.lastMove = `${p.name} · ${m.name}`;
        if (box.targets.every(t => t.hp === 0)) box.finishedAt = state.elapsed;
      }
    }
    return true;
  }
  function swap(state, index) {
    if (!Number.isInteger(index) || !state.team[index]) throw new Error('Pokémon inválido');
    state.active = index;
  }
  const percent = value => Math.min(100, Math.max(0, Number(value) || 0));
  const attackMultiplier = (pokemon, state = {}) => 1 + (Math.max(0, Number(pokemon.atk) || 0) + Math.max(0, Number(state.globalAtk) || 0) + (pokemon.food === 'blaziken' ? 3 : 0)) / 100;
  const criticalChance = (state, pokemon) => percent(percent(state.globalCrit) + percent(pokemon.heldCrit) + (pokemon.food === 'salad' ? 3 : 0));
  // damage is the damage per hit; every hit on every target has an independent roll.
  function damagePerTarget(state, pokemon, targets, random = Math.random) {
    const chance = criticalChance(state, pokemon) / 100;
    if (!targets.every(t => Number.isFinite(t.damage) && t.damage >= 0 && Number.isInteger(t.hits ?? 1) && (t.hits ?? 1) > 0)) throw new Error('Dano ou hits inválidos');
    return targets.map(target => {
      const hits = target.hits ?? 1;
      let criticalHits = 0;
      for (let hit = 0; hit < hits; hit++) if (random() < chance) criticalHits++;
      return { ...target, hits, criticalHits, critical: criticalHits > 0, damage: target.damage * (hits + criticalHits) };
    });
  }
  function newBox() {
    return { maxHp: 797539, targets: Array.from({length:8}, (_,id) => ({id,hp:797539,lastDamage:0,critical:false,totalCriticalHits:0,totalHits:0})), startedAt:null, finishedAt:null, casts:0, criticalHits:0, hits:0, lastMove:'' };
  }
  const api = { effective, advance, cast, swap, percent, criticalChance, damagePerTarget, newBox, attackMultiplier };
  if (typeof module !== 'undefined') module.exports = api;
  else root.CooldownEngine = api;
})(globalThis);
