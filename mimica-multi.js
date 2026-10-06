// Mímica — vários celulares. Só o celular de quem faz a mímica mostra os nomes; os outros veem só o que já foi acertado.
(function () {
  const C = window.Comum, M = window.Mimica;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const JOGO = 'mimica';
  const render = html => { app.innerHTML = html; };
  let sala = null, souHost = false, estado = null, presentes = [], H = null, priv = null, manual = null;

  Sala.telaEntrada(app, 'Mímica', 'mimica.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    const iniciarH = () => { H = Sala.carregarHost(JOGO, codigo) || { cfg: { tema: 'futebol' }, fase: 'lobby', partida: 0 }; };
    if (souHost) iniciarH();
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { estado = e; desenhar(); },
      onPrivado: d => { priv = d; desenhar(); },
      onAcao: acaoHost, snapshot: () => H,
      onVirarHost: h => { if (h) Sala.salvarHost(JOGO, codigo, h); souHost = true; iniciarH(); toast('👑 O anfitrião saiu. Agora você é o anfitrião da sala.'); reenviar(); publicar(); },
      onDeixarHost: () => { souHost = false; rel.parar(); const b = document.getElementById('barraAusentes'); if (b) b.remove(); },
      onPresenca: l => { presentes = l; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) { reenviar(); publicar(); } else if (!estado) desenhar(); } }
    });
  });

  // ---------- anfitrião ----------
  const nomeId = id => ((H && H.jogadores) || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const rodadaAtual = () => H.rodadas && H.rodadas[H.k];
  function publico() {
    const r = rodadaAtual();
    return {
      prazo: (H.fase === 'jogo' && H.prazo) || null,
      fase: H.fase, cfg: H.cfg, partida: H.partida, jogadores: H.jogadores || [], times: H.times || [], k: H.k || 0, total: (H.rodadas || []).length,
      rodada: r ? { time: r.time, mimo: r.mimo, adivinha: r.adivinha, acertos: r.acertos || [], acertados: (r.acertos || []).map(i => r.nomes[i]),
        nomes: H.fase === 'resultado' || H.fase === 'final' ? r.nomes : null, tempo: r.tempo } : null,
      placar: M.placar(H.times || [], H.feitas || [])
    };
  }
  const rel = Sala.relogio(() => H, () => { if (H.fase === 'jogo') fimRodada(); });
  function publicar() {
    if (souHost) {
      Sala.limparExpulsos(H);
      if (H.fase === 'jogo') { const k = H.partida + '-' + H.k; if (H.prazoKey !== k || !H.prazo) { rel.novo(k, M.TEMPO / C.TEMPO); H.prazo = H.rodadas[H.k].inicio + M.TEMPO; } }
      else rel.limpar();
    }
    Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); if (souHost) rel.armar();
    Sala.barraAusentes(H.fase === 'passe' || H.fase === 'jogo' ? (H.jogadores || []).map(j => j.id).filter(id => (H.rodadas || []).some(r => r.mimo === id || r.adivinha.includes(id))) : [], presentes, nomeId, tirar);
  }
  // os nomes só vão para o celular de quem faz a mímica
  function reenviar() { const r = H && rodadaAtual(); if (r && r.nomes && (H.fase === 'passe' || H.fase === 'jogo')) sala.privado(r.mimo, { k: H.k, partida: H.partida, nomes: r.nomes }); }

  function montar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (js.length < 2) { toast('Precisa de pelo menos 2 pessoas na sala.'); return; }
    H.jogadores = js; H.times = M.montarTimes(js.map(j => j.id)); H.fase = 'times'; publicar();
  }
  function comecar() {
    H.partida++; H.rkId = null; H.rodadas = M.rodadas(H.times); H.k = 0; H.feitas = []; H.usados = [];
    prepararRodada();
  }
  function prepararRodada() {
    const r = rodadaAtual();
    r.nomes = M.sortear(H.cfg.tema || 'futebol', M.POR_RODADA, H.usados); H.usados.push(...r.nomes); r.acertos = []; r.inicio = null; r.tempo = undefined;
    H.fase = 'passe'; sala.limparPrivados(); reenviar(); publicar();
  }
  function acaoHost(msg) {
    const r = rodadaAtual();
    if (!r || msg.de !== r.mimo) return;
    if (msg.tipo === 'comecar' && H.fase === 'passe') { r.inicio = Date.now(); H.fase = 'jogo'; return publicar(); }
    if (H.fase !== 'jogo') return;
    if (msg.tipo === 'acertou') {
      const i = +msg.dados.i;
      if (!(i >= 0 && i < r.nomes.length) || r.acertos.includes(i)) return;
      r.acertos.push(i);
      if (r.acertos.length === r.nomes.length) { r.tempo = Date.now() - r.inicio; return fimRodada(); }
      return publicar();
    }
    if (msg.tipo === 'parar') fimRodada();
  }
  function fimRodada() {
    const r = rodadaAtual(); if (!r || H.fase === 'resultado') return;
    if (r.tempo === undefined) r.tempo = M.TEMPO;
    H.feitas.push({ time: r.time, mimo: r.mimo, adivinha: r.adivinha, nomes: r.nomes, acertos: r.acertos, tempo: r.tempo });
    H.fase = 'resultado'; rel.limpar(); sala.limparPrivados(); publicar();
  }
  function proxima() {
    if (H.k + 1 < H.rodadas.length) { H.k++; return prepararRodada(); }
    H.fase = 'final';
    const pl = M.placar(H.times, H.feitas), top = pl[0];
    const venc = pl.filter(s => s.pct === top.pct && s.acertos === top.acertos && s.tempo === top.tempo).flatMap(s => s.membros);
    window.Ranking && Ranking.registrar(H, 'mimica-sala', H.jogadores.map(j => j.nome), venc.map(nomeId));
    publicar();
  }
  // quem saiu da sala: não faz mais mímica nem adivinha; se era a vez dele, a rodada acaba
  function tirar(xs) {
    xs.forEach(x => {
      const r = rodadaAtual();
      H.rodadas = H.rodadas.filter((q, i) => i <= H.k || q.mimo !== x);
      H.rodadas.forEach((q, i) => { if (i > H.k) q.adivinha = q.adivinha.filter(a => a !== x); });
      if (r && (r.mimo === x || r.adivinha.every(a => a === x))) {
        if (H.fase === 'jogo') return fimRodada();
        if (H.fase === 'passe') { H.usados = H.usados.filter(n => !r.nomes.includes(n)); H.rodadas.splice(H.k, 1); if (H.k >= H.rodadas.length) { H.k--; return proxima(); } return prepararRodada(); }
      }
      publicar();
    });
  }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="mimica.html">Sair</a></div>`;
  const nomeDe = id => (estado.jogadores || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const eu = id => id === sala.id ? `${esc(nomeDe(id))} (você)` : esc(nomeDe(id));
  const lista = ids => ids.map(eu).join(' e ');
  const htmlTimes = times => `<div class="card">${times.map((t, i) => `<p style="margin:8px 0"><strong>Time ${i + 1}:</strong> ${t.map(eu).join(' & ')}${t.length === 3 ? ' <span class="muted small">(trio)</span>' : ''}</p>`).join('')}</div>`;
  const htmlPlacar = () => (estado.placar || []).some(s => s.total) ? `<div class="card"><span class="label">Placar</span>${estado.placar.slice().sort((a, b) => a.ti - b.ti).map(s => `<p style="margin:6px 0">Time ${s.ti + 1}: ${s.membros.map(eu).join(' & ')} — <strong>${s.acertos}</strong><span class="muted small"> de ${s.total}</span></p>`).join('')}</div>` : '';

  function desenhar() {
    Sala.mostrarPrazo(estado && estado.prazo);
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    ({ lobby: telaLobby, times: telaTimes, passe: telaPasse, jogo: telaJogo, resultado: telaResultado, final: telaFinal })[estado.fase]();
  }
  function telaLobby() {
    const tema = (estado.cfg && estado.cfg.tema) || 'futebol';
    render(`${topo('Mímica')}<div class="center" style="margin:6px 0 12px"><div style="font-size:3.5rem">🎭</div></div>
      ${Sala.htmlCodigo(sala.codigo)}${Sala.htmlJogadores(presentes, sala.id)}${Sala.htmlTreino(!!(estado.cfg && estado.cfg.treino), souHost)}
      <div class="card"><span class="label">Tema dos nomes</span>${souHost ? `<div class="chips">${Object.entries(M.TEMAS).map(([k, v]) => `<button type="button" class="chip ${tema === k ? 'on' : ''}" data-tema="${k}">${v}</button>`).join('')}</div>` : `<p style="margin:4px 0 0">${M.TEMAS[tema]}</p>`}</div>
      <div class="card"><p class="small" style="margin:0">Duplas: um faz a mímica, o outro adivinha. Cada rodada tem <strong>1:30</strong> e <strong>3 nomes</strong>, que só aparecem no celular de quem faz a mímica. Na dupla, cada um faz mímica em uma rodada.</p></div>
      ${souHost ? `<button class="btn" id="montar">Montar duplas com ${C.plural(presentes.length, 'pessoa', 'pessoas')}</button>` : '<p class="muted center">O anfitrião vai montar as duplas.</p>'}`);
    Sala.ligarCodigo(sala.codigo);
    if (!souHost) return;
    Sala.ligarTreino(() => { H.cfg.treino = !H.cfg.treino; publicar(); });
    app.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => { H.cfg.tema = b.dataset.tema; publicar(); });
    document.getElementById('montar').onclick = montar;
  }
  function telaTimes() {
    render(`${topo('Mímica')}<div class="center"><div style="font-size:3rem">🎭</div><h2 style="margin:4px 0">Duplas</h2></div>${htmlTimes(estado.times)}
      <p class="muted center small">${C.plural(estado.times.reduce((s, t) => s + t.length, 0), 'rodada', 'rodadas')} de 1:30 · ${M.TEMAS[(estado.cfg && estado.cfg.tema) || 'futebol']}</p>
      ${souHost ? '<button class="btn" id="ir">Começar</button><button class="btn secondary" id="resortear">🔀 Sortear de novo</button><button class="btn secondary" id="manual">✋ Escolher as duplas</button><button class="btn ghost" id="lobby">← Voltar</button>' : '<p class="muted center">O anfitrião vai começar.</p>'}`);
    if (!souHost) return;
    if (manual) return telaManual();
    document.getElementById('manual').onclick = () => { manual = []; telaManual(); };
    document.getElementById('ir').onclick = comecar;
    document.getElementById('resortear').onclick = montar;
    document.getElementById('lobby').onclick = () => { H.fase = 'lobby'; publicar(); };
  }
  // anfitrião escolhe as duplas à mão (só no celular dele; publica quando confirmar)
  function telaManual() {
    const todos = presentes.map(p => p.id);
    manual = manual.filter(id => todos.includes(id));
    render(`${topo('Mímica')}<div class="center"><div style="font-size:3rem">🎭</div><h2 style="margin:4px 0">Escolher as duplas</h2></div>
      ${M.htmlManual(todos, manual, eu)}<button class="btn ghost" id="cancelar">Cancelar</button>`);
    app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const id = b.dataset.pick; manual = manual.includes(id) ? manual.filter(x => x !== id) : manual.concat([id]); telaManual(); });
    document.getElementById('manualLimpar').onclick = () => { manual = []; telaManual(); };
    document.getElementById('cancelar').onclick = () => { manual = null; desenhar(); };
    document.getElementById('manualOk').onclick = () => {
      H.jogadores = presentes.map(p => ({ id: p.id, nome: p.nome })); H.times = M.fecharManual(manual, todos); manual = null; H.fase = 'times'; publicar();
    };
  }
  const meusNomes = () => priv && priv.partida === estado.partida && priv.k === estado.k ? priv.nomes : null;
  function telaPasse() {
    const r = estado.rodada, souMimo = r.mimo === sala.id, nomes = meusNomes();
    const titulo = `Rodada ${estado.k + 1} de ${estado.total}`;
    if (souMimo) return render(`${topo(titulo)}<div class="card center"><span class="label">Sua vez de fazer mímica! Só você vê:</span>
        <p class="muted small" style="margin:4px 0 10px">Para ${lista(r.adivinha)}. Faça na ordem que quiser e toque em ✅ quando acertarem.</p>
        ${nomes ? nomes.map(n => `<div class="big-name" style="font-size:1.6rem;margin:10px 0">${esc(n)}</div>`).join('') : '<p class="muted">Carregando os nomes…</p>'}</div>
        <button class="btn" id="go" ${nomes ? '' : 'disabled'}>▶️ Começar (1:30)</button>`), (document.getElementById('go').onclick = () => sala.enviar('comecar'));
    const adv = r.adivinha.includes(sala.id);
    render(`${topo(titulo)}<div class="pass"><div class="emoji">${adv ? '🙈' : '🎭'}</div>
      <div class="big-name" style="font-size:1.8rem">${eu(r.mimo)}</div><p class="muted">vai fazer mímica para ${lista(r.adivinha)}</p>
      ${adv ? '<p><strong>Você adivinha!</strong> Preste atenção.</p>' : ''}<p class="muted small">Esperando ${esc(nomeDe(r.mimo))} começar…</p></div>${htmlPlacar()}`);
  }
  function telaJogo() {
    const r = estado.rodada, souMimo = r.mimo === sala.id, nomes = meusNomes();
    const titulo = `Rodada ${estado.k + 1} de ${estado.total}`;
    if (souMimo && nomes) {
      render(`${topo(titulo)}<div class="card center"><span class="label">Mímica para ${lista(r.adivinha)}</span><p class="muted small" style="margin:4px 0 0">${r.acertos.length} de ${nomes.length} acertados</p></div>
        ${nomes.map((n, i) => r.acertos.includes(i)
          ? `<div class="card center" style="opacity:.55"><div class="big-name" style="font-size:1.5rem;text-decoration:line-through">${esc(n)}</div><div class="small">✅ acertou</div></div>`
          : `<div class="card center"><div class="big-name" style="font-size:1.6rem">${esc(n)}</div><button class="btn" data-ac="${i}" style="margin-top:8px">✅ Acertou</button></div>`).join('')}
        <button class="btn ghost" id="parar">⏹️ Encerrar a rodada</button>`);
      app.querySelectorAll('[data-ac]').forEach(b => b.onclick = () => { b.disabled = true; sala.enviar('acertou', { i: +b.dataset.ac }); });
      document.getElementById('parar').onclick = () => { if (confirm('Encerrar a rodada agora?')) sala.enviar('parar'); };
      return;
    }
    const adv = r.adivinha.includes(sala.id);
    render(`${topo(titulo)}<div class="pass"><div class="emoji">${adv ? '🤔' : '🎭'}</div>
      <p class="muted" style="margin:0">${eu(r.mimo)} faz mímica para ${lista(r.adivinha)}</p>
      ${adv ? '<div class="big-name" style="font-size:1.8rem">Adivinhe!</div>' : ''}
      <p style="margin:10px 0 4px"><strong>${r.acertos.length} de ${M.POR_RODADA}</strong> acertados</p>
      ${r.acertados.map(n => `<div class="big-name" style="font-size:1.4rem;margin:6px 0">✅ ${esc(n)}</div>`).join('')}
      ${Array.from({ length: M.POR_RODADA - r.acertos.length }, () => '<div class="big-name muted" style="font-size:1.4rem;margin:6px 0">❓ ? ? ?</div>').join('')}</div>${htmlPlacar()}`);
  }
  function telaResultado() {
    const r = estado.rodada, ultima = estado.k + 1 >= estado.total;
    render(`${topo(`Rodada ${estado.k + 1} de ${estado.total}`)}<div class="pass"><div class="emoji">${r.acertos.length === 3 ? '🎉' : r.acertos.length ? '👏' : '😅'}</div>
      <div class="big-name" style="font-size:1.8rem">${r.acertos.length} de ${M.POR_RODADA}</div>
      <p class="muted">${eu(r.mimo)} → ${lista(r.adivinha)}${r.acertos.length === 3 ? ` · em ${M.fmt(r.tempo)}` : ''}</p></div>
      <div class="card">${(r.nomes || []).map((n, i) => `<p style="margin:6px 0">${r.acertos.includes(i) ? '✅' : '❌'} <strong>${esc(n)}</strong></p>`).join('')}</div>
      ${htmlPlacar()}
      ${souHost ? `<button class="btn" id="prox">${ultima ? '🏆 Ver resultado' : 'Próxima rodada'}</button>` : '<p class="muted center">O anfitrião passa para a próxima rodada.</p>'}`);
    if (souHost) document.getElementById('prox').onclick = proxima;
  }
  function telaFinal() {
    const pl = estado.placar, top = pl[0];
    const venc = pl.filter(s => s.pct === top.pct && s.acertos === top.acertos && s.tempo === top.tempo);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">Venceu</p>
      <h1 class="logo" style="font-size:2rem">${venc.map(s => s.membros.map(id => esc(nomeDe(id))).join(' & ')).join('<br>')}</h1></div>
      <div class="card"><span class="label">Placar final</span>${pl.map((s, i) => `<p style="margin:8px 0">${i + 1}º · <strong>${s.membros.map(eu).join(' & ')}</strong> — ${s.acertos} de ${s.total}<span class="muted small"> · tempo médio ${M.fmt(s.tempo)}</span></p>`).join('')}</div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida (novas duplas)</button><button class="btn secondary" id="mesmas">Nova partida (mesmas duplas)</button>' : ''}<a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    if (!souHost) return;
    document.getElementById('denovo').onclick = montar;
    document.getElementById('mesmas').onclick = () => { H.fase = 'times'; publicar(); };
  }
})();
