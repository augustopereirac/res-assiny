// Cadastro de jogadores + registro de partidas para o ranking (Supabase REST).
// Tabelas: rj_jogadores (chave, nome) e rj_partidas (id, jogo, participantes, vencedores, criado).
(function (global) {
  const C = global.Comum;
  const cfg = global.NOITE_CONFIG || {};
  const R = {};
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('rk:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rk:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  R.chave = n => C.norm(String(n || '')).replace(/[^a-z0-9]+/g, ' ').trim();
  R.JOGOS = { nolimite: 'No Limite', top100: 'Top 100', qtl: 'Quem Tava Lá', impostor: 'Impostor', montatime: 'Monta o Time', carreira: 'De Quem É a Carreira?', ordene: 'Ordene a Carreira' };

  const api = (path, opts = {}) => fetch(cfg.supabaseUrl + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 || r.status === 201 && !opts.ret ? null : r.json(); });

  // ---------- cadastrados ----------
  let cad = ls.get('cad', []); // [nome]
  let carregou = null;
  R.cadastrados = () => cad.slice();
  R.atualizar = (forcar) => {
    if (!carregou || forcar) carregou = api('rj_jogadores?select=nome&order=nome.asc&limit=1000')
      .then(l => { cad = l.map(x => x.nome); ls.set('cad', cad); enviarFila(); return cad; })
      .catch(() => cad);
    return carregou;
  };
  // devolve o nome como está cadastrado (mesma grafia), ou o próprio nome
  R.canonico = n => cad.find(x => R.chave(x) === R.chave(n)) || String(n).trim();
  R.cadastrar = nome => {
    nome = String(nome || '').trim(); if (!nome) return;
    if (cad.some(x => R.chave(x) === R.chave(nome))) return;
    cad.push(nome); cad.sort((a, b) => a.localeCompare(b, 'pt')); ls.set('cad', cad);
    const fila = ls.get('filaCad', []); fila.push(nome); ls.set('filaCad', fila); enviarFila();
  };

  // ---------- partidas ----------
  // obj: o objeto da partida (marca um id para não registrar duas vezes)
  R.registrar = (obj, jogo, participantes, vencedores) => {
    try {
      participantes = [...new Set((participantes || []).map(R.canonico))];
      vencedores = [...new Set((vencedores || []).map(R.canonico))].filter(v => participantes.includes(v));
      if (participantes.length < 2 || !vencedores.length) return;
      if (!obj.rkId) obj.rkId = jogo + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const enviados = ls.get('enviados', []);
      if (enviados.includes(obj.rkId)) return;
      enviados.push(obj.rkId); ls.set('enviados', enviados.slice(-300));
      participantes.forEach(R.cadastrar);
      const fila = ls.get('filaPart', []);
      fila.push({ id: obj.rkId, jogo, participantes, vencedores, criado: new Date().toISOString() });
      ls.set('filaPart', fila); enviarFila();
    } catch (e) { console.warn('ranking', e); }
  };

  let enviando = false;
  function enviarFila() {
    if (enviando || !cfg.supabaseUrl) return;
    const fc = ls.get('filaCad', []), fp = ls.get('filaPart', []);
    if (!fc.length && !fp.length) return;
    enviando = true;
    const p1 = fc.length ? api('rj_jogadores?on_conflict=chave', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(fc.map(n => ({ chave: R.chave(n), nome: n }))) })
      .then(() => ls.set('filaCad', ls.get('filaCad', []).filter(n => !fc.includes(n)))) : Promise.resolve();
    const p2 = p1.then(() => fp.length ? api('rj_partidas?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(fp) })
      .then(() => { const ids = new Set(fp.map(x => x.id)); ls.set('filaPart', ls.get('filaPart', []).filter(x => !ids.has(x.id))); }) : null);
    p2.catch(() => {}).finally(() => { enviando = false; });
  }
  global.addEventListener && global.addEventListener('online', enviarFila);
  setTimeout(enviarFila, 1500);

  R.partidas = () => api('rj_partidas?select=id,jogo,participantes,vencedores,criado&order=criado.desc&limit=5000');

  // ---------- ranking ----------
  R.calcular = (partidas, jogo) => {
    const t = {};
    partidas.filter(p => !jogo || p.jogo.replace('-sala', '') === jogo).forEach(p => {
      p.participantes.forEach(n => { const k = R.chave(n); t[k] = t[k] || { nome: n, j: 0, v: 0 }; t[k].j++; });
      p.vencedores.forEach(n => { const k = R.chave(n); if (t[k]) t[k].v++; });
    });
    return Object.values(t).map(x => ({ ...x, pct: x.j ? x.v / x.j : 0 }))
      .sort((a, b) => b.pct - a.pct || b.v - a.v || b.j - a.j);
  };

  // chips de cadastrados (para o editor de jogadores e para a tela de entrada)
  R.htmlChips = (excluir, attr) => {
    const ex = new Set((excluir || []).map(R.chave));
    const l = cad.filter(n => !ex.has(R.chave(n)));
    return l.length ? `<div class="cad-chips"><span class="muted small">Cadastrados:</span>${l.map(n => `<button type="button" class="chip" ${attr}="${C.esc(n)}">+ ${C.esc(n)}</button>`).join('')}</div>` : '';
  };

  global.Ranking = R;
})(window);
