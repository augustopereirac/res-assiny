// Alex — vários celulares. Na sua vez, você escolhe no seu celular; todos veem a corrente.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const JOGO = 'alex';
  const render = html => { app.innerHTML = html; };
  let sala = null, souHost = false, estado = null, presentes = [], H = null, chaveTela = null;

  Sala.telaEntrada(app, 'Alex', 'alex.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    const iniciarH = () => { H = Sala.carregarHost(JOGO, codigo) || { cfg: {}, fase: 'lobby', partida: 0 }; };
    if (souHost) iniciarH();
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { if (estado && e.aviso && e.avisoN !== estado.avisoN) toast(e.aviso); estado = e; desenhar(); },
      onPrivado: d => { if (d && d.aviso) toast(d.aviso); },
      onAcao: acaoHost, snapshot: () => H,
      onVirarHost: h => { if (h) Sala.salvarHost(JOGO, codigo, h); souHost = true; iniciarH(); app.innerHTML = ''; chaveTela = null; toast('👑 O anfitrião saiu. Agora você é o anfitrião da sala.'); publicar(); },
      onDeixarHost: () => { souHost = false; rel.parar(); const b = document.getElementById('barraAusentes'); if (b) b.remove(); },
      onPresenca: l => { presentes = l; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) publicar(); else if (!estado) desenhar(); } }
    });
  });

  // ---------- anfitrião ----------
  const nomeId = id => ((H && H.jogadores) || []).find(j => j.id === id)?.nome || '?';
  function publico() {
    return {
      prazo: (H.fase === 'jogo' && H.prazo) || null,
      fase: H.fase, cfg: H.cfg, partida: H.partida, rodada: H.rodada || 0, jogadores: H.jogadores || [], vivos: H.vivos || [],
      vez: H.vivos && H.vivos.length ? H.vivos[H.vez % H.vivos.length] : null,
      cadeia: H.cadeia || [], ultimaCadeia: H.ultimaCadeia || null, log: H.log || [], maior: H.maior || 0,
      saiu: H.saiu || null, aviso: H.aviso || '', avisoN: H.avisoN || 0
    };
  }
  const rel = Sala.relogio(() => H, () => expirar());
  function ajustarPrazo() {
    if (H.fase !== 'jogo') { rel.limpar(); return; }
    const k = [H.partida, H.rodada, (H.cadeia || []).length, H.vez, (H.vivos || []).length].join('-');
    if (H.prazoKey !== k || !H.prazo) rel.novo(k, 0.5); // 30 segundos
  }
  function publicar() { if (souHost) { Sala.limparExpulsos(H); ajustarPrazo(); } Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); if (souHost) rel.armar(); Sala.barraAusentes(H.fase === 'jogo' ? H.vivos || [] : [], presentes, nomeId, tirar); }

  function iniciar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (js.length < 2) { toast('Precisa de pelo menos 2 pessoas na sala.'); return; }
    H.partida++; H.jogadores = js; H.rkId = null;
    H.vivos = C.shuffle(js.map(j => j.id)); H.log = []; H.maior = 0; H.rodada = 0; H.saiu = null; H.ultimaCadeia = null;
    novaRodada(0);
  }
  function novaRodada(inicio) { H.rodada++; H.cadeia = []; H.vez = inicio % H.vivos.length; H.fase = 'jogo'; H.saiu = null; publicar(); }
  const avisar = t => { H.aviso = t; H.avisoN = (H.avisoN || 0) + 1; };

  function acaoHost(msg) {
    if (H.fase === 'saiu' && msg.tipo === 'seguir') return novaRodada(H.proxInicio || 0);
    if (H.fase !== 'jogo') return;
    const atual = H.vivos[H.vez];
    if (msg.de !== atual) return;
    if (msg.tipo === 'desisto') return eliminar(atual, 'desistiu');
    if (msg.tipo !== 'jogada') return;
    const u = H.cadeia[H.cadeia.length - 1], t = !u || u.t === 'c' ? 'j' : 'c', id = +msg.dados.id;
    const nega = m => sala.privado(msg.de, { aviso: m, t: Date.now() });
    if (t === 'j') {
      const j = F.porId[id]; if (!j) return;
      if (H.cadeia.some(e => e.t === 'j' && e.id === id)) return nega(`${j.nome} já foi falado nesta rodada.`);
      if (u && !F.jogouNoClube(j, u.id)) return nega(`❌ ${j.nome} não jogou no ${u.nome} (segundo a base). Tente outro.`);
      H.cadeia.push({ t: 'j', id, nome: j.nome, quem: nomeId(msg.de) });
      if (id === F.ALEX_ID) avisar('🇹🇷 ALEX TURCO!');
    } else {
      const c = F.clubePorId[id]; if (!c) return;
      if (H.cadeia.some(e => e.t === 'c' && F.mesmoClube(e.id, id))) return nega(`${c.nome} já foi falado nesta rodada.`);
      if (!F.jogouNoClube(F.porId[u.id], id)) return nega(`❌ ${u.nome} não jogou no ${c.nome} (segundo a base). Tente outro.`);
      H.cadeia.push({ t: 'c', id, nome: c.nome, quem: nomeId(msg.de) });
    }
    H.maior = Math.max(H.maior || 0, H.cadeia.length);
    H.vez = (H.vez + 1) % H.vivos.length;
    publicar();
  }
  function expirar() { if (H.fase === 'jogo') eliminar(H.vivos[H.vez], 'tempo'); }
  function eliminar(id, motivo) {
    const i = H.vivos.indexOf(id); if (i < 0) return;
    H.vivos.splice(i, 1);
    H.log.push(`${nomeId(id)} saiu na rodada ${H.rodada} (${motivo === 'tempo' ? 'acabou o tempo' : motivo === 'saiu' ? 'saiu da sala' : 'não soube'}) · corrente de ${H.cadeia.length}`);
    H.ultimaCadeia = H.cadeia; H.saiu = { nome: nomeId(id), motivo, n: H.cadeia.length };
    rel.limpar();
    if (H.vivos.length <= 1) {
      H.fase = 'final';
      if (H.vivos[0]) window.Ranking && Ranking.registrar(H, 'alex-sala', H.jogadores.map(j => j.nome), [nomeId(H.vivos[0])]);
      return publicar();
    }
    H.fase = 'saiu'; H.proxInicio = i % H.vivos.length; publicar();
  }
  function tirar(xs) { xs.forEach(x => { if (H.vivos.includes(x)) { if (H.vivos[H.vez] === x || H.fase !== 'jogo') eliminar(x, 'saiu'); else { const i = H.vivos.indexOf(x); H.vivos.splice(i, 1); if (i < H.vez) H.vez--; H.vez %= H.vivos.length; H.log.push(`${nomeId(x)} saiu da sala.`); if (H.vivos.length <= 1) { H.fase = 'final'; } publicar(); } } }); }
  function voltarLobby() { H.fase = 'lobby'; publicar(); }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="alex.html">Sair</a></div>`;
  const nomeDe = id => (estado.jogadores || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const nomeItem = x => x.t === 'j' ? `${esc(x.nome)}${F.seloAlex(x.id)}` : `🏟️ ${esc(x.nome)}`;
  const htmlCadeia = (cad, titulo) => cad && cad.length ? `<div class="card"><span class="label">${titulo || 'Corrente da rodada'} (${cad.length})</span>
    <div class="cadeia">${cad.map((x, i) => `<div class="elo ${x.t}"><span class="muted small">${i + 1}. ${esc(x.quem)}</span><strong>${nomeItem(x)}</strong></div>`).join('<div class="seta">↓</div>')}</div></div>` : '';
  const chips = () => `<div class="chips" style="justify-content:center;margin:8px 0">${estado.jogadores.map(j => `<span class="chip ${estado.vivos.includes(j.id) ? (j.id === estado.vez ? 'on' : '') : 'out'}">${estado.vivos.includes(j.id) ? '' : '❌ '}${esc(j.nome)}${j.id === sala.id ? ' (você)' : ''}</span>`).join('')}</div>`;

  function desenhar() {
    Sala.mostrarPrazo(estado && estado.prazo);
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    if (estado.fase !== 'jogo') chaveTela = null;
    ({ lobby: telaLobby, jogo: telaJogo, saiu: telaSaiu, final: telaFinal })[estado.fase]();
  }
  function telaLobby() {
    render(`${topo('Alex')}<div class="center" style="margin:6px 0 12px"><img src="alexturco.png" alt="" style="width:84px;height:84px;border-radius:50%"></div>
      ${Sala.htmlCodigo(sala.codigo)}${Sala.htmlJogadores(presentes, sala.id)}${Sala.htmlTreino(!!(estado.cfg && estado.cfg.treino), souHost)}
      <div class="card"><p class="small" style="margin:0">Jogador → clube dele → outro jogador desse clube → clube desse jogador… <strong>30 segundos</strong> por vez, sem repetir jogador nem clube na rodada. Quem travar sai. O último vivo ganha.</p></div>
      ${souHost ? `<button class="btn" id="comecar">Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>` : '<p class="muted center">O anfitrião vai começar.</p>'}`);
    Sala.ligarCodigo(sala.codigo);
    if (souHost) { Sala.ligarTreino(() => { H.cfg.treino = !H.cfg.treino; publicar(); }); document.getElementById('comecar').onclick = iniciar; }
  }
  function telaJogo() {
    const minha = estado.vez === sala.id, cad = estado.cadeia, u = cad[cad.length - 1], t = !u || u.t === 'c' ? 'j' : 'c';
    const chave = [estado.partida, estado.rodada, cad.length, estado.vez].join('-');
    // não apaga o que a pessoa está digitando quando chega atualização da mesma vez
    if (minha && chave === chaveTela && document.getElementById('busca')) return;
    chaveTela = chave;
    const pedido = t === 'j' ? (u ? `um <strong>jogador</strong> que jogou no <strong>${esc(u.nome)}</strong>` : 'qualquer <strong>jogador</strong> para começar a corrente')
      : `um <strong>clube</strong> em que <strong>${esc(u.nome)}</strong>${F.seloAlex(u.id)} jogou`;
    render(`${topo(`Rodada ${estado.rodada}`)}${chips()}
      ${minha ? `<div class="card"><p style="margin:0 0 10px"><strong style="font-size:1.3rem">Sua vez!</strong> Fale ${pedido}:</p>
          ${F.htmlBusca('busca', t === 'j' ? 'Digite o nome do jogador' : 'Digite o nome do clube')}
          <button class="btn" id="confirmar" disabled>Confirmar</button>
          <button class="btn ghost" id="desisto">🏳️ Não sei (estou fora)</button></div>`
        : `<div class="card center"><div class="muted small">Vez de</div><div class="big-name" style="font-size:1.8rem">${esc(nomeDe(estado.vez))}</div><p class="muted" style="margin:6px 0 0">Precisa falar ${pedido}.</p></div>`}
      ${htmlCadeia(cad)}`);
    if (!minha) return;
    let escolhido = null; const bt = document.getElementById('confirmar');
    const onEsc = x => { escolhido = x; bt.disabled = !x; };
    if (t === 'j') F.ligarBusca('busca', onEsc); else F.ligarBuscaClube('busca', onEsc);
    bt.onclick = () => { if (escolhido) sala.enviar('jogada', { id: escolhido.id }); };
    document.getElementById('desisto').onclick = () => { if (confirm('Desistir e sair da partida?')) sala.enviar('desisto'); };
  }
  function telaSaiu() {
    const s = estado.saiu || {};
    render(`${topo(`Rodada ${estado.rodada}`)}<div class="pass"><div class="emoji">${s.motivo === 'tempo' ? '⏱️' : '🏳️'}</div><div class="big-name" style="font-size:2rem">${esc(s.nome || '')} está fora!</div>
      <p class="muted">${s.motivo === 'tempo' ? 'Acabaram os 30 segundos.' : s.motivo === 'saiu' ? 'Saiu da sala.' : 'Não soube responder.'} A corrente parou em ${s.n || 0}.</p>${chips()}
      ${souHost ? '<button class="btn" id="seguir">Nova rodada</button>' : '<p class="muted center">Aguardando o anfitrião começar a próxima rodada…</p>'}</div>
      ${htmlCadeia(estado.ultimaCadeia, 'Corrente da rodada')}`);
    if (souHost) document.getElementById('seguir').onclick = () => novaRodada(H.proxInicio || 0);
  }
  function telaFinal() {
    const venc = estado.vivos[0];
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">Último vivo</p>
      <h1 class="logo" style="font-size:2.3rem">${venc ? esc(nomeDe(venc)) : '—'}</h1></div>
      <div class="card"><span class="label">Como foi</span>${(estado.log || []).map(l => `<p class="small" style="margin:6px 0">${esc(l)}</p>`).join('')}
        <p class="muted small" style="margin:8px 0 0">Maior corrente da partida: ${estado.maior}</p></div>
      ${htmlCadeia(estado.ultimaCadeia, 'Última corrente')}
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : ''}<a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    if (souHost) document.getElementById('denovo').onclick = voltarLobby;
  }
})();
