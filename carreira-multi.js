// De Quem É a Carreira? — vários celulares. Todos chutam ao mesmo tempo a cada clube revelado.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const JOGO = 'carreira';
  const render = html => { app.innerHTML = html; };
  let meusChutes = [];
  let meuChute = null; // resultado do meu próprio chute (só eu vejo até o clube fechar)
  let sala = null, souHost = false, estado = null, presentes = [], H = null;

  Sala.telaEntrada(app, 'De Quem É a Carreira?', 'carreira.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    if (souHost) H = Sala.carregarHost(JOGO, codigo) || { cfg: { pool: 'famosos', rodadas: 5 }, fase: 'lobby', vistos: [] };
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { estado = e; desenhar(); },
      onPrivado: d => { if (d && d.aviso) toast(d.aviso); if (d && d.chute) { meuChute = d.chute; if (!meusChutes.some(x => x.rodada === d.chute.rodada && x.passo === d.chute.passo)) meusChutes.push(d.chute); desenhar(); } },
      onAcao: souHost ? acaoHost : null,
      onPresenca: l => { presentes = l; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) publicar(); else if (!estado) desenhar(); } }
    });
  });

  // ---------- anfitrião ----------
  const alvo = () => F.porId[H.alvoId];
  function publico() {
    const a = H.alvoId ? alvo() : null, fim = H.fase !== 'jogo';
    // o que acontece no clube atual só aparece para os outros quando o clube fecha
    const fechado = p => fim || p < H.passo;
    const placar = { ...(H.placar || {}) };
    if (!fim && a) Object.entries(H.acertou || {}).forEach(([id, p]) => { if (!fechado(p)) placar[id] -= a.car.length - p + 1; });
    return {
      fase: H.fase, cfg: H.cfg, rodada: H.rodada, jogadores: H.jogadores || [], placar,
      passo: H.passo, N: a ? a.car.length : 0,
      clubes: a ? a.car.slice(0, fim ? a.car.length : H.passo).map(c => ({ nome: c.nome, anos: F.anos(c) })) : [],
      acertou: Object.fromEntries(Object.entries(H.acertou || {}).filter(([, p]) => fechado(p))), responderam: Object.fromEntries(Object.keys(H.resp || {}).map(k => [k, true])),
      chutes: (H.chutes || []).filter(c => fechado(c.passo)).map(c => ({ quem: c.quem, passo: c.passo, ok: c.ok, passou: c.passou, nome: c.ok ? null : c.nome })),
      revelado: fim && a ? { nome: a.nome, pos: F.descPos(a), ano: a.ano, sel: a.sel } : null
    };
  }
  function publicar() { Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); }
  function iniciar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (!js.length) return;
    H.jogadores = js; H.rkId = null; H.placar = Object.fromEntries(js.map(j => [j.id, 0])); H.rodada = 0; H.usados = [];
    novaRodada();
  }
  function novaRodada() {
    H.rodada++;
    let pool = F.poolCarreira(H.cfg.pool).filter(j => !H.vistos.includes(j.id) && !H.usados.includes(j.id));
    if (!pool.length) { H.vistos = []; pool = F.poolCarreira(H.cfg.pool).filter(j => !H.usados.includes(j.id)); }
    const j = pool[Math.floor(Math.random() * pool.length)];
    H.alvoId = j.id; H.usados.push(j.id); H.vistos.push(j.id);
    H.passo = 1; H.acertou = {}; H.resp = {}; H.chutes = []; H.fase = 'jogo';
    publicar();
  }
  const pendentes = () => H.jogadores.filter(j => !H.acertou[j.id]);
  function acaoHost(msg) {
    if (H.fase !== 'jogo' || !H.jogadores.some(j => j.id === msg.de) || H.acertou[msg.de] || H.resp[msg.de]) return;
    const N = alvo().car.length;
    if (msg.tipo === 'chute') {
      const j = F.porId[msg.dados.id]; if (!j) return;
      const ok = j.id === H.alvoId;
      H.chutes.push({ quem: msg.de, passo: H.passo, nome: j.nome, ok });
      H.resp[msg.de] = true;
      if (ok) { H.acertou[msg.de] = H.passo; H.placar[msg.de] += N - H.passo + 1; }
      sala.privado(msg.de, { chute: { rodada: H.rodada, passo: H.passo, ok, nome: j.nome }, t: Date.now() });
    } else if (msg.tipo === 'passar') { H.chutes.push({ quem: msg.de, passo: H.passo, passou: true }); H.resp[msg.de] = true; }
    else return;
    checar();
  }
  function checar() {
    const N = alvo().car.length;
    if (!pendentes().length) { H.fase = 'fimRodada'; return publicar(); }
    if (pendentes().every(j => H.resp[j.id])) {
      if (H.passo >= N) { H.fase = 'fimRodada'; return publicar(); }
      H.passo++; H.resp = {};
    }
    publicar();
  }
  function forcarProximo() { const N = alvo().car.length; if (H.passo >= N) H.fase = 'fimRodada'; else { H.passo++; H.resp = {}; } publicar(); }
  function proxima() { if (H.rodada >= H.cfg.rodadas) { H.fase = 'final'; publicar(); } else novaRodada(); }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="carreira.html">Sair</a></div>`;
  const nomeDe = id => (estado.jogadores || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  function desenhar() {
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    ({ lobby: telaLobby, jogo: telaJogo, fimRodada: telaFimRodada, final: telaFinal })[estado.fase]();
  }
  function telaLobby() {
    const cfg = estado.cfg;
    render(`${topo('Carreira')}${Sala.htmlCodigo(sala.codigo)}${Sala.htmlJogadores(presentes, sala.id)}
      ${souHost ? `<div class="card"><span class="label">Jogadores sorteados</span>
          ${Object.entries(F.POOLS).map(([k, v]) => `<button class="list-opt ${cfg.pool === k ? 'on' : ''}" data-pool="${k}"><strong>${esc(v.nome)}</strong></button>`).join('')}
          <span class="label" style="margin-top:12px">Rodadas</span><div class="chips">${[3, 5, 10, 15].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}</div></div>
        <button class="btn" id="comecar">Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>` : '<p class="muted center">O anfitrião vai começar.</p>'}`);
    Sala.ligarCodigo(sala.codigo);
    if (!souHost) return;
    app.querySelectorAll('[data-pool]').forEach(b => b.onclick = () => { H.cfg.pool = b.dataset.pool; publicar(); });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { H.cfg.rodadas = +b.dataset.rod; publicar(); });
    document.getElementById('comecar').onclick = iniciar;
  }
  const lista = (mostrarTudo) => `<ol class="car-list">${estado.clubes.map((c, i) => `<li><span class="n">${i + 1}</span><strong>${esc(c.nome)}</strong><span class="anos">${esc(c.anos)}</span></li>`).join('')}
    ${!mostrarTudo && estado.clubes.length < estado.N ? `<li class="muted"><span class="n">?</span>mais ${estado.N - estado.clubes.length} clube(s)…</li>` : ''}</ol>`;
  const placar = () => `<table class="score">${Object.entries(estado.placar).sort((a, b) => b[1] - a[1]).map(([id, v]) => `<tr><td>${esc(nomeDe(id))}${id === sala.id ? ' <span class="muted small">(você)</span>' : ''}</td><td>${C.plural(v, 'pt')}</td></tr>`).join('')}</table>`;

  function telaJogo() {
    const eu = estado.jogadores.some(j => j.id === sala.id);
    const meu = meuChute && meuChute.rodada === estado.rodada ? meuChute : null;
    const acertei = estado.acertou[sala.id] || (meu && meu.ok ? meu.passo : null), respondi = estado.responderam[sala.id];
    const errei = !acertei && respondi && meu && meu.passo === estado.passo && !meu.ok ? meu.nome : null;
    const doPasso = estado.chutes;
    if (document.getElementById('busca') && eu && !acertei && !respondi && document.getElementById('passoAtual')?.dataset.p == estado.rodada + '-' + estado.passo) {
      const st = document.getElementById('statusBox'); if (st) st.innerHTML = statusHtml(doPasso);
      const hb = document.getElementById('histBox'); if (hb) hb.innerHTML = hist(); return;
    }
    render(`${topo(`Rodada ${estado.rodada}/${estado.cfg.rodadas} · clube ${estado.passo}/${estado.N}`)}<span id="passoAtual" data-p="${estado.rodada}-${estado.passo}"></span>
      <div class="card"><span class="label">A carreira</span>${lista(false)}</div>
      <div id="histBox">${hist()}</div>
      ${!eu ? '<p class="muted center">Você está assistindo.</p>' : acertei ? `<div class="card center">✅ Você acertou no ${acertei}º clube! Aguardando os outros…</div>` : respondi ? `<div class="card center muted">${errei ? `❌ Não é ${esc(errei)}. ` : ''}Aguardando os outros…</div>` : `
        <div class="card"><p style="margin:0 0 8px"><strong>De quem é essa carreira?</strong> <span class="muted small">(vale ${estado.N - estado.passo + 1} pts)</span></p>
          ${F.htmlBusca('busca')}<button class="btn" id="chutar" disabled>Chutar</button><button class="btn ghost" id="passar">Passar (esperar mais um clube)</button></div>`}
      <div id="statusBox">${statusHtml(doPasso)}</div>
      ${souHost ? '<button class="btn ghost" id="forcar">Mostrar próximo clube agora</button>' : ''}
      <div class="card"><span class="label">Placar</span>${placar()}</div>`);
    const f = document.getElementById('forcar'); if (f) f.onclick = forcarProximo;
    if (!eu || acertei || respondi) return;
    let esc_ = null; const bt = document.getElementById('chutar');
    F.ligarBusca('busca', j => { esc_ = j; bt.disabled = !j; });
    bt.onclick = () => sala.enviar('chute', { id: esc_.id });
    document.getElementById('passar').onclick = () => sala.enviar('passar');
  }
  const statusHtml = doPasso => `<div class="chips" style="justify-content:center;margin:10px 0">${estado.jogadores.map(j => {
      const a = estado.acertou[j.id], r = estado.responderam[j.id];
      return `<span class="chip ${a || r ? 'on' : ''}">${a ? '✅' : r ? '🕐' : '⏳'} ${esc(j.nome)}</span>`;
    }).join('')}</div>
