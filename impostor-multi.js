// Impostor — vários celulares. Cada um vê a própria palavra e vota no próprio celular.
(function () {
  const C = window.Comum;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const BANCO = window.PALAVRAS_IMPOSTOR || [];
  const JOGO = 'impostor';
  const CATS = g => [...new Set(BANCO.filter(q => q.g === g).map(q => q.c))];
  const render = html => { app.innerHTML = html; };

  let sala = null, souHost = false, estado = null, presentes = [], carta = null, cartaAberta = false, meuVoto = null;
  let H = null;

  Sala.telaEntrada(app, 'Impostor', 'impostor.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    if (souHost) {
      H = Sala.carregarHost(JOGO, codigo) || {
        cfg: { grupo: 'Futebol', cats: CATS('Futebol'), modo: 'dica', impostores: 1, rodadas: 2 },
        fase: 'lobby', jogadores: [], placar: {}, usadas: [], partida: 0
      };
    }
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => {
        if (!estado || e.partida !== estado.partida) { cartaAberta = false; meuVoto = null; if (estado) carta = null; }
        if (estado && e.votacaoId !== estado.votacaoId) meuVoto = null;
        estado = e; desenhar();
      },
      onPrivado: d => { carta = d; desenhar(); },
      onAcao: souHost ? acaoHost : null,
      onPresenca: lista => { presentes = lista; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) { publicar(); reenviarCartas(); } else if (!estado) desenhar(); } if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') toast('Problema de conexão. Tentando de novo…'); }
    });
  });

  // ---------- anfitrião ----------
  const nomeId = id => ((H && H.jogadores) || []).find(j => j.id === id)?.nome || '?';
  function publico() {
    const fim = H.fase === 'fim';
    return {
      fase: H.fase, partida: H.partida, cfg: H.cfg, jogadores: H.jogadores, placar: H.placar,
      vivos: H.vivos || [], ordem: H.ordem || [], rodadaFala: H.rodadaFala, rodadasAlvo: H.rodadasAlvo,
      pegos: H.pegos || [], votacaoId: H.votacaoId || 0,
      votaram: Object.fromEntries(Object.keys(H.votos || {}).map(k => [k, true])),
      viram: H.viram || {},
      apuracao: H.apuracao || null,
      fim: fim ? H.fim : null
    };
  }
  function publicar() { Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); }
  function reenviarCartas() { if (H && H.cartas) Object.entries(H.cartas).forEach(([id, c]) => sala.privado(id, c)); }

  function acaoHost(msg) {
    if (msg.tipo === 'vi' && H.fase === 'cartas') { H.viram[msg.de] = true; publicar(); }
    if (msg.tipo === 'voto' && H.fase === 'votacao' && H.vivos.includes(msg.de) && H.vivos.includes(msg.dados.em) && msg.dados.em !== msg.de) {
      H.votos[msg.de] = msg.dados.em;
      if (H.vivos.every(v => H.votos[v])) apurar(); else publicar();
    }
  }

  function sortearPalavra() {
    const doTema = BANCO.filter(q => q.g === H.cfg.grupo && H.cfg.cats.includes(q.c));
    let pool = doTema.filter(q => !H.usadas.includes(q.p));
    if (!pool.length) { H.usadas = []; pool = doTema; }
    const q = pool[Math.floor(Math.random() * pool.length)];
    H.usadas.push(q.p);
    return q;
  }

  function iniciar() {
    const lista = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (lista.length < 3) { toast('Precisa de pelo menos 3 pessoas na sala.'); return; }
    const maxImp = Math.max(1, Math.floor((lista.length - 1) / 2));
    const nImp = Math.min(H.cfg.impostores, maxImp);
    H.jogadores = lista;
    lista.forEach(j => { if (H.placar[j.id] === undefined) H.placar[j.id] = 0; });
    H.partida++;
    H.palavra = sortearPalavra();
    H.impostores = C.shuffle(lista.map(j => j.id)).slice(0, nImp);
    H.vivos = lista.map(j => j.id);
    const ini = Math.floor(Math.random() * lista.length);
    const ids = lista.map(j => j.id);
    H.ordem = ids.slice(ini).concat(ids.slice(0, ini));
    H.rodadaFala = 1; H.rodadasAlvo = H.cfg.rodadas; H.pegos = [];
    H.votos = {}; H.viram = {}; H.apuracao = null; H.fim = null; H.votacaoId = 0;
    H.cartas = {};
    const q = H.palavra;
    lista.forEach(j => {
      const imp = H.impostores.includes(j.id);
      H.cartas[j.id] = !imp ? { tipo: 'normal', palavra: q.p, c: q.c }
        : H.cfg.modo === 'parecida' ? { tipo: 'normal', palavra: q.s, c: q.c }
        : { tipo: 'impostor', dica: q.d, c: q.c, qtd: nImp };
    });
    sala.limparPrivados();
    H.fase = 'cartas';
    publicar();
    reenviarCartas();
  }

  function irPistas() { H.fase = 'pistas'; publicar(); }
  function proximaRodadaPistas() {
    if (H.rodadaFala < H.rodadasAlvo) { H.rodadaFala++; publicar(); }
    else abrirVotacao();
  }
  function abrirVotacao() { H.fase = 'votacao'; H.votos = {}; H.votacaoId = (H.votacaoId || 0) + 1; H.apuracao = null; publicar(); }

  function apurar() {
    const cont = {};
    Object.values(H.votos).forEach(v => cont[v] = (cont[v] || 0) + 1);
    const max = Math.max(...Object.values(cont));
    const top = Object.keys(cont).filter(k => cont[k] === max);
    const acusado = top.length === 1 ? top[0] : null;
    H.apuracao = {
      cont: Object.entries(cont).map(([id, n]) => ({ nome: nomeId(id), n })).sort((a, b) => b.n - a.n),
      votos: Object.entries(H.votos).map(([e, v]) => ({ de: nomeId(e), em: nomeId(v) })),
      acusado: acusado ? nomeId(acusado) : null,
      era: acusado ? H.impostores.includes(acusado) : null,
      empate: !acusado
    };
    H.fase = 'apuracao';
    if (!acusado) return fim(false, 'Deu empate na votação: ninguém foi pego.');
    if (!H.impostores.includes(acusado)) return fim(false, `${nomeId(acusado)} era inocente!`);
    H.vivos = H.vivos.filter(v => v !== acusado);
    H.pegos.push(nomeId(acusado));
    const restantes = H.impostores.filter(i => H.vivos.includes(i));
    if (!restantes.length) return fim(true, H.impostores.length > 1 ? 'Pegaram todos os impostores!' : 'Pegaram o impostor!');
    if (restantes.length >= H.vivos.length - restantes.length) return fim(false, 'Os impostores agora são maioria.');
    H.apuracao.restantes = restantes.length;
    publicar();
  }
  function seguirDepoisDePegar() { H.rodadaFala = 1; H.rodadasAlvo = 1; H.fase = 'pistas'; publicar(); }

  function fim(inocentes, motivo) {
    const q = H.palavra;
    if (inocentes) H.jogadores.filter(j => !H.impostores.includes(j.id)).forEach(j => H.placar[j.id] += 1);
    else H.impostores.forEach(i => H.placar[i] += 2);
    H.fim = { inocentes, motivo, palavra: q.p, parecida: q.s, dica: q.d, modo: H.cfg.modo, impostores: H.impostores.map(nomeId) };
    H.fase = 'fim';
    publicar();
  }
  function voltarLobby() { H.fase = 'lobby'; H.cartas = null; sala.limparPrivados(); publicar(); }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="impostor.html">Sair</a></div>`;
  const nomeDe = id => ((estado && estado.jogadores) || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const participo = () => estado && estado.jogadores.some(j => j.id === sala.id);
  const vivo = () => estado && estado.vivos.includes(sala.id);

  function desenhar() {
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    ({ lobby: telaLobby, cartas: telaCarta, pistas: telaPistas, votacao: telaVotacao, apuracao: telaApuracao, fim: telaFim })[estado.fase]();
  }

  function telaLobby() {
    const cfg = estado.cfg;
    const maxImp = Math.max(1, Math.floor((presentes.length - 1) / 2));
    const opt = (key, val, label, desc) => `<button class="list-opt ${cfg[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}"><strong>${label}</strong>${desc ? `<span class="muted small">${desc}</span>` : ''}</button>`;
    render(`
      ${topo('Impostor')}
      ${Sala.htmlCodigo(sala.codigo)}
      ${Sala.htmlJogadores(presentes, sala.id)}
      ${Object.keys(estado.placar || {}).length ? `<div class="card"><span class="label">Placar da noite</span>${tabelaPlacar()}</div>` : ''}
      ${souHost ? `
        <div class="card">
          <span class="label">Tema</span>
          <div class="chips" style="margin-bottom:12px">
            <button class="chip ${cfg.grupo === 'Futebol' ? 'on' : ''}" data-grupo="Futebol">⚽ Futebol</button>
            <button class="chip ${cfg.grupo === 'Geral' ? 'on' : ''}" data-grupo="Geral">🌎 Geral</button>
          </div>
          <div class="chips">${CATS(cfg.grupo).map(c => `<button class="chip ${cfg.cats.includes(c) ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        </div>
        <div class="card">
          <span class="label">O que o impostor recebe</span>
          ${opt('modo', 'dica', '🕵️ Uma dica', 'Ele sabe que é o impostor.')}
          ${opt('modo', 'parecida', '🎭 Uma palavra parecida', 'Ele NÃO sabe que é o impostor.')}
          <span class="label" style="margin-top:12px">Impostores</span>
          <div class="chips" style="margin-bottom:12px">${[1, 2, 3].map(n => `<button class="chip ${cfg.impostores === n ? 'on' : ''}" data-imp="${n}" ${n > maxImp ? 'disabled style="opacity:.3"' : ''}>${n}</button>`).join('')}</div>
          <span class="label">Rodadas de pistas antes de votar</span>
          <div class="chips">${[1, 2, 3].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}</div>
        </div>
        <button class="btn" id="comecar" ${presentes.length >= 3 ? '' : 'disabled'}>Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>
        ${presentes.length < 3 ? '<p class="muted small center">Mínimo de 3 pessoas.</p>' : ''}
      ` : `<p class="muted center">O anfitrião vai começar a partida.</p>`}
    `);
    Sala.ligarCodigo(sala.codigo);
    if (!souHost) return;
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { H.cfg[b.dataset.k] = b.dataset.v; publicar(); });
    app.querySelectorAll('[data-grupo]').forEach(b => b.onclick = () => { H.cfg.grupo = b.dataset.grupo; H.cfg.cats = CATS(H.cfg.grupo); publicar(); });
    app.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
      const c = b.dataset.cat; let at = H.cfg.cats;
      at = at.includes(c) ? at.filter(x => x !== c) : [...at, c];
      if (!at.length) { toast('Deixe pelo menos uma categoria.'); return; }
      H.cfg.cats = at; publicar();
    });
    app.querySelectorAll('[data-imp]').forEach(b => b.onclick = () => { if (!b.disabled) { H.cfg.impostores = +b.dataset.imp; publicar(); } });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { H.cfg.rodadas = +b.dataset.rod; publicar(); });
    document.getElementById('comecar').onclick = iniciar;
  }

  function htmlCarta() {
    if (!carta) return '<p class="muted center">Recebendo sua carta…</p>';
    if (carta.tipo === 'impostor') return `<div class="secret imp"><div class="secret-word" style="color:var(--accent)">Você é o IMPOSTOR</div>
      ${carta.qtd > 1 ? `<div class="muted small">Tem ${carta.qtd} impostores nesta partida.</div>` : ''}
      <div style="margin-top:14px" class="muted small">Dica</div><div style="font-size:1.3rem;font-weight:800">${esc(carta.dica)}</div>
      <div class="muted small" style="margin-top:6px">${esc(carta.c)}</div></div>`;
    return `<div class="secret"><div class="muted small">A palavra é</div><div class="secret-word">${esc(carta.palavra)}</div><div class="muted small">${esc(carta.c)}</div></div>`;
  }

  function cartaCard() {
    return `<div class="card" id="carta" style="min-height:220px;display:grid;place-items:center;cursor:pointer;text-align:center">
      ${cartaAberta ? htmlCarta() : '<div><div class="emoji" style="font-size:3rem">👆</div><strong>Toque para ver sua palavra</strong><div class="muted small">Não deixe ninguém ver</div></div>'}
    </div>`;
  }
  function ligarCarta() {
    const c = document.getElementById('carta');
    if (c) c.onclick = () => { cartaAberta = !cartaAberta; if (cartaAberta && estado.fase === 'cartas') sala.enviar('vi'); desenhar(); };
  }

  function telaCarta() {
    const faltam = estado.jogadores.filter(j => !estado.viram[j.id]);
    render(`
      ${topo(`Partida ${estado.partida}`)}
      ${participo() ? cartaCard() + '<p class="muted small center">Toque de novo para esconder.</p>' : '<p class="muted center">Você está assistindo esta partida.</p>'}
      <div class="chips" style="justify-content:center;margin:12px 0">${estado.jogadores.map(j => `<span class="chip ${estado.viram[j.id] ? 'on' : ''}">${estado.viram[j.id] ? '👀' : '⏳'} ${esc(j.nome)}</span>`).join('')}</div>
      ${souHost ? `<button class="btn ${faltam.length ? 'secondary' : ''}" id="ir">${faltam.length ? `Começar as pistas (${faltam.length} ainda não viu)` : 'Todos viram. Começar as pistas'}</button>` : ''}
    `);
    ligarCarta();
    if (souHost) document.getElementById('ir').onclick = irPistas;
  }

  function telaPistas() {
    const ordem = estado.ordem.filter(id => estado.vivos.includes(id));
    render(`
      ${topo(`Pistas ${estado.rodadaFala}/${estado.rodadasAlvo}`)}
      <div class="card center"><div class="emoji" style="font-size:2.2rem">🗣️</div><h2 style="margin:6px 0">Cada um fala UMA palavra</h2><p class="muted small" style="margin:0">Em voz alta, nesta ordem:</p></div>
      <div class="card">${ordem.map((id, i) => `<div class="lineup-row"><span class="pos">${i + 1}º</span><span class="grow"><strong>${esc(nomeDe(id))}</strong>${id === sala.id ? ' <span class="muted small">(você)</span>' : ''}</span></div>`).join('')}</div>
      ${estado.pegos.length ? `<p class="muted small center">Fora: ${estado.pegos.map(esc).join(', ')} (impostor pego)</p>` : ''}
      ${participo() ? cartaCard() : ''}
      ${souHost ? `<button class="btn" id="fim">${estado.rodadaFala < estado.rodadasAlvo ? 'Todos falaram, próxima rodada' : 'Todos falaram, abrir votação'}</button>` : '<p class="muted center">O anfitrião avança quando todos falarem.</p>'}
    `);
    ligarCarta();
    if (souHost) document.getElementById('fim').onclick = proximaRodadaPistas;
  }

  function telaVotacao() {
    const ops = estado.vivos.filter(id => id !== sala.id);
    const jaVotei = estado.votaram[sala.id] || meuVoto;
    render(`
      ${topo('Votação')}
      <h2 class="center" style="margin:10px 0 6px">Quem é o impostor?</h2>
      <p class="muted small center" style="margin-top:0">Voto secreto. Empate = o impostor escapa.</p>
      ${!vivo() ? '<p class="muted center">Você não vota nesta rodada.</p>' : jaVotei
        ? `<div class="card center"><div class="muted small">Seu voto</div><div style="font-size:1.6rem;font-weight:800">${esc(meuVoto ? nomeDe(meuVoto) : '✔')}</div><div class="muted small">Aguardando os outros…</div></div>`
        : ops.map(id => `<button class="btn secondary" data-voto="${esc(id)}">${esc(nomeDe(id))}</button>`).join('')}
      <div class="chips" style="justify-content:center;margin:14px 0">${estado.vivos.map(id => `<span class="chip ${estado.votaram[id] ? 'on' : ''}">${estado.votaram[id] ? '🗳️' : '⏳'} ${esc(nomeDe(id))}</span>`).join('')}</div>
    `);
    app.querySelectorAll('[data-voto]').forEach(b => b.onclick = () => { meuVoto = b.dataset.voto; sala.enviar('voto', { em: meuVoto }); estado.votaram[sala.id] = true; telaVotacao(); });
  }

  function blocoVotos(a) {
    return `<div class="card"><span class="label">Votos</span>
      <table class="score">${a.cont.map(c => `<tr class="${c.nome === a.acusado ? 'lead' : ''}"><td>${esc(c.nome)}</td><td>${C.plural(c.n, 'voto')}</td></tr>`).join('')}</table>
      <details style="margin-top:10px"><summary class="muted small">Ver quem votou em quem</summary>${a.votos.map(v => `<p class="small" style="margin:4px 0">${esc(v.de)} → ${esc(v.em)}</p>`).join('')}</details></div>`;
  }

  function telaApuracao() {
    const a = estado.apuracao;
    render(`
      ${topo('Apuração')}
      <div class="pass" style="padding-bottom:10px"><div class="emoji">🎯</div><div class="big-name" style="font-size:2rem">${esc(a.acusado)} era impostor!</div>
        <p class="muted">Ainda tem ${C.plural(a.restantes, 'impostor', 'impostores')} entre vocês. Mais uma rodada de pistas.</p></div>
      ${blocoVotos(a)}
      ${souHost ? '<button class="btn" id="seguir">Seguir</button>' : '<p class="muted center">Aguardando o anfitrião…</p>'}
    `);
    if (souHost) document.getElementById('seguir').onclick = seguirDepoisDePegar;
  }

  function tabelaPlacar() {
    const rank = Object.entries(estado.placar || {}).map(([id, p]) => [nomeDe(id), p]).sort((a, b) => b[1] - a[1]);
    return `<table class="score">${rank.map(([n, p]) => `<tr><td>${esc(n)}</td><td>${C.plural(p, 'pt')}</td></tr>`).join('')}</table>`;
  }

  function telaFim() {
    const f = estado.fim;
    render(`
      <div class="center" style="margin-top:10px"><div class="trophy">${f.inocentes ? '🎉' : '🕵️'}</div>
        <p class="muted" style="margin:6px 0 0">${esc(f.motivo)}</p>
        <h1 class="logo" style="font-size:2.2rem">${f.inocentes ? 'Inocentes venceram' : (f.impostores.length > 1 ? 'Impostores venceram' : 'Impostor venceu')}</h1></div>
      <div class="card center"><div class="muted small">A palavra era</div><div class="secret-word">${esc(f.palavra)}</div>
        <div class="muted small">${f.modo === 'parecida' ? `O impostor recebeu: <strong>${esc(f.parecida)}</strong>` : `Dica do impostor: <strong>${esc(f.dica)}</strong>`}</div>
        <p style="margin:14px 0 0">${f.impostores.length > 1 ? 'Impostores' : 'Impostor'}: <strong>${f.impostores.map(esc).join(' e ')}</strong></p></div>
      ${estado.apuracao ? blocoVotos(estado.apuracao) : ''}
      <div class="card"><span class="label">Placar da noite</span>${tabelaPlacar()}<p class="muted small" style="margin:10px 0 0">Inocente +1 quando o grupo vence. Impostor +2.</p></div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida</button><button class="btn secondary" id="lobby">Mudar tema / configurações</button>' : '<p class="muted center">O anfitrião começa a próxima.</p>'}
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>
    `);
    if (souHost) { document.getElementById('denovo').onclick = iniciar; document.getElementById('lobby').onclick = voltarLobby; }
  }
})();
