// Ranking do Impostor v2. Usa as mesmas tabelas do site (rj_jogadores, rj_partidas, rj_removidos) via REST.
// As partidas do v2 entram com jogo = 'impostor-v2'. O ranking aqui soma Impostor v1 e v2.
// Pontos (derivados): quem venceu sozinho era o impostor (+2); vitória em grupo = inocentes (+1 cada).
(function (global) {
  const C = global.Comum;
  const cfg = global.NOITE_CONFIG || {};
  const R = { JOGO: 'impostor-v2' };
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('rk2:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rk2:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const api = (path, opts = {}) => fetch(cfg.supabaseUrl + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 || r.status === 201 ? null : r.json(); });

  R.chave = n => C.norm(String(n || '')).replace(/[^a-z0-9]+/g, ' ').trim();

  // ---------- cadastrados (chips de nome na entrada) ----------
  let cad = ls.get('cad', []), removidos = new Set(ls.get('removidos', [])), carregou = null;
  R.cadastrados = () => cad.filter(n => !removidos.has(R.chave(n)));
  R.canonico = n => cad.find(x => R.chave(x) === R.chave(n)) || String(n).trim();
  R.atualizar = () => {
    if (!carregou) carregou = api('rj_removidos?select=chave&limit=1000').then(l => { removidos = new Set(l.map(x => x.chave)); ls.set('removidos', [...removidos]); }).catch(() => {})
      .then(() => api('rj_jogadores?select=nome&order=nome.asc&limit=1000'))
      .then(l => { cad = l.map(x => x.nome); ls.set('cad', cad); return cad; })
      .catch(() => cad);
    return carregou;
  };
  // só cadastra quem terminou uma partida que conta no ranking
  const cadastrar = nomes => {
    const novos = nomes.filter(n => !cad.some(x => R.chave(x) === R.chave(n)));
    if (!novos.length) return Promise.resolve();
    novos.forEach(n => cad.push(n)); ls.set('cad', cad);
    return api('rj_jogadores?on_conflict=chave', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(novos.map(n => ({ chave: R.chave(n), nome: n }))) }).catch(() => {});
  };

  // ---------- registro da partida (só o anfitrião chama, uma vez por partida) ----------
  R.registrar = (obj, participantes, vencedores) => {
    try {
      participantes = [...new Set((participantes || []).map(R.canonico))];
      vencedores = [...new Set((vencedores || []).map(R.canonico))].filter(v => participantes.includes(v));
      if (participantes.length < 2 || !vencedores.length) return;
      if (!obj.rkId) obj.rkId = R.JOGO + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const enviados = ls.get('enviados', []);
      if (enviados.includes(obj.rkId)) return;
      enviados.push(obj.rkId); ls.set('enviados', enviados.slice(-300));
      const fila = ls.get('fila', []);
      fila.push({ id: obj.rkId, jogo: R.JOGO, participantes, vencedores, criado: new Date().toISOString() });
      ls.set('fila', fila);
      cadastrar(participantes).then(enviarFila);
    } catch (e) { console.warn('ranking', e); }
  };
  let enviando = false;
  function enviarFila() {
    if (enviando || !cfg.supabaseUrl) return;
    const fp = ls.get('fila', []); if (!fp.length) return;
    enviando = true;
    api('rj_partidas?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(fp) })
      .then(() => { const ids = new Set(fp.map(x => x.id)); ls.set('fila', ls.get('fila', []).filter(x => !ids.has(x.id))); })
      .catch(() => {}).finally(() => { enviando = false; });
  }
  global.addEventListener && global.addEventListener('online', enviarFila);
  setTimeout(enviarFila, 1500);

  // ---------- leitura ----------
  R.partidas = () => api('rj_partidas?select=id,jogo,participantes,vencedores,criado&jogo=in.(impostor,impostor-sala,impostor-v2)&order=criado.desc&limit=5000');
  R.calcular = (partidas, filtro) => {
    const t = {};
    partidas.forEach(p => {
      const soloImpostor = p.vencedores.length === 1 && p.participantes.length >= 3;
      p.participantes.forEach(n => { const k = R.chave(n); t[k] = t[k] || { nome: n, j: 0, v: 0, pts: 0, imp: 0, impV: 0 }; t[k].j++; });
      p.vencedores.forEach(n => { const k = R.chave(n); if (!t[k]) return; t[k].v++; t[k].pts += soloImpostor ? 2 : 1; if (soloImpostor) { t[k].imp++; t[k].impV++; } });
    });
    return Object.values(t).filter(x => !removidos.has(R.chave(x.nome))).map(x => ({ ...x, pct: x.j ? x.v / x.j : 0 }))
      .sort((a, b) => b.pct - a.pct || b.pts - a.pts || b.j - a.j);
  };

  // selo de treino (o sala.js chama Ranking.badge quando o estado da sala muda)
  R.badge = on => {
    let b = document.getElementById('badgeTreino');
    if (!on) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'badgeTreino'; b.className = 'badge-treino'; b.textContent = 'Treino · não conta no ranking'; document.body.appendChild(b); }
  };
  global.Ranking = R;
})(window);