`;
  // histórico: clubes já fechados (de todos) + meu chute no clube aberto (só eu vejo)
  const hist = () => {
    const meus = meusChutes.filter(c => c.rodada === estado.rodada && c.passo === estado.passo && estado.fase === 'jogo').map(c => ({ quem: sala.id, passo: c.passo, ok: c.ok, nome: c.nome, meu: true }));
    return F.htmlHistChutes([...estado.chutes, ...meus], nomeDe);
  };

  function telaFimRodada() {
    const r = estado.revelado;
    render(`${topo(`Rodada ${estado.rodada}/${estado.cfg.rodadas}`)}
      <div class="card center"><div class="muted small">Era</div><div class="question" style="font-size:1.8rem">${esc(r.nome)}</div><div class="muted small">${esc(r.pos)}${r.ano ? ' · nascido em ' + r.ano : ''}${r.sel ? ' · ' + esc(r.sel) : ''}</div></div>
      <div class="card"><span class="label">Carreira completa</span>${lista(true)}</div>
      ${F.htmlHistChutes(estado.chutes, nomeDe, 'Chutes da rodada')}
      <div class="card"><span class="label">Quem acertou</span>${estado.jogadores.map(j => `<p class="small" style="margin:4px 0">${esc(j.nome)}: ${estado.acertou[j.id] ? `✅ no ${estado.acertou[j.id]}º clube (+${estado.N - estado.acertou[j.id] + 1})` : '❌'}</p>`).join('')}</div>
      <div class="card"><span class="label">Placar</span>${placar()}</div>
      ${souHost ? `<button class="btn" id="prox">${estado.rodada >= estado.cfg.rodadas ? '🏆 Ver campeão' : 'Próximo jogador'}</button>` : '<p class="muted center">Aguardando o anfitrião…</p>'}`);
    if (souHost) document.getElementById('prox').onclick = proxima;
  }
  function telaFinal() {
    const rank = Object.entries(estado.placar).map(([id, v]) => [nomeDe(id), v]).sort((a, b) => b[1] - a[1]);
    const camp = rank.filter(x => x[1] === rank[0][1]).map(x => x[0]);
    if (souHost) window.Ranking && Ranking.registrar(H, 'carreira-sala', estado.jogadores.map(j => j.nome), camp);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${camp.length > 1 ? 'Empate!' : 'Campeão'}</p><h1 class="logo" style="font-size:2.3rem">${camp.map(esc).join(' & ')}</h1></div>
      ${C.htmlPodio(rank)}<div class="card"><span class="label">Classificação</span>${placar()}</div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : ''}<a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    if (souHost) document.getElementById('denovo').onclick = () => { H.fase = 'lobby'; publicar(); };
  }
})();
