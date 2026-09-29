// Monta o Time — vários celulares. Cada um escolhe no próprio celular; o anfitrião revela a rodada.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const JOGO = 'montatime';
  const render = html => { app.innerHTML = html; };
  let sala = null, souHost = false, estado = null, presentes = [], H = null;
  let minha = null, rodadaMinha = null; // escolha local enquanto espera

  Sala.telaEntrada(app, 'Monta o Time', 'montatime.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    const iniciarH = () => { H = Sala.carregarHost(JOGO, codigo) || { cfg: { crit: 'alto', grupos: F.GRUPOS_PADRAO.slice() }, fase: 'lobby' }; };
    if (souHost) iniciarH();
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { if (estado && e.trocas > (estado.trocas || 0) && e.aviso) toast('🔄 ' + e.aviso); estado = e; if (e.rodada !== rodadaMinha) minha = null; desenhar(); },
      onPrivado: d => { if (d && d.aviso) toast(d.aviso); },
      onAcao: acaoHost, snapshot: () => H,
      onVirarHost: h => { if (h) Sala.salvarHost(JOGO, codigo, h); souHost = true; iniciarH(); app.innerHTML = ''; toast('👑 O anfitrião saiu. Agora você é o anfitrião da sala.'); publicar(); },
      onDeixarHost: () => { souHost = false; const b = document.getElementById('barraAusentes'); if (b) b.remove(); },
      onPresenca: l => { presentes = l; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) publicar(); else if (!estado) desenhar(); } }
    });
  });

  // ---------- anfitrião ----------
  const nomeId = id => (H.jogadores || []).find(j => j.id === id)?.nome || '?';
  const crit = () => F.criterio(H.critId || H.cfg.crit) || F.CRITERIOS[0];
  function publico() {
    return {
      fase: H.fase, cfg: H.cfg, critId: H.critId, rodada: H.rodada, total: 7, jogadores: H.jogadores || [],
      tema: H.tema ? { nome: H.tema.nome } : null, temaId: H.temaId, ocupados: ocupados(), trocas: H.trocas || 0, aviso: H.aviso || '', times: H.times || {}, escolheu: Object.fromEntries(Object.keys(H.escolhas || {}).map(k => [k, true])),
      revelacao: H.fase === 'revelado' || H.fase === 'final' ? H.revelacao : null, historico: H.fase === 'final' ? H.historico : null
    };
  }
  function publicar() { Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); }
  function sortearTema() {
    const c = crit();
    const pool = F.TEMAS.filter(t => H.cfg.grupos.includes(t.grupo) && !H.usados.includes(t.id) && F.temaValido(t, c));
    const pool2 = F.TEMAS.filter(t => H.cfg.grupos.includes(t.grupo) && t.id !== H.temaId && F.temaValido(t, c));
    const base = pool.length ? pool : pool2.length ? pool2 : F.TEMAS.filter(t => F.temaValido(t, c));
    const t = base[Math.floor(Math.random() * base.length)];
    H.usados.push(t.id); return t;
  }
  function iniciar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (js.length < 2) { toast('Precisa de pelo menos 2 pessoas.'); return; }
    H.critId = H.cfg.crit === 'sortear' ? F.CRITERIOS[Math.floor(Math.random() * F.CRITERIOS.length)].id : H.cfg.crit;
    H.jogadores = js; H.rkId = null; H.times = Object.fromEntries(js.map(j => [j.id, {}])); H.rodada = 0; H.usados = []; H.historico = [];
    novaRodada();
  }
  function novaRodada() { H.rodada++; H.escolhas = {}; H.revelacao = null; H.tema = sortearTema(); H.temaId = H.tema.id; H.fase = 'escolha'; publicar(); }
  // jogadores já usados na partida: nos times ou confirmados nesta rodada (id -> dono)
  function ocupados() {
    const o = {};
    Object.entries(H.times || {}).forEach(([pid, t]) => Object.values(t).forEach(s => { if (s) o[s.id] = pid; }));
    Object.entries(H.escolhas || {}).forEach(([pid, e]) => { o[e.id] = pid; });
    return o;
  }
  function temaAtual() { if (!H.tema || !H.tema.test) H.tema = F.TEMAS.find(t => t.id === H.temaId); return H.tema; }
  function acaoHost(msg) {
    if (msg.tipo === 'trocarTema' && H.times[msg.de]) return trocarTema(msg.de);
    if (msg.tipo === 'escolha' && H.fase === 'escolha' && H.times[msg.de]) {
      const j = F.porId[msg.dados.id], slot = msg.dados.slot, time = H.times[msg.de];
      const s = F.SLOTS.find(x => x.k === slot);
      if (!j || !s || time[slot] || !F.encaixa(j, s.g) || Object.values(time).some(x => x && x.id === j.id) || F.motivoInvalido(j, temaAtual(), crit())) { sala.privado(msg.de, { aviso: 'Escolha inválida, tente de novo.', t: Date.now() }); return; }
      const dono = ocupados()[j.id];
      if (dono && dono !== msg.de) { sala.privado(msg.de, { aviso: `${j.nome} já está no time de ${nomeId(dono)}. Escolha outro jogador.`, t: Date.now() }); return; }
      H.escolhas[msg.de] = { id: j.id, slot };
      publicar();
    }
  }
  function revelar() {
    const t = temaAtual(), c = crit();
    H.revelacao = H.jogadores.filter(p => H.escolhas[p.id]).map(p => {
      const e = H.escolhas[p.id], j = F.porId[e.id], r = F.pontuar(j, t, c);
      H.times[p.id][e.slot] = { id: j.id, nome: j.nome, v: r.v, ok: r.ok };
      return { quem: p.id, jogador: j.nome, slot: e.slot, ok: r.ok, v: r.v, motivo: r.motivo };
    });
    H.historico.push({ tema: t.nome, linhas: H.revelacao.map(l => ({ nome: nomeId(l.quem), jogador: l.jogador, ok: l.ok })) });
    H.fase = 'revelado'; publicar();
  }
  function proxima() { if (H.rodada >= 7) { H.fase = 'final'; publicar(); } else novaRodada(); }
  // qualquer um pode trocar o tema da rodada; quem já tinha escolhido escolhe de novo
  function trocarTema(quem) {
    if (H.fase !== 'escolha') return;
    const ja = Object.keys(H.escolhas).length;
    H.tema = sortearTema(); H.temaId = H.tema.id; H.escolhas = {}; H.trocas = (H.trocas || 0) + 1;
    H.aviso = `${quem ? nomeId(quem) : 'Alguém'} trocou o tema${ja ? ' — escolham de novo' : ''}.`;
    publicar();
  }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="montatime.html">Sair</a></div>`;
  const nomeDe = id => (estado.jogadores || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const C_ = () => F.criterio(estado.critId || estado.cfg.crit) || F.CRITERIOS[0];
  function desenhar() {
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    ({ lobby: telaLobby, escolha: telaEscolha, revelado: telaRevelado, final: telaFinal })[estado.fase]();
  }
  function telaLobby() {
    const cfg = estado.cfg;
    render(`${topo('Monta o Time')}${Sala.htmlCodigo(sala.codigo)}${Sala.htmlJogadores(presentes, sala.id)}${Sala.htmlTreino(!!(estado.cfg && estado.cfg.treino), souHost)}
      ${souHost ? `<div class="card"><span class="label">Critério da partida</span>
          <button class="list-opt ${cfg.crit === 'sortear' ? 'on' : ''}" data-crit="sortear"><strong>🎲 Sortear</strong></button>
          ${F.CRITERIOS.map(c => `<button class="list-opt ${cfg.crit === c.id ? 'on' : ''}" data-crit="${c.id}"><strong>${esc(c.nome)}</strong><span class="muted small">${esc(c.desc)}</span></button>`).join('')}</div>
        <div class="card"><span class="label">Tipos de tema</span><div class="chips">${F.GRUPOS_TEMA.map(gp => `<button class="chip ${cfg.grupos.includes(gp) ? 'on' : ''}" data-gp="${gp}">${gp}</button>`).join('')}</div><p class="muted small" style="margin:10px 0 0">“Mais clubes” = clubes menos conhecidos, começa desligado. Durante a rodada qualquer um pode trocar o tema.</p></div>
        <button class="btn" id="comecar" ${presentes.length >= 2 ? '' : 'disabled'}>Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>`
        : '<p class="muted center">O anfitrião escolhe o critério e começa.</p>'}`);
    Sala.ligarCodigo(sala.codigo);
    if (souHost) Sala.ligarTreino(() => { H.cfg.treino = !H.cfg.treino; publicar(); });
    if (!souHost) return;
    app.querySelectorAll('[data-crit]').forEach(b => b.onclick = () => { H.cfg.crit = b.dataset.crit; publicar(); });
    app.querySelectorAll('[data-gp]').forEach(b => b.onclick = () => { const g = b.dataset.gp; H.cfg.grupos = H.cfg.grupos.includes(g) ? H.cfg.grupos.filter(x => x !== g) : [...H.cfg.grupos, g]; if (!H.cfg.grupos.length) H.cfg.grupos = [g]; publicar(); });
    document.getElementById('comecar').onclick = iniciar;
  }
  const cartaoTema = () => `<div class="card center"><div class="muted small">Tema da rodada ${estado.rodada}/7</div><div class="question" style="font-size:1.4rem">${esc(estado.tema.nome)}</div><div class="muted small">${esc(C_().nome)} · ${esc(C_().desc)}</div></div>`;
  const status = () => `<div class="chips" style="justify-content:center;margin:12px 0">${estado.jogadores.map(j => `<span class="chip ${estado.escolheu[j.id] ? 'on' : ''}">${estado.escolheu[j.id] ? '✅' : '⏳'} ${esc(j.nome)}</span>`).join('')}</div>`;

  function telaEscolha() {
    const participa = estado.times[sala.id], time = participa || {};
    const ja = estado.escolheu[sala.id];
    const n = Object.keys(estado.escolheu).length, todos = estado.jogadores.every(j => estado.escolheu[j.id]);
    // não redesenha o formulário enquanto a pessoa está escolhendo (só atualiza o status)
    if (document.getElementById('busca') && !ja && participa && document.getElementById('rodadaAtual')?.dataset.r == estado.rodada + '-' + estado.temaId) {
      const st = document.getElementById('statusBox'); if (st) st.innerHTML = status();
      const hb = document.getElementById('hostBox'); if (hb) hb.innerHTML = hostBtns(n, todos);
      ligarHost(); return;
    }
    render(`${topo(`Rodada ${estado.rodada}/7`)}<span id="rodadaAtual" data-r="${estado.rodada}-${estado.temaId}"></span>${cartaoTema()}
      ${!participa ? '<p class="muted center">Você está assistindo esta partida.</p>' : ja ? `<div class="card center"><div class="muted small">Sua escolha</div><div style="font-size:1.3rem;font-weight:800">${esc(minha ? minha.nome : '✔')}</div><div class="muted small">Aguardando os outros…</div></div>` : `
        ${F.htmlBusca('busca')}
        <div id="slots" class="card hidden" style="margin-top:10px"><span class="label">Em qual posição?</span><div class="chips" id="slotBtns"></div></div>
        <button class="btn" id="confirmar" disabled>Confirmar</button>`}
      <div id="statusBox">${status()}</div>
      ${participa ? '<button class="btn ghost" id="trocar">🔄 Ninguém conhece? Trocar o tema</button>' : ''}
      <div id="hostBox">${souHost ? hostBtns(n, todos) : ''}</div>
      ${participa ? F.htmlCampo(time, C_(), 'Seu time') : ''}`);
    ligarHost();
    if (!participa || ja) return;
    let escolhido = null, slot = null;
    const vazios = F.SLOTS.filter(s => !time[s.k]);
    const bt = document.getElementById('confirmar');
    F.ligarBusca('busca', j => {
      escolhido = j; slot = null;
      const box = document.getElementById('slots'), btns = document.getElementById('slotBtns');
      if (!j) { box.classList.add('hidden'); bt.disabled = true; return; }
      if (Object.values(time).some(s => s && s.id === j.id)) { toast('Esse jogador já está no seu time.'); escolhido = null; box.classList.add('hidden'); bt.disabled = true; return; }
      const donoId = (estado.ocupados || {})[j.id];
      const tema = F.TEMAS.find(t => t.id === estado.temaId), inval = donoId && donoId !== sala.id ? `${j.nome} já está no time de ${nomeDe(donoId)}. Escolha outro jogador.` : tema && F.motivoInvalido(j, tema, C_());
      if (inval) { escolhido = null; box.classList.remove('hidden'); btns.innerHTML = `<span class="erro-escolha">❌ ${esc(inval)}</span>`; bt.disabled = true; return; }
      const ok = vazios.filter(s => F.encaixa(j, s.g)).filter((s, i, a) => a.findIndex(x => x.g === s.g) === i);
      box.classList.remove('hidden');
      btns.innerHTML = ok.length ? ok.map(s => `<button class="chip" data-slot="${s.k}">${F.POSN[s.g]}</button>`).join('') : `<span class="muted small">Sem posição livre para esse jogador.</span>`;
      if (ok.length === 1) slot = ok[0].k;
      btns.querySelectorAll('[data-slot]').forEach(b => { if (b.dataset.slot === slot) b.classList.add('on'); b.onclick = () => { slot = b.dataset.slot; btns.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); bt.disabled = !slot; }; });
      bt.disabled = !(escolhido && slot);
    });
    bt.onclick = () => { minha = escolhido; rodadaMinha = estado.rodada; sala.enviar('escolha', { id: escolhido.id, slot }); };
  }
  const hostBtns = (n, todos) => souHost ? `<button class="btn ${todos ? '' : 'secondary'}" id="revelar" ${n ? '' : 'disabled'}>${todos ? 'Revelar escolhas' : `Revelar agora (${n}/${estado.jogadores.length})`}</button>` : '';
  function ligarHost() {
    const r = document.getElementById('revelar'); if (r) r.onclick = revelar;
    const t = document.getElementById('trocar'); if (t) t.onclick = () => { if (Object.keys(estado.escolheu).length && !confirm('Trocar o tema? Quem já escolheu vai escolher de novo.')) return; sala.enviar('trocarTema'); };
  }

const tbTime = (slots, maior) => Object.values(slots || {}).filter(Boolean).map(x => maior ? x.v : -x.v).sort((a, b) => b - a);
  const ROT_MT = ['ter o melhor jogador do time', 'o 2º melhor jogador', 'o 3º melhor jogador', 'o 4º melhor jogador', 'o 5º melhor jogador', 'o 6º melhor jogador', 'o 7º melhor jogador'];
  function placar() {
    const c = C_();
    const r = estado.jogadores.map(j => [j.id, F.total(estado.times[j.id] || {})]).sort((a, b) => c.maior ? b[1] - a[1] : a[1] - b[1]);
    return `<table class="score">${r.map(([id, v]) => `<tr><td>${esc(nomeDe(id))}${id === sala.id ? ' <span class="muted small">(você)</span>' : ''}</td><td>${esc(c.fmt(v))}</td></tr>`).join('')}</table>`;
  }
  function telaRevelado() {
    const c = C_();
    render(`${topo(`Rodada ${estado.rodada}/7`)}${cartaoTema()}
      <div class="card"><span class="label">Escolhas</span>${estado.revelacao.map((l, i) => `<div class="result ${l.ok ? 'exact' : 'bust'}" style="animation-delay:${i * .1}s"><span class="who">${esc(nomeDe(l.quem))}<br><span class="small muted">${esc(l.jogador)} · ${F.POSN[l.slot[0]]}${l.ok ? '' : ' · ❌ ' + esc(l.motivo)}</span></span><span class="pts">${esc(c.fmt(l.v))}</span></div>`).join('')}</div>
      <div class="card"><span class="label">Placar</span>${placar()}</div>
      ${estado.times[sala.id] ? F.htmlCampo(estado.times[sala.id], c, 'Seu time') : ''}
      ${souHost ? `<button class="btn" id="prox" style="margin-top:12px">${estado.rodada >= 7 ? '🏆 Ver resultado' : 'Próxima rodada'}</button>` : '<p class="muted center">Aguardando o anfitrião…</p>'}`);
    if (souHost) document.getElementById('prox').onclick = proxima;
  }
  function telaFinal() {
    const c = C_();
    const cl = C.classificar(estado.jogadores.map(j => ({ id: j.id, nome: j.nome, pts: F.total(estado.times[j.id] || {}), tb: tbTime(estado.times[j.id], c.maior) })), ROT_MT, !c.maior);
    const camp = cl.camp, r = cl.ordem.map(x => [x.id, x.pts]);
    if (souHost) window.Ranking && Ranking.registrar(H, 'montatime-sala', estado.jogadores.map(j => j.nome), camp);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${esc(c.nome)} · ${camp.length > 1 ? 'Empate!' : 'Campeão'}</p><h1 class="logo" style="font-size:2.3rem">${camp.map(esc).join(' & ')}</h1></div>
      ${C.htmlDesempate(cl.motivo)}<div class="card"><span class="label">Classificação</span><table class="score">${cl.rank.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${esc(c.fmt(v))}</td></tr>`).join('')}</table></div>
      ${r.map(([id, v]) => `<div style="margin-bottom:14px">${F.htmlCampo(estado.times[id], c, `${esc(nomeDe(id))} · ${esc(c.fmt(v))}`)}</div>`).join('')}
      <div class="card"><span class="label">Temas da partida</span>${(estado.historico || []).map((h, i) => `<p class="small" style="margin:6px 0"><strong>${i + 1}. ${esc(h.tema)}</strong><br>${h.linhas.map(l => `${esc(l.nome)}: ${esc(l.jogador)} ${l.ok ? '✅' : '❌'}`).join(' · ')}</p>`).join('')}</div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : ''}<a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    if (souHost) document.getElementById('denovo').onclick = () => { H.fase = 'lobby'; publicar(); };
  }
})();
