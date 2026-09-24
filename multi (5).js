// Quem Tava Lá — vários celulares. Cada um fala o nome no próprio celular na sua vez; os outros duvidam no deles.
(function () {
  const C = window.Comum;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const JOGOS = window.JOGOS_QTL || [];
  const JOGO = 'qtl';
  const POS = { GOL: 'Goleiro', ZAG: 'Zagueiro', LAT: 'Lateral', VOL: 'Volante', MEI: 'Meia', ATA: 'Atacante' };
  const fmtData = d => { const [a, m, dd] = d.split('-'); return `${dd}/${m}/${a}`; };
  const render = html => { app.innerHTML = html; };

  let sala = null, souHost = false, estado = null, presentes = [];
  let H = null, M = null;

  Sala.telaEntrada(app, 'Quem Tava Lá', './', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    if (souHost) {
      H = Sala.carregarHost(JOGO, codigo) || { cfg: { modo: 'duvido', jogo: 'sortear' }, fase: 'lobby', partida: 0, vistos: [] };
      if (H.jogoId) preparar();
    }
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { estado = e; desenhar(); },
      onPrivado: d => { if (d && d.aviso) toast(d.aviso); },
      onAcao: souHost ? acaoHost : null,
      onPresenca: lista => { presentes = lista; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) publicar(); else if (!estado) desenhar(); } if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') toast('Problema de conexão. Tentando de novo…'); }
    });
  });

  // ---------- anfitrião ----------
  const jogoAtual = () => JOGOS.find(j => j.id === H.jogoId);
  function preparar() {
    const j = jogoAtual();
    M = { atletas: [] };
    j.times.forEach(t => t.jogadores.forEach(a => M.atletas.push({ ...a, time: t.nome })));
    (H.extras || []).forEach(x => M.atletas.push(x));
    M.match = C.criarMatcher(M.atletas);
  }
  const nomeId = id => (H.jogadores || []).find(j => j.id === id)?.nome || '?';
  const pubA = a => a ? { nome: a.nome, time: a.time, pos: a.pos || '', titular: !!a.titular } : null;

  function publico() {
    const j = H.jogoId ? jogoAtual() : null;
    const final = H.fase === 'final';
    return {
      fase: H.fase, partida: H.partida, cfg: H.cfg, jogadores: H.jogadores || [],
      jogo: j ? { titulo: j.titulo, competicao: j.competicao, placar: j.placar, data: j.data, local: j.local, incompleto: j.times.some(t => t.reservas_completas === false) } : null,
      ordem: H.ordem || [], vez: H.vez, vivos: H.vivos || [], folgas: H.folgas || {},
      ditos: (H.ditos || []).map(d => ({ jogador: d.jogador, texto: d.texto, status: d.status, atleta: d.status === 'passou' && !final ? null : pubA(d.ai != null ? M.atletas[d.ai] : null) })),
      pendente: H.pendente ? { jogador: H.pendente.jogador, texto: H.pendente.texto, passes: H.pendente.passes } : null,
      juiz: H.juiz ? { jogador: H.juiz.jogador, texto: H.juiz.texto } : null,
      msg: H.msg || null, log: H.log || [], motivo: H.motivo || null,
      times: final ? j.times.map(t => ({ nome: t.nome, tecnico: t.tecnico, completos: t.reservas_completas !== false, jogadores: t.jogadores.map(a => ({ nome: a.nome, pos: a.pos, titular: a.titular })) })) : null,
      curiosidade: final ? j.curiosidade : null,
      listaJogos: H.fase === 'lobby' ? null : undefined
    };
  }
  function publicar() { Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); }

  function iniciar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (js.length < 2) { toast('Precisa de pelo menos 2 pessoas na sala.'); return; }
    let j;
    if (H.cfg.jogo !== 'sortear') j = JOGOS.find(x => x.id === H.cfg.jogo);
    else { let pool = JOGOS.filter(x => !H.vistos.includes(x.id)); if (!pool.length) { pool = JOGOS; H.vistos = []; } j = pool[Math.floor(Math.random() * pool.length)]; }
    H.vistos.push(j.id);
    H.jogoId = j.id; H.extras = []; preparar();
    H.partida++; H.jogadores = js;
    const ids = js.map(x => x.id), ini = (H.partida - 1) % ids.length;
    H.ordem = ids.slice(ini).concat(ids.slice(0, ini)); H.vez = 0;
    H.vivos = ids.slice(); H.folgas = Object.fromEntries(ids.map(i => [i, 0]));
    H.ditos = []; H.log = []; H.msg = null; H.pendente = null; H.juiz = null; H.motivo = null;
    H.fase = 'apresentacao';
    publicar();
  }
  function comecar() { H.fase = 'jogo'; pular(); publicar(); }

  function identificar(texto) {
    const r = M.match(texto);
    const dito = ai => H.ditos.some(d => d.ai === ai);
    let ai = null;
    if (r && r.ambiguos) {
      const livres = r.ambiguos.filter(a => !dito(M.atletas.indexOf(a)));
      const mesmo = livres.length > 1 && livres.every(a => C.norm(a.nome) === C.norm(livres[0].nome));
      if (livres.length === 1 || mesmo) ai = M.atletas.indexOf(livres[0]);
      else return { erro: livres.length ? 'Tem mais de um jogador com esse nome neste jogo. Digite o nome completo.' : 'Esse nome já foi falado.' };
    } else if (r && r.item) ai = M.atletas.indexOf(r.item);
    if (ai != null && dito(ai)) return { erro: 'Esse nome já foi falado.' };
    if (H.ditos.some(d => C.norm(d.texto) === C.norm(texto))) return { erro: 'Esse nome já foi falado.' };
    return { ai };
  }

  function acaoHost(msg) {
    const atual = H.ordem && H.ordem[H.vez];
    if (msg.tipo === 'nome' && H.fase === 'jogo' && msg.de === atual && !H.pendente && !H.juiz) {
      const texto = String(msg.dados.texto || '').trim().slice(0, 60); if (!texto) return;
      const id = identificar(texto);
      if (id.erro) { sala.privado(msg.de, { aviso: id.erro, t: Date.now() }); return; }
      H.msg = null;
      if (H.cfg.modo === 'duvido') { H.pendente = { jogador: msg.de, texto, ai: id.ai, passes: [] }; return publicar(); }
      if (id.ai != null) return certo(msg.de, texto, id.ai);
      if (jogoAtual().times.some(t => t.reservas_completas === false)) { H.juiz = { jogador: msg.de, texto, duvidou: null }; return publicar(); }
      return errou(msg.de, texto);
    }
    if (H.pendente && msg.de !== H.pendente.jogador && H.vivos.includes(msg.de)) {
      if (msg.tipo === 'duvido') {
        const p = H.pendente; H.pendente = null;
        if (p.ai != null) return duvidaResolvida(p, msg.de, true);
        if (jogoAtual().times.some(t => t.reservas_completas === false)) { H.juiz = { jogador: p.jogador, texto: p.texto, duvidou: msg.de }; return publicar(); }
        return duvidaResolvida(p, msg.de, false);
      }
      if (msg.tipo === 'passa' && !H.pendente.passes.includes(msg.de)) {
        H.pendente.passes.push(msg.de);
        if (H.vivos.filter(v => v !== H.pendente.jogador).every(o => H.pendente.passes.includes(o))) aceitarSemDuvida(); else publicar();
      }
    }
  }

  function avancar() { do { H.vez = (H.vez + 1) % H.ordem.length; } while (!H.vivos.includes(H.ordem[H.vez])); }
  function pular() {
    const avisos = [];
    for (let i = 0; i < 50 && H.vivos.length > 1; i++) {
      const a = H.ordem[H.vez];
      if (!H.vivos.includes(a)) { avancar(); continue; }
      if (H.folgas[a] > 0) { H.folgas[a]--; avisos.push(`🛡️ ${esc(nomeId(a))} usou a folga.`); avancar(); continue; }
      break;
    }
    if (avisos.length) H.msg = { tipo: 'under', html: (H.msg ? H.msg.html + '<br>' : '') + avisos.join('<br>') };
  }
  function fimOuSegue() {
    if (H.vivos.length <= 1) { H.fase = 'final'; return publicar(); }
    const falados = new Set(H.ditos.filter(d => d.ai != null).map(d => d.ai));
    if (falados.size >= M.atletas.length) { H.fase = 'final'; H.motivo = 'nomes'; return publicar(); }
    avancar(); pular(); publicar();
  }
  const desc = a => `${esc(a.nome)} <span class="small muted">(${esc(a.time)}${a.pos ? ', ' + (POS[a.pos] || a.pos) : ''}${a.titular ? '' : a.pos ? ', entrou no jogo' : ''})</span>`;

  function certo(jog, texto, ai) {
    H.ditos.push({ jogador: jog, texto, ai, status: 'certo' });
    H.msg = { tipo: 'exact', html: `✅ ${esc(nomeId(jog))} acertou: ${desc(M.atletas[ai])}` };
    fimOuSegue();
  }
  function errou(jog, texto) {
    H.ditos.push({ jogador: jog, texto, ai: null, status: 'errou' });
    H.vivos = H.vivos.filter(v => v !== jog);
    H.log.push(`${nomeId(jog)} saiu ao falar “${texto}”, que não estava no jogo.`);
    H.msg = { tipo: 'bust', html: `❌ <strong>${esc(texto)}</strong> não estava. ${esc(nomeId(jog))} está fora.` };
    fimOuSegue();
  }
  function aceitarSemDuvida() {
    const p = H.pendente; H.pendente = null;
    H.ditos.push({ jogador: p.jogador, texto: p.texto, ai: p.ai, status: 'passou' });
    H.msg = { tipo: 'under', html: `${esc(nomeId(p.jogador))}: <strong>${esc(p.texto)}</strong> passou sem dúvida.` };
    fimOuSegue();
  }
  function duvidaResolvida(p, quem, estava) {
    const falou = nomeId(p.jogador), duv = nomeId(quem);
    if (estava) {
      H.ditos.push({ jogador: p.jogador, texto: p.texto, ai: p.ai, status: 'duvidado-certo' });
      H.vivos = H.vivos.filter(v => v !== quem); H.folgas[p.jogador]++;
      H.log.push(`${duv} duvidou de ${M.atletas[p.ai].nome} (falado por ${falou}) e saiu.`);
      H.msg = { tipo: 'exact', html: `✅ ${desc(M.atletas[p.ai])} estava lá! ${esc(duv)} duvidou errado e saiu. ${esc(falou)} ganha folga 🛡️.` };
    } else {
      H.ditos.push({ jogador: p.jogador, texto: p.texto, ai: null, status: 'duvidado-errado' });
      H.vivos = H.vivos.filter(v => v !== p.jogador); H.folgas[quem]++;
      H.log.push(`${falou} falou “${p.texto}”, ${duv} duvidou e ${falou} saiu.`);
      H.msg = { tipo: 'bust', html: `❌ <strong>${esc(p.texto)}</strong> não estava! ${esc(falou)} saiu. ${esc(duv)} duvidou certo e ganha folga 🛡️.` };
    }
    fimOuSegue();
  }
  function juizDecide(valeu) {
    const jz = H.juiz; H.juiz = null;
    if (valeu) {
      M.atletas.push({ nome: jz.texto, pos: '', titular: false, time: '(validado pelo grupo)' });
      H.extras = (H.extras || []).concat([{ nome: jz.texto, pos: '', titular: false, time: '(validado pelo grupo)' }]);
      M.match = C.criarMatcher(M.atletas);
      const ai = M.atletas.length - 1;
      if (jz.duvidou) return duvidaResolvida({ jogador: jz.jogador, texto: jz.texto, ai }, jz.duvidou, true);
      return certo(jz.jogador, jz.texto, ai);
    }
    if (jz.duvidou) return duvidaResolvida({ jogador: jz.jogador, texto: jz.texto, ai: null }, jz.duvidou, false);
    errou(jz.jogador, jz.texto);
  }
  function voltarLobby() { H.fase = 'lobby'; if (H.cfg.jogo !== 'sortear') H.cfg.jogo = 'sortear'; publicar(); }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="./">Sair</a></div>`;
  const nomeDe = id => (estado.jogadores || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const faixa = m => m ? `<div class="result ${m.tipo}" style="margin-bottom:14px"><span class="who">${m.html}</span></div>` : '';

  function desenhar() {
    const antes = document.getElementById('nome');
    const valor = antes ? antes.value : null, foco = antes && document.activeElement === antes;
    desenhar0();
    const depois = document.getElementById('nome');
    if (depois && valor) depois.value = valor;
    if (depois && foco) depois.focus();
  }
  function desenhar0() {
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    ({ lobby: telaLobby, apresentacao: telaApresentacao, jogo: telaJogo, final: telaFinal })[estado.fase]();
  }

  function telaLobby() {
    const cfg = estado.cfg;
    const comps = [...new Set(JOGOS.map(j => j.competicao))];
    render(`
      ${topo('Quem Tava Lá')}
      ${Sala.htmlCodigo(sala.codigo)}
      ${Sala.htmlJogadores(presentes, sala.id)}
      ${souHost ? `
        <div class="card"><span class="label">Modo</span>
          <button class="list-opt ${cfg.modo === 'duvido' ? 'on' : ''}" data-modo="duvido"><strong>✋ Com "Duvido"</strong><span class="muted small">Os outros duvidam no próprio celular. O app só confere quando alguém duvida.</span></button>
          <button class="list-opt ${cfg.modo === 'direto' ? 'on' : ''}" data-modo="direto"><strong>✅ Sem "Duvido"</strong><span class="muted small">O app confere cada nome na hora.</span></button></div>
        <div class="card"><span class="label">Jogo</span>
          <button class="list-opt ${cfg.jogo === 'sortear' ? 'on' : ''}" data-jogo="sortear"><strong>🎲 Sortear um jogo</strong></button>
          ${comps.map(c => `<div class="muted small" style="margin:12px 0 6px;font-weight:700">${esc(c)}</div>${JOGOS.filter(j => j.competicao === c).map(j => `<button class="list-opt ${cfg.jogo === j.id ? 'on' : ''}" data-jogo="${esc(j.id)}"><strong>${esc(j.titulo)}</strong><span class="muted small">${esc(j.placar)}</span></button>`).join('')}`).join('')}
        </div>
        <button class="btn" id="comecar" ${presentes.length >= 2 ? '' : 'disabled'}>Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>
      ` : `<p class="muted center">${cfg.modo === 'duvido' ? '✋ Com Duvido' : '✅ Sem Duvido'}. O anfitrião vai começar.</p>`}
    `);
    Sala.ligarCodigo(sala.codigo);
    if (!souHost) return;
    app.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { H.cfg.modo = b.dataset.modo; publicar(); });
    app.querySelectorAll('[data-jogo]').forEach(b => b.onclick = () => { H.cfg.jogo = b.dataset.jogo; publicar(); });
    document.getElementById('comecar').onclick = iniciar;
  }

  function cartaoJogo() {
    const j = estado.jogo;
    return `<div class="card"><span class="pill theme">${esc(j.competicao)}</span>
      <div class="question" style="font-size:1.3rem">${esc(j.titulo)}</div>
      <div style="font-size:1.05rem;font-weight:800;margin:6px 0">${esc(j.placar)}</div>
      <div class="unit">${fmtData(j.data)} · ${esc(j.local)}</div></div>`;
  }

  function telaApresentacao() {
    render(`${topo(estado.cfg.modo === 'duvido' ? '✋ Com Duvido' : '✅ Sem Duvido')}${cartaoJogo()}
      <p class="muted small center">Vale titular e reserva que entrou em campo. Técnico não conta.<br>Ordem: ${estado.ordem.map(id => esc(nomeDe(id))).join(' → ')}</p>
      ${souHost ? `<button class="btn" id="ir">Começar</button>${estado.cfg.jogo === 'sortear' ? '<button class="btn ghost" id="outro">🎲 Sortear outro jogo</button>' : ''}` : '<p class="muted center">Aguardando o anfitrião…</p>'}`);
    if (souHost) { document.getElementById('ir').onclick = comecar; const o = document.getElementById('outro'); if (o) o.onclick = () => { H.partida--; iniciar(); }; }
  }

  function chipsVivos() {
    return `<div class="chips" style="justify-content:center;margin:10px 0">${estado.ordem.map(id => `<span class="chip ${estado.vivos.includes(id) ? (id === estado.ordem[estado.vez] ? 'on' : '') : 'out'}">${estado.vivos.includes(id) ? '' : '❌ '}${esc(nomeDe(id))}${estado.folgas[id] ? ' 🛡️' : ''}</span>`).join('')}</div>`;
  }
  function jaFalados() {
    if (!estado.ditos.length) return '';
    return `<div class="card"><span class="label">Já falados (${estado.ditos.length})</span><div class="said">${estado.ditos.slice().reverse().map(d => d.status === 'passou'
      ? `<span class="said-item">${esc(d.texto)}<span class="by">${esc(nomeDe(d.jogador))}</span></span>` : `<span class="said-item ${d.atleta ? 'ok' : 'miss'}">${esc(d.atleta ? d.atleta.nome : d.texto)}<span class="by">${esc(nomeDe(d.jogador))}</span></span>`).join('')}</div></div>`;
  }

  function telaJogo() {
    const atual = estado.ordem[estado.vez], pend = estado.pendente, jz = estado.juiz;
    let acao;
    if (jz) {
      acao = `<div class="pass" style="padding:14px 0"><div class="emoji">🤔</div><div class="big-name" style="font-size:1.8rem">${esc(jz.texto)}</div>
        <p>Não está entre os jogadores que tenho deste jogo, mas pode faltar algum reserva.</p>
        ${souHost ? '<button class="btn secondary" id="valeu">Ele entrou em campo, vale</button><button class="btn" id="naovaleu">Não estava</button>' : '<p class="muted">O anfitrião decide com o grupo…</p>'}</div>`;
    } else if (pend) {
      const eu = pend.jogador === sala.id, vivoEu = estado.vivos.includes(sala.id), passei = pend.passes.includes(sala.id);
      acao = `<div class="pass" style="padding:14px 0"><p class="muted">${esc(nomeDe(pend.jogador))} disse</p><div class="big-name" style="font-size:2rem">${esc(pend.texto)}</div>
        ${eu ? '<p class="muted">Esperando os outros decidirem se duvidam…</p>' : !vivoEu ? '<p class="muted">Você está fora, só assistindo.</p>' : passei ? '<p class="muted">Você deixou passar. Esperando os outros…</p>'
          : '<p class="muted">Ele estava em campo? Você duvida?</p><button class="btn duvido" id="duvido">✋ Duvido!</button><button class="btn secondary" id="passa">👍 Deixa passar</button>'}
        <div class="muted small">${pend.passes.length ? `Deixaram passar: ${pend.passes.map(id => esc(nomeDe(id))).join(', ')}` : ''}</div>
        ${souHost ? '<button class="btn ghost" id="forcar">Ninguém duvidou, seguir</button>' : ''}</div>`;
    } else if (atual === sala.id) {
      acao = `<div class="card"><p style="margin:0 0 10px"><strong style="font-size:1.3rem">Sua vez!</strong> Quem tava lá?</p>
        <form id="f"><input type="text" id="nome" autocomplete="off" autocapitalize="words" placeholder="Nome do jogador"><button class="btn" type="submit">${estado.cfg.modo === 'duvido' ? 'Falar' : 'Conferir'}</button></form></div>`;
    } else {
      acao = `<div class="card center"><div class="muted small">Vez de</div><div class="big-name" style="font-size:1.8rem;margin:4px 0">${esc(nomeDe(atual))}</div></div>`;
    }
    render(`${topo(`${estado.vivos.length} na disputa`)}${faixa(estado.msg)}${cartaoJogo()}${chipsVivos()}${acao}${jaFalados()}`);
    const f = document.getElementById('f');
    if (f) f.onsubmit = e => { e.preventDefault(); const inp = document.getElementById('nome'); const t = inp.value.trim(); if (!t) return; inp.value = ''; sala.enviar('nome', { texto: t }); };
    const d = document.getElementById('duvido'); if (d) d.onclick = () => sala.enviar('duvido');
    const pa = document.getElementById('passa'); if (pa) pa.onclick = () => sala.enviar('passa');
    const fo = document.getElementById('forcar'); if (fo) fo.onclick = () => { if (H.pendente) aceitarSemDuvida(); };
    const v = document.getElementById('valeu'); if (v) v.onclick = () => juizDecide(true);
    const nv = document.getElementById('naovaleu'); if (nv) nv.onclick = () => juizDecide(false);
  }

  function telaFinal() {
    const vivos = estado.ordem.filter(id => estado.vivos.includes(id)).map(nomeDe);
    const falados = new Set(estado.ditos.filter(d => d.atleta).map(d => d.atleta.nome));
    const blefes = estado.ditos.filter(d => d.status === 'passou' && !d.atleta);
    render(`
      <div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${estado.motivo === 'nomes' ? 'Acabaram os nomes! ' : ''}${vivos.length > 1 ? 'Sobreviventes' : 'Último em pé'}</p>
        <h1 class="logo" style="font-size:2.4rem">${vivos.map(esc).join(' & ')}</h1></div>
      ${estado.log.length ? `<div class="card"><span class="label">Eliminações</span>${estado.log.map(l => `<p class="small" style="margin:6px 0">${esc(l)}</p>`).join('')}</div>` : ''}
      ${blefes.length ? `<div class="card"><span class="label">Passaram sem ninguém duvidar, mas não estavam 🤫</span>${blefes.map(b => `<p class="small" style="margin:6px 0"><strong>${esc(nomeDe(b.jogador))}</strong>: ${esc(b.texto)}</p>`).join('')}</div>` : ''}
      ${cartaoJogo()}
      ${estado.times.map(t => `<div class="card"><span class="label">${esc(t.nome)}${t.tecnico ? ` · técnico ${esc(t.tecnico)}` : ''}</span>
        ${t.jogadores.map(a => `<div class="lineup-row ${falados.has(a.nome) ? 'hit' : ''}"><span class="pos">${esc(a.pos)}</span><span class="grow">${esc(a.nome)}</span>${a.titular ? '' : '<span class="tag under">entrou</span>'}</div>`).join('')}
        ${t.completos ? '' : '<p class="muted small" style="margin:8px 0 0">Pode faltar algum reserva que entrou.</p>'}</div>`).join('')}
      ${estado.curiosidade ? `<div class="fact">💡 ${esc(estado.curiosidade)}</div>` : ''}
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : '<p class="muted center">O anfitrião pode começar outra partida.</p>'}
      <a class="btn ghost" href="../">Voltar aos jogos</a>`);
    if (souHost) document.getElementById('denovo').onclick = voltarLobby;
  }
})();
