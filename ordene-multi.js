// Ordene a Carreira — vários celulares. Todos ordenam o mesmo jogador no próprio celular.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const JOGO = 'ordene';
  const render = html => { app.innerHTML = html; };
  let sala = null, souHost = false, estado = null, presentes = [], H = null;
  let ordem = [], rodadaOrdem = null, enviado = null;

  Sala.telaEntrada(app, 'Ordene a Carreira', 'ordene.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    const iniciarH = () => { H = Sala.carregarHost(JOGO, codigo) || { cfg: { pool: 'famosos', rodadas: 5 }, fase: 'lobby', vistos: [] }; };
    if (souHost) iniciarH();
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { const k = e.rodada + ':' + (e.alvo ? e.alvo.nome : ''); if (estado && e.trocas > (estado.trocas || 0) && e.aviso) toast('🔄 ' + e.aviso); if (k !== rodadaOrdem) { ordem = []; rodadaOrdem = k; enviado = null; } estado = e; desenhar(); },
      onAcao: acaoHost, snapshot: () => H,
      onVirarHost: h => { if (h) Sala.salvarHost(JOGO, codigo, h); souHost = true; iniciarH(); app.innerHTML = ''; toast('👑 O anfitrião saiu. Agora você é o anfitrião da sala.'); publicar(); },
      onDeixarHost: () => { souHost = false; const b = document.getElementById('barraAusentes'); if (b) b.remove(); },
      onPresenca: l => { presentes = l; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) publicar(); else if (!estado) desenhar(); } }
    });
  });

  // ---------- anfitrião ----------
  function publico() {
    const a = H.alvoId ? F.porId[H.alvoId] : null, rev = H.fase === 'revelado' || H.fase === 'final';
    return {
      fase: H.fase, cfg: H.cfg, trocas: H.trocas || 0, aviso: H.aviso || '', rodada: H.rodada, jogadores: H.jogadores || [], placar: H.placar || {},
      alvo: a ? { nome: a.nome, pos: F.descPos(a), ano: a.ano, n: a.car.length } : null,
      embaralhado: H.embaralhado || [], enviaram: Object.fromEntries(Object.keys(H.resp || {}).map(k => [k, true])),
      certo: rev && a ? a.car.map(c => ({ nome: c.nome, anos: F.anos(c) })) : null,
      respostas: rev ? H.resp : null, resultado: rev ? H.resultado : null
    };
  }
  function publicar() { Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); }
  function iniciar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (!js.length) return;
    H.jogadores = js; H.rkId = null; H.placar = Object.fromEntries(js.map(j => [j.id, 0])); H.rodada = 0; H.usados = [];
    novaRodada();
  }
  function novaRodada(trocar) {
    if (!trocar) H.rodada++;
    let pool = F.poolCarreira(H.cfg.pool).filter(j => j.car.length <= 9 && !H.vistos.includes(j.id) && !H.usados.includes(j.id));
    if (!pool.length) { H.vistos = []; pool = F.poolCarreira(H.cfg.pool).filter(j => j.car.length <= 9 && !H.usados.includes(j.id)); }
    const j = pool[Math.floor(Math.random() * pool.length)];
    H.alvoId = j.id; H.usados.push(j.id); H.vistos.push(j.id);
    const certo = j.car.map(c => c.nome);
    let emb = C.shuffle(certo.slice());
    if (emb.every((n, i) => n === certo[i]) && certo.length > 1) emb.reverse();
    H.embaralhado = emb; H.resp = {}; H.resultado = null; H.fase = 'ordenar';
    publicar();
  }
  function acaoHost(msg) {
    if (msg.tipo === 'trocarJogador' && H.fase === 'ordenar' && H.jogadores.some(j => j.id === msg.de)) { H.trocas = (H.trocas || 0) + 1; H.aviso = `${(H.jogadores.find(j => j.id === msg.de) || {}).nome || 'Alguém'} trocou o jogador.`; return novaRodada(true); }
    if (msg.tipo !== 'ordem' || H.fase !== 'ordenar' || !H.jogadores.some(j => j.id === msg.de)) return;
    const o = msg.dados.ordem;
    if (!Array.isArray(o) || o.length !== H.embaralhado.length) return;
    H.resp[msg.de] = o.map(k => H.embaralhado[k]);
    if (H.jogadores.every(j => H.resp[j.id])) revelar(); else publicar();
  }
  function revelar() {
    const certo = F.porId[H.alvoId].car.map(c => c.nome);
    H.resultado = {};
    Object.entries(H.resp).forEach(([id, r]) => {
      const ac = r.filter((n, i) => n === certo[i]).length, pts = ac + (ac === certo.length ? 3 : 0);
      H.resultado[id] = { ac, pts }; H.placar[id] += pts;
    });
    H.fase = 'revelado'; publicar();
  }
  function proxima() { if (H.rodada >= H.cfg.rodadas) { H.fase = 'final'; publicar(); } else novaRodada(); }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="ordene.html">Sair</a></div>`;
  const nomeDe = id => (estado.jogadores || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const placar = () => `<table class="score">${Object.entries(estado.placar).sort((a, b) => b[1] - a[1]).map(([id, v]) => `<tr><td>${esc(nomeDe(id))}${id === sala.id ? ' <span class="muted small">(você)</span>' : ''}</td><td>${C.plural(v, 'pt')}</td></tr>`).join('')}</table>`;
  function desenhar() {
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    ({ lobby: telaLobby, ordenar: telaOrdenar, revelado: telaRevelado, final: telaFinal })[estado.fase]();
  }
  function telaLobby() {
    const cfg = estado.cfg;
    render(`${topo('Ordene a Carreira')}${Sala.htmlCodigo(sala.codigo)}${Sala.htmlJogadores(presentes, sala.id)}${Sala.htmlTreino(!!(estado.cfg && estado.cfg.treino), souHost)}
      ${souHost ? `<div class="card"><span class="label">Jogadores sorteados</span>
          ${Object.entries(F.POOLS).map(([k, v]) => `<button class="list-opt ${cfg.pool === k ? 'on' : ''}" data-pool="${k}"><strong>${esc(v.nome)}</strong></button>`).join('')}
          <span class="label" style="margin-top:12px">Rodadas</span><div class="chips">${[3, 5, 10, 15].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}</div></div>
        <button class="btn" id="comecar">Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>` : '<p class="muted center">O anfitrião vai começar.</p>'}`);
    Sala.ligarCodigo(sala.codigo);
    if (souHost) Sala.ligarTreino(() => { H.cfg.treino = !H.cfg.treino; publicar(); });
    if (!souHost) return;
    app.querySelectorAll('[data-pool]').forEach(b => b.onclick = () => { H.cfg.pool = b.dataset.pool; publicar(); });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { H.cfg.rodadas = +b.dataset.rod; publicar(); });
    document.getElementById('comecar').onclick = iniciar;
  }
  const cartao = () => `<div class="card center"><div class="muted small">Ordene a carreira de</div><div class="question" style="font-size:1.6rem">${esc(estado.alvo.nome)}</div><div class="muted small">${esc(estado.alvo.pos)}${estado.alvo.ano ? ' · nascido em ' + estado.alvo.ano : ''} · ${estado.alvo.n} passagens</div></div>`;
  const status = () => `<div class="chips" style="justify-content:center;margin:12px 0">${estado.jogadores.map(j => `<span class="chip ${estado.enviaram[j.id] ? 'on' : ''}">${estado.enviaram[j.id] ? '✅' : '⏳'} ${esc(j.nome)}</span>`).join('')}</div>`;
  function telaOrdenar() {
    const eu = estado.jogadores.some(j => j.id === sala.id), ja = estado.enviaram[sala.id] || enviado;
    const n = Object.keys(estado.enviaram).length;
    render(`${topo(`Rodada ${estado.rodada}/${estado.cfg.rodadas}`)}${cartao()}
      ${!eu ? '<p class="muted center">Você está assistindo.</p>' : ja ? '<div class="card center muted">Ordem enviada. Aguardando os outros…</div>' : `
        <div class="card"><span class="label">Toque nos clubes na ordem (do primeiro ao último)</span>
          <div>${estado.embaralhado.map((c, k) => `<button class="chip-club ${ordem.includes(k) ? 'usado' : ''}" data-k="${k}">${esc(c)}</button>`).join('')}</div></div>
        <div class="card"><span class="label">Sua ordem</span><ol class="car-list">${ordem.map((k, i) => `<li><span class="n">${i + 1}</span><strong>${esc(estado.embaralhado[k])}</strong></li>`).join('') || '<li class="muted">Nenhum clube ainda</li>'}</ol>
          <div class="row" style="margin-top:10px"><button class="btn secondary small" id="desfazer" ${ordem.length ? '' : 'disabled'}>↩ Desfazer</button><button class="btn secondary small" id="limpar" ${ordem.length ? '' : 'disabled'}>Limpar</button></div></div>
        <button class="btn" id="ok" ${ordem.length === estado.embaralhado.length ? '' : 'disabled'}>Confirmar ordem</button>`}
      ${status()}
      ${eu ? '<button class="btn ghost" id="trocarJog">🔄 Não conheço, trocar jogador</button>' : ''}
      ${souHost ? `<button class="btn secondary" id="revelar" ${n ? '' : 'disabled'}>Revelar agora (${n}/${estado.jogadores.length})</button>` : ''}`);
    const r = document.getElementById('revelar'); if (r) r.onclick = revelar;
    const tj = document.getElementById('trocarJog'); if (tj) tj.onclick = () => { if (Object.keys(estado.enviaram).length && !confirm('Trocar o jogador? Quem já enviou vai ordenar de novo.')) return; sala.enviar('trocarJogador'); };
    if (!eu || ja) return;
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { ordem.push(+b.dataset.k); telaOrdenar(); });
    document.getElementById('desfazer').onclick = () => { ordem.pop(); telaOrdenar(); };
    document.getElementById('limpar').onclick = () => { ordem = []; telaOrdenar(); };
    document.getElementById('ok').onclick = () => { enviado = true; sala.enviar('ordem', { ordem }); telaOrdenar(); };
  }
  function telaRevelado() {
    render(`${topo(`Rodada ${estado.rodada}/${estado.cfg.rodadas}`)}
      <div class="card"><span class="label">Ordem certa · ${esc(estado.alvo.nome)}</span><ol class="car-list">${estado.certo.map((c, i) => `<li><span class="n">${i + 1}</span><strong>${esc(c.nome)}</strong><span class="anos">${esc(c.anos)}</span></li>`).join('')}</ol></div>
      ${Object.entries(estado.respostas).map(([id, r]) => { const res = estado.resultado[id]; return `<div class="card"><span class="label">${esc(nomeDe(id))} · ${res.ac}/${estado.certo.length} ${res.ac === estado.certo.length ? '🎯 PERFEITO (+3)' : ''} · +${res.pts}</span>
        <div class="said">${r.map((n, i) => `<span class="said-item ${n === estado.certo[i].nome ? 'ok' : 'miss'}">${i + 1}. ${esc(n)}</span>`).join('')}</div></div>`; }).join('')}
      <div class="card"><span class="label">Placar</span>${placar()}</div>
      ${souHost ? `<button class="btn" id="prox">${estado.rodada >= estado.cfg.rodadas ? '🏆 Ver campeão' : 'Próximo jogador'}</button>` : '<p class="muted center">Aguardando o anfitrião…</p>'}`);
    if (souHost) document.getElementById('prox').onclick = proxima;
  }
  function telaFinal() {
    const rank = Object.entries(estado.placar).map(([id, v]) => [nomeDe(id), v]).sort((a, b) => b[1] - a[1]);
    const camp = rank.filter(x => x[1] === rank[0][1]).map(x => x[0]);
    if (souHost) window.Ranking && Ranking.registrar(H, 'ordene-sala', estado.jogadores.map(j => j.nome), camp);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${camp.length > 1 ? 'Empate!' : 'Campeão'}</p><h1 class="logo" style="font-size:2.3rem">${camp.map(esc).join(' & ')}</h1></div>
      ${C.htmlPodio(rank)}<div class="card"><span class="label">Classificação</span>${placar()}</div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : ''}<a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    if (souHost) document.getElementById('denovo').onclick = () => { H.fase = 'lobby'; publicar(); };
  }
})();
