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
  const daVezH = () => H.dev ? H.dev.para : (H.vivos && H.vivos.length ? H.vivos[H.vez % H.vivos.length] : null);
  function publico() {
    return {
      prazo: ((H.fase === 'jogo' || H.fase === 'duvida') && H.prazo) || null,
      fase: H.fase, cfg: H.cfg, partida: H.partida, rodada: H.rodada || 0, jogadores: H.jogadores || [], vivos: H.vivos || [],
      vez: H.fase === 'jogo' ? daVezH() : null, dev: H.dev || null, passaram: H.passaram || [], ver: H.ver || null,
      cadeia: H.cadeia || [], ultimaCadeia: H.ultimaCadeia || null, log: H.log || [], maior: H.maior || 0,
      saiu: H.saiu || null, aviso: H.aviso || '', avisoN: H.avisoN || 0
    };
  }
  const rel = Sala.relogio(() => H, () => expirar());
  function ajustarPrazo() {
    if (H.fase !== 'jogo' && H.fase !== 'duvida') { rel.limpar(); return; }
    const k = [H.partida, H.rodada, (H.cadeia || []).length, daVezH(), H.dev ? 'd' : '', H.fase, (H.vivos || []).length].join('-');
    if (H.prazoKey !== k || !H.prazo) rel.novo(k, H.fase === 'duvida' ? 1 / 4 : 0.5); // 30 s por vez; 15 s para alguém duvidar
  }
  function publicar() { if (souHost) { Sala.limparExpulsos(H); ajustarPrazo(); } Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); if (souHost) rel.armar(); Sala.barraAusentes(H.fase === 'jogo' || H.fase === 'duvida' || H.fase === 'veredito' ? H.vivos || [] : [], presentes, nomeId, tirar); }

  function iniciar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (js.length < 2) { toast('Precisa de pelo menos 2 pessoas na sala.'); return; }
    H.partida++; H.jogadores = js; H.rkId = null;
    H.vivos = C.shuffle(js.map(j => j.id)); H.log = []; H.maior = 0; H.rodada = 0; H.saiu = null; H.ultimaCadeia = null;
    novaRodada(0);
  }
  function novaRodada(inicio) { H.rodada++; H.cadeia = []; H.dev = null; H.ver = null; H.passaram = []; H.vez = inicio % H.vivos.length; H.fase = 'jogo'; H.saiu = null; publicar(); }
  const avisar = t => { H.aviso = t; H.avisoN = (H.avisoN || 0) + 1; };

  function acaoHost(msg) {
    if (H.fase === 'saiu' && msg.tipo === 'seguir') return novaRodada(H.proxInicio || 0);
    if (H.fase === 'duvida') {
      const x = H.cadeia[H.cadeia.length - 1];
      if (!H.vivos.includes(msg.de) || msg.de === x.quemId) return;
      if (msg.tipo === 'duvido') { H.fase = 'veredito'; H.ver = { duvidou: msg.de }; rel.limpar(); return publicar(); }
      if (msg.tipo === 'naoduvido') {
        if (!H.passaram.includes(msg.de)) H.passaram.push(msg.de);
        if (H.vivos.every(v => v === x.quemId || H.passaram.includes(v))) return seguir();
        return publicar();
      }
      return;
    }
    if (H.fase !== 'jogo') return;
    const atual = daVezH();
    if (msg.de !== atual) return;
    if (msg.tipo === 'desisto') return travou(atual, 'desistiu');
    if (msg.tipo !== 'jogada') return;
    const u = H.cadeia[H.cadeia.length - 1], t = !u || u.t === 'c' ? 'j' : 'c', id = +msg.dados.id;
    const nega = m => sala.privado(msg.de, { aviso: m, t: Date.now() });
    const duvido = !!(H.cfg && H.cfg.duvido); let ok;
    if (t === 'j') {
      const j = F.porId[id]; if (!j) return;
      if (H.cadeia.some(e => e.t === 'j' && e.id === id)) return nega(`${j.nome} já foi falado nesta rodada.`);
      ok = !u || F.jogouNoClube(j, u.id);
      if (!ok && !duvido) return nega(`❌ ${j.nome} não jogou no ${u.nome} (segundo a base). Tente outro.`);
      H.cadeia.push({ t: 'j', id, nome: j.nome, quem: nomeId(msg.de), quemId: msg.de, ok });
      if (id === F.ALEX_ID) avisar('🇹🇷 ALEX TURCO!');
    } else {
      const c = F.clubePorId[id]; if (!c) return;
      if (H.cadeia.some(e => e.t === 'c' && F.mesmoClube(e.id, id))) return nega(`${c.nome} já foi falado nesta rodada.`);
      ok = F.jogouNoClube(F.porId[u.id], id);
      if (!ok && !duvido) return nega(`❌ ${u.nome} não jogou no ${c.nome} (segundo a base). Tente outro.`);
      H.cadeia.push({ t: 'c', id, nome: c.nome, quem: nomeId(msg.de), quemId: msg.de, ok });
    }
    H.maior = Math.max(H.maior || 0, H.cadeia.length);
    if (duvido) { H.fase = 'duvida'; H.passaram = []; return publicar(); }
    seguir();
  }
  // resposta aceita
  function seguir() {
    H.fase = 'jogo'; H.passaram = [];
    if (H.dev) { const d = H.dev; return eliminar(d.falhou, `não soube e, quando a pergunta voltou, ${nomeId(d.para)} soube`, d.motivo); }
    H.vez = (H.vez + 1) % H.vivos.length;
    publicar();
  }
  // alguém travou: a pergunta volta para quem falou o último nome
  function travou(id, motivo) {
    if (H.dev) return eliminar(H.dev.para, `${nomeId(H.dev.falhou)} travou e a pergunta voltou, mas ${nomeId(H.dev.para)} também não soube`, motivo);
    const u = H.cadeia[H.cadeia.length - 1];
    if (u && u.quemId !== id && H.vivos.includes(u.quemId)) { H.dev = { falhou: id, para: u.quemId, motivo }; avisar(`↩️ ${nomeId(id)} não soube. A pergunta voltou para ${nomeId(u.quemId)}.`); return publicar(); }
    eliminar(id, motivo === 'tempo' ? 'acabou o tempo' : 'não soube', motivo);
  }
  function decidir(baseCerta) {
    if (H.fase !== 'veredito') return;
    const x = H.cadeia[H.cadeia.length - 1], d = H.ver.duvidou;
    const certo = baseCerta ? x.ok : !x.ok;
    const sai = certo ? d : x.quemId;
    const txt = (sai === d ? `duvidou de ${x.nome}, mas estava certo` : `blefou com ${x.nome}`) + (baseCerta ? '' : ' (decidido pelo grupo)');
    H.ver = null; eliminar(sai, txt, 'duvido');
  }
  function expirar() {
    if (H.fase === 'jogo') travou(daVezH(), 'tempo');
    else if (H.fase === 'duvida') seguir();
  }
  function eliminar(id, texto, motivo) {
    const i = H.vivos.indexOf(id); if (i < 0) return;
    H.vivos.splice(i, 1);
    H.log.push(`${nomeId(id)} saiu na rodada ${H.rodada}: ${texto} · corrente de ${H.cadeia.length}`);
    H.ultimaCadeia = H.cadeia; H.saiu = { nome: nomeId(id), motivo, texto, n: H.cadeia.length };
    H.dev = null; H.ver = null; H.passaram = [];
    rel.limpar();
    if (H.vivos.length <= 1) {
      H.fase = 'final';
      if (H.vivos[0]) window.Ranking && Ranking.registrar(H, 'alex-sala', H.jogadores.map(j => j.nome), [nomeId(H.vivos[0])]);
      return publicar();
    }
    H.fase = 'saiu'; H.proxInicio = i % H.vivos.length; publicar();
  }
  function tirar(xs) {
    xs.forEach(x => {
      if (!H.vivos.includes(x)) return;
      const ult = (H.cadeia || [])[(H.cadeia || []).length - 1];
      const envolvido = H.fase !== 'jogo' || daVezH() === x || (H.dev && (H.dev.falhou === x || H.dev.para === x)) || (ult && ult.quemId === x && H.fase !== 'jogo');
      if (envolvido && H.fase !== 'saiu' && H.fase !== 'final') return eliminar(x, 'saiu da sala', 'saiu');
      const i = H.vivos.indexOf(x); H.vivos.splice(i, 1); if (i < H.vez) H.vez--; H.vez = ((H.vez % H.vivos.length) + H.vivos.length) % H.vivos.length;
      H.log.push(`${nomeId(x)} saiu da sala.`);
      if (H.vivos.length <= 1) H.fase = 'final';
      publicar();
    });
  }
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
    ({ lobby: telaLobby, jogo: telaJogo, duvida: telaDuvida, veredito: telaVeredito, saiu: telaSaiu, final: telaFinal })[estado.fase]();
  }
  const pedidoDe = (t, u, outro) => t === 'j' ? (u ? `${outro ? 'outro' : 'um'} <strong>jogador</strong> que jogou no <strong>${esc(u.nome)}</strong>` : 'qualquer <strong>jogador</strong> para começar a corrente')
    : `${outro ? 'outro' : 'um'} <strong>clube</strong> em que <strong>${esc(u.nome)}</strong>${F.seloAlex(u.id)} jogou`;
  function telaLobby() {
    const duv = !!(estado.cfg && estado.cfg.duvido);
    render(`${topo('Alex')}<div class="center" style="margin:6px 0 12px"><img src="alexturco.png" alt="" style="width:84px;height:84px;border-radius:50%"></div>
      ${Sala.htmlCodigo(sala.codigo)}${Sala.htmlJogadores(presentes, sala.id)}${Sala.htmlTreino(!!(estado.cfg && estado.cfg.treino), souHost)}
      ${souHost ? `<div class="card"><button type="button" class="chip treino-chip ${duv ? 'on' : ''}" id="modoDuvido">🤨 Modo "Eu duvido" ${duv ? 'LIGADO' : 'desligado'}</button>
        <p class="muted small" style="margin:6px 0 0">Ligado: o jogo não confere as respostas e dá para blefar. Depois de cada resposta, todos têm 15 segundos para apertar "Eu duvido". A base confere: resposta certa → sai quem duvidou; blefe → sai quem blefou.</p></div>`
        : (duv ? '<div class="card center"><strong>🤨 Modo "Eu duvido" ligado</strong><div class="muted small">Dá para blefar — e duvidar dos outros.</div></div>' : '')}
      <div class="card"><p class="small" style="margin:0">Jogador → clube dele → outro jogador desse clube → clube desse jogador… <strong>30 segundos</strong> por vez, sem repetir jogador nem clube na rodada.<br>
        <strong>Travou?</strong> A pergunta volta para quem falou o último nome. Se ele souber, você sai; se ele também não souber, sai ele. O último vivo ganha.</p></div>
      ${souHost ? `<button class="btn" id="comecar">Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>` : '<p class="muted center">O anfitrião vai começar.</p>'}`);
    Sala.ligarCodigo(sala.codigo);
    if (souHost) {
      Sala.ligarTreino(() => { H.cfg.treino = !H.cfg.treino; publicar(); });
      document.getElementById('modoDuvido').onclick = () => { H.cfg.duvido = !H.cfg.duvido; publicar(); };
      document.getElementById('comecar').onclick = iniciar;
    }
  }
  function telaJogo() {
    const minha = estado.vez === sala.id, cad = estado.cadeia, u = cad[cad.length - 1], t = !u || u.t === 'c' ? 'j' : 'c', dev = estado.dev;
    const chave = [estado.partida, estado.rodada, cad.length, estado.vez, dev ? 'd' : ''].join('-');
    // não apaga o que a pessoa está digitando quando chega atualização da mesma vez
    if (minha && chave === chaveTela && document.getElementById('busca')) return;
    chaveTela = chave;
    const aviso = dev ? `<div class="card" style="border-color:#f5a524"><strong>↩️ ${esc(nomeDe(dev.falhou))} não soube.</strong>
      <p class="small" style="margin:6px 0 0">A pergunta voltou para ${minha ? 'você' : esc(nomeDe(dev.para))}, que falou <strong>${esc(u.nome)}</strong>. Se souber, ${esc(nomeDe(dev.falhou))} sai; se não souber, sai ${minha ? 'você' : esc(nomeDe(dev.para))}.</p></div>` : '';
    render(`${topo(`Rodada ${estado.rodada}`)}${chips()}${aviso}
      ${minha ? `<div class="card"><p style="margin:0 0 10px"><strong style="font-size:1.3rem">Sua vez!</strong> Fale ${pedidoDe(t, u, !!dev)}:</p>
          ${F.htmlBusca('busca', t === 'j' ? 'Digite o nome do jogador' : 'Digite o nome do clube')}
          <button class="btn" id="confirmar" disabled>Confirmar</button>
          <button class="btn ghost" id="desisto">🏳️ Não sei</button></div>`
        : `<div class="card center"><div class="muted small">Vez de</div><div class="big-name" style="font-size:1.8rem">${esc(nomeDe(estado.vez))}</div><p class="muted" style="margin:6px 0 0">Precisa falar ${pedidoDe(t, u, !!dev)}.</p></div>`}
      ${htmlCadeia(cad)}`);
    if (!minha) return;
    let escolhido = null; const bt = document.getElementById('confirmar');
    const onEsc = x => { escolhido = x; bt.disabled = !x; };
    if (t === 'j') F.ligarBusca('busca', onEsc); else F.ligarBuscaClube('busca', onEsc);
    bt.onclick = () => { if (escolhido) sala.enviar('jogada', { id: escolhido.id }); };
    document.getElementById('desisto').onclick = () => { if (confirm('Não sabe mesmo?')) sala.enviar('desisto'); };
  }
  function telaDuvida() {
    const cad = estado.cadeia, x = cad[cad.length - 1], eu = sala.id;
    const posso = estado.vivos.includes(eu) && eu !== x.quemId, passei = (estado.passaram || []).includes(eu);
    render(`${topo(`Rodada ${estado.rodada}`)}<div class="pass"><div class="emoji">🤨</div>
      <p class="muted" style="margin:0">${x.quemId === eu ? 'Você disse' : esc(x.quem) + ' disse'}</p><div class="big-name" style="font-size:1.8rem">${nomeItem(x)}</div>
      ${posso ? (passei ? '<p class="muted">Você acreditou. Esperando os outros…</p>'
          : `<button class="btn" id="duvido" style="margin-top:12px">🙋 Eu duvido!</button><button class="btn ghost" id="acredito">👍 Acredito</button>`)
        : `<p class="muted">${x.quemId === eu ? 'Torça para ninguém duvidar…' : 'Esperando alguém duvidar…'}</p>`}</div>
      ${htmlCadeia(cad)}`);
    const d = document.getElementById('duvido'); if (d) d.onclick = () => sala.enviar('duvido');
    const a = document.getElementById('acredito'); if (a) a.onclick = () => sala.enviar('naoduvido');
  }
  function telaVeredito() {
    const cad = estado.cadeia, x = cad[cad.length - 1], d = estado.ver ? estado.ver.duvidou : null;
    const pergunta = x.t === 'j' ? (cad.length > 1 ? `${x.nome} jogou no ${cad[cad.length - 2].nome}?` : '') : `${cad[cad.length - 2].nome} jogou no ${x.nome}?`;
    const sai = x.ok ? nomeDe(d) : x.quem, outro = x.ok ? x.quem : nomeDe(d);
    render(`${topo(`Rodada ${estado.rodada}`)}<div class="pass"><div class="emoji">${x.ok ? '✅' : '❌'}</div>
      <p class="muted" style="margin:0">${esc(nomeDe(d))} duvidou de ${esc(x.quem)}</p>
      <div class="big-name" style="font-size:1.5rem">${esc(pergunta)}</div>
      <p style="margin:8px 0">Segundo a base: <strong>${x.ok ? 'SIM, era verdade' : 'NÃO, foi blefe'}</strong></p>
      ${souHost ? `<button class="btn" id="conf">${esc(sai)} está fora</button><button class="btn ghost" id="inv">⚖️ A base errou — sai ${esc(outro)}</button>`
        : `<p class="muted">${esc(sai)} deve sair. O anfitrião confirma (ou corrige, se a base errou).</p>`}</div>
      ${htmlCadeia(cad)}`);
    if (souHost) { document.getElementById('conf').onclick = () => decidir(true); document.getElementById('inv').onclick = () => decidir(false); }
  }
  function telaSaiu() {
    const s = estado.saiu || {};
    const emoji = s.motivo === 'tempo' ? '⏱️' : s.motivo === 'duvido' ? '🤨' : s.motivo === 'saiu' ? '🚪' : '🏳️';
    const txt = s.texto ? s.texto.charAt(0).toUpperCase() + s.texto.slice(1) : '';
    render(`${topo(`Rodada ${estado.rodada}`)}<div class="pass"><div class="emoji">${emoji}</div><div class="big-name" style="font-size:2rem">${esc(s.nome || '')} está fora!</div>
      <p class="muted">${esc(txt)}. A corrente parou em ${s.n || 0}.</p>${chips()}
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
