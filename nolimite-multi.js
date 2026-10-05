// No Limite — vários celulares. O anfitrião controla o jogo; cada um dá o palpite no próprio celular.
(function () {
  const C = window.Comum;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const PERGUNTAS = window.PERGUNTAS || [];
  const { pontuarRodada } = window.NoLimiteRegras;
  const TEMAS = [...new Set(PERGUNTAS.map(q => q.c))];
  const JOGO = 'nolimite';

  const fmtN = (n, u) => u === 'ano' ? String(n) : Number(n).toLocaleString('pt-BR');
  const render = html => { app.innerHTML = html; };

  let sala = null, souHost = false, estado = null, presentes = [];
  let meuPalpite = null, rodadaPalpite = null; // palpite enviado nesta rodada (tela do jogador)
  // Estado privado do anfitrião
  let H = null;
  // perguntas já vistas neste aparelho (mesma lista do modo um celular)
  const lerVistas = () => { try { return JSON.parse(localStorage.getItem('nolimite:vistas') || '[]'); } catch (e) { return []; } };
  const marcarVista = id => { const v = lerVistas(); if (!v.includes(id)) { v.push(id); try { localStorage.setItem('nolimite:vistas', JSON.stringify(v)); } catch (e) {} } };
  let mandouVistas = false;
  const enviarVistas = () => { if (sala) sala.enviar('vistas', { ids: lerVistas() }); };

  // ---------- entrada ----------
  Sala.telaEntrada(app, 'No Limite', 'nolimite.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    const iniciarH = () => {
      H = Sala.carregarHost(JOGO, codigo) || {
        cfg: { rodadas: 10, temas: TEMAS.slice() },
        fase: 'lobby', rodada: 0, jogadores: [], placar: {}, usadas: [], pergunta: null, palpites: {}, resultado: null, historico: []
      };
    };
    if (souHost) iniciarH();
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { if (!mandouVistas) { mandouVistas = true; enviarVistas(); } if (e.pergunta && e.pergunta.id) marcarVista(e.pergunta.id); if (e.fase === 'lobby' || e.rodada !== rodadaPalpite) meuPalpite = null; estado = e; desenhar(); },
      onAcao: acaoHost, snapshot: () => H,
      onVirarHost: h => { if (h) Sala.salvarHost(JOGO, codigo, h); souHost = true; iniciarH(); app.innerHTML = ''; toast('👑 O anfitrião saiu. Agora você é o anfitrião da sala.'); publicar(); },
      onDeixarHost: () => { souHost = false; rel.parar(); const b = document.getElementById('barraAusentes'); if (b) b.remove(); },
      onPresenca: lista => { presentes = lista; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { enviarVistas(); if (souHost) publicar(); else if (!estado) desenhar(); } if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') toast('Problema de conexão. Tentando de novo…'); }
    });
  });

  // ---------- anfitrião ----------
  function publico() {
    const q = H.pergunta;
    return {
      prazo: (H.fase !== 'lobby' && H.fase !== 'final' && H.prazo) || null,
      fase: H.fase, rodada: H.rodada, total: H.cfg.rodadas, cfg: H.cfg,
      jogadores: H.jogadores, placar: H.placar,
      pergunta: q ? { id: q.id, c: q.c, p: q.p, u: q.u } : null,
      respondeu: Object.fromEntries(Object.keys(H.palpites).map(k => [k, true])),
      revelado: H.fase === 'revelado' || H.fase === 'final' ? { r: q && q.r, i: q && q.i, resultado: H.resultado } : null,
      historico: H.fase === 'final' ? H.historico : null
    };
  }
  const rel = Sala.relogio(() => H, k => expirar(k));
  function publicar() {
    Sala.salvarHost(JOGO, sala.codigo, H);
    sala.publicar(publico()); if (souHost) rel.armar();
  }

  function sortear() {
    const vistas = new Set(H.vistasSala || []);
    const doTema = PERGUNTAS.filter(q => H.cfg.temas.includes(q.c));
    const novas = doTema.filter(q => !H.usadas.includes(q.id) && !vistas.has(q.id));
    const pool = novas.length ? novas : doTema.filter(q => !H.usadas.includes(q.id));
    const base = pool.length ? pool : doTema;
    const q = base[Math.floor(Math.random() * base.length)];
    H.usadas.push(q.id); marcarVista(q.id);
    return q;
  }

  function acaoHost(msg) {
    if (msg.tipo === 'vistas' && msg.dados && Array.isArray(msg.dados.ids)) {
      const v = new Set(H.vistasSala || []); msg.dados.ids.forEach(x => { if (Number.isInteger(x)) v.add(x); });
      H.vistasSala = [...v]; Sala.salvarHost(JOGO, sala.codigo, H); return;
    }
    if (msg.tipo === 'palpite' && H.fase === 'pergunta' && H.jogadores.some(j => j.id === msg.de)) {
      const v = Math.floor(Number(msg.dados.valor));
      if (Number.isFinite(v) && v >= 0) { H.palpites[msg.de] = v; publicar(); }
    }
  }

  function iniciar() {
    const lista = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (lista.length < 2) { toast('Precisa de pelo menos 2 pessoas na sala.'); return; }
    H.jogadores = lista; H.rkId = null;
    H.placar = Object.fromEntries(lista.map(j => [j.id, 0]));
    H.rodada = 0; H.historico = [];
    novaRodada();
  }
  function novaRodada() {
    H.rodada++; H.fase = 'pergunta'; H.palpites = {}; H.resultado = null;
    H.pergunta = sortear(); rel.novo('nl' + H.rodada + '-' + H.usadas.length);
    publicar();
  }
  function expirar() { if (H.fase === 'pergunta') revelar(); }
  function trocar() {
    if (Object.keys(H.palpites).length) { toast('Alguém já respondeu. Não dá mais para trocar.'); return; }
    H.pergunta = sortear(); rel.novo('nl' + H.rodada + '-' + H.usadas.length); publicar();
  }
  function revelar() {
    const q = H.pergunta;
    rel.limpar();
    const res = pontuarRodada(q.r, H.jogadores.map(j => ({ jogador: j.id, valor: H.palpites[j.id] === undefined ? null : H.palpites[j.id] })));
    res.forEach(r => { H.placar[r.jogador] += r.pontos; r.nome = (H.jogadores.find(j => j.id === r.jogador) || {}).nome; });
    H.resultado = res;
    H.historico.push({ p: q.p, r: q.r, u: q.u, res });
    H.fase = 'revelado';
    publicar();
  }
  function proxima() {
    if (H.rodada >= H.cfg.rodadas) { H.fase = 'final'; publicar(); return; }
    novaRodada();
  }
  function voltarLobby() { H.fase = 'lobby'; H.pergunta = null; H.palpites = {}; publicar(); }

  // ---------- telas ----------
  const nomeDe = id => ((estado && estado.jogadores || []).find(j => j.id === id) || presentes.find(j => j.id === id) || {}).nome || '?';
  const souJogador = () => estado && estado.jogadores.some(j => j.id === sala.id);

  function topo(extra) {
    return `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="nolimite.html">Sair</a></div>`;
  }

  function desenhar() {
    Sala.mostrarPrazo(estado && estado.prazo);
    // preserva o que a pessoa estava digitando quando chega uma atualização
    const antes = document.getElementById('palpite');
    const valor = antes ? antes.value : null, foco = antes && document.activeElement === antes;
    desenhar0();
    const depois = document.getElementById('palpite');
    if (depois && valor) { depois.value = valor; depois.dispatchEvent(new Event('input')); }
    if (depois && foco) depois.focus();
  }
  function desenhar0() {
    if (!estado) { render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`); return; }
    if (estado.fase === 'lobby') return telaLobby();
    if (estado.fase === 'pergunta') return telaPergunta();
    if (estado.fase === 'revelado') return telaRevelado();
    if (estado.fase === 'final') return telaFinal();
  }

  function telaLobby() {
    const cfg = estado.cfg;
    render(`
      ${topo('No Limite')}
      ${Sala.htmlCodigo(sala.codigo)}
      ${Sala.htmlJogadores(presentes, sala.id)}${Sala.htmlTreino(!!(estado.cfg && estado.cfg.treino), souHost)}${Sala.htmlTimer(!(estado.cfg && estado.cfg.timer === false), souHost)}
      ${souHost ? `
        <div class="card">
          <span class="label">Número de rodadas</span>
          <div class="chips">${[5, 10, 15, 20].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}</div>
          <span class="label" style="margin-top:14px">Temas</span>
          <div class="chips">${TEMAS.map(t => `<button class="chip ${cfg.temas.includes(t) ? 'on' : ''}" data-tema="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        </div>
        <button class="btn" id="comecar" ${presentes.length >= 2 ? '' : 'disabled'}>Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>
      ` : `<p class="muted center">O anfitrião vai começar o jogo. ${cfg.rodadas} rodadas.</p>`}
    `);
    Sala.ligarCodigo(sala.codigo);
    if (souHost) Sala.ligarTreino(() => { H.cfg.treino = !H.cfg.treino; publicar(); });
    if (souHost) Sala.ligarTimer(() => { H.cfg.timer = H.cfg.timer === false; publicar(); });
    if (!souHost) return;
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { H.cfg.rodadas = +b.dataset.rod; publicar(); });
    app.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => {
      const t = b.dataset.tema; const at = H.cfg.temas;
      H.cfg.temas = at.includes(t) ? at.filter(x => x !== t) : [...at, t];
      if (!H.cfg.temas.length) H.cfg.temas = [t];
      publicar();
    });
    document.getElementById('comecar').onclick = iniciar;
  }

  function blocoPergunta(q) {
    return `<div class="card"><span class="pill theme">${esc(q.c)}</span><div class="question">${esc(q.p)}</div>${q.u ? `<div class="unit">Resposta em: ${esc(q.u)}</div>` : ''}</div>`;
  }

  function statusRespostas() {
    return `<div class="chips" style="justify-content:center;margin:12px 0">${estado.jogadores.map(j => `<span class="chip ${estado.respondeu[j.id] ? 'on' : ''}">${estado.respondeu[j.id] ? '✅' : '⏳'} ${esc(j.nome)}</span>`).join('')}</div>`;
  }

  function telaPergunta() {
    const q = estado.pergunta;
    const respondi = estado.respondeu[sala.id];
    const todos = estado.jogadores.every(j => estado.respondeu[j.id]);
    const n = Object.keys(estado.respondeu).length;
    render(`
      ${topo(`Rodada ${estado.rodada}/${estado.total}`)}
      ${blocoPergunta(q)}
      ${!souJogador() ? '<p class="muted center">Você está assistindo esta partida.</p>' : respondi ? `
        <div class="card center"><div class="muted small">Seu palpite</div><div class="answer-num" id="meuNum" style="font-size:2.6rem">🔒</div><div class="muted small">Enviado e escondido para ninguém ver.</div>${meuPalpite !== null ? '<button type="button" class="btn ghost small" id="verMeu" style="margin-top:8px">👁 Segure para ver</button>' : ''}<div class="muted small" style="margin-top:6px">Aguardando os outros…</div></div>
      ` : `
        <form id="fp">
          <input class="guess-input oculto" id="palpite" type="text" inputmode="numeric" autocomplete="off" placeholder="0"><button type="button" class="btn ghost small" id="olhoPalpite" style="margin:6px 0 10px">👁 Segure para ver o que digitou</button>
          <button class="btn" type="submit" id="confirmar" disabled>Confirmar palpite</button>
        </form>`}
      ${statusRespostas()}
      ${souHost ? `
        <button class="btn ${todos ? '' : 'secondary'}" id="revelar" ${n ? '' : 'disabled'}>${todos ? 'Revelar resposta' : `Revelar agora (${n}/${estado.jogadores.length} responderam)`}</button>
        ${n ? '' : '<button class="btn ghost" id="trocar">🔄 Já conhecemos essa, sortear outra</button>'}
      ` : ''}
    `);
    // palpite escondido (tela ao lado não vê): segura o botão para mostrar
    const segurar = (btn, on, off) => { if (!btn) return; ['pointerdown'].forEach(ev => btn.addEventListener(ev, e => { e.preventDefault(); on(); })); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, off)); };
    const num = document.getElementById('meuNum');
    segurar(document.getElementById('verMeu'), () => { num.textContent = fmtN(meuPalpite, q.u); }, () => { num.textContent = '🔒'; });
    const inp = document.getElementById('palpite');
    segurar(document.getElementById('olhoPalpite'), () => inp.classList.remove('oculto'), () => inp.classList.add('oculto'));
    if (inp) {
      const btn = document.getElementById('confirmar');
      inp.oninput = () => {
        const d = inp.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
        inp.value = d ? fmtN(d, q.u) : ''; btn.disabled = !d;
      };
      document.getElementById('fp').onsubmit = e => {
        e.preventDefault();
        const d = inp.value.replace(/\D/g, ''); if (!d) return;
        meuPalpite = Number(d); rodadaPalpite = estado.rodada;
        sala.enviar('palpite', { valor: meuPalpite });
        // feedback imediato enquanto o anfitrião confirma
        estado.respondeu[sala.id] = true; telaPergunta();
      };
    }
    if (souHost) {
      const r = document.getElementById('revelar'); if (r) r.onclick = revelar;
      const t = document.getElementById('trocar'); if (t) t.onclick = trocar;
    }
  }

  function tabelaPlacar(res) {
    const ganhou = res ? Object.fromEntries(res.map(r => [r.jogador, r.pontos])) : {};
    const rank = estado.jogadores.map(j => [j.id, estado.placar[j.id] || 0]).sort((a, b) => b[1] - a[1]);
    const top = rank.length ? rank[0][1] : 0;
    return `<table class="score">${rank.map(([id, p]) => `<tr class="${p === top && p > 0 ? 'lead' : ''}"><td>${esc(nomeDe(id))}${id === sala.id ? ' <span class="muted small">(você)</span>' : ''}${ganhou[id] ? `<span class="delta">+${ganhou[id]}</span>` : ''}</td><td>${C.plural(p, 'pt')}</td></tr>`).join('')}</table>`;
  }

  function telaRevelado() {
    const q = estado.pergunta, rv = estado.revelado;
    const ordem = { exact: 0, close: 1, under: 2, bust: 3, tempo: 4 };
    const lista = rv.resultado.slice().sort((a, b) => ordem[a.status] - ordem[b.status] || a.distancia - b.distancia);
    const tag = { exact: '🎯 CRAVOU', close: '✅ MAIS PERTO', under: 'abaixo', bust: '💥 ESTOUROU', tempo: '⏱️ SEM TEMPO' };
    const ultima = estado.rodada >= estado.total;
    render(`
      ${topo(`Rodada ${estado.rodada}/${estado.total}`)}
      <div class="card">${`<span class="pill theme">${esc(q.c)}</span><div class="question">${esc(q.p)}</div>`}
        <div class="answer-box"><div class="answer-num">${fmtN(rv.r, q.u)}</div>${q.u ? `<div class="unit">${esc(q.u)}</div>` : ''}${rv.i ? `<div class="fact">💡 ${esc(rv.i)}</div>` : ''}</div>
      </div>
      <div class="card"><span class="label">Palpites</span>
        ${lista.map((r, i) => `<div class="result ${r.status}" style="animation-delay:${i * 0.1}s"><span class="who">${esc(r.nome)}<br><span class="tag ${r.status}">${tag[r.status]}</span></span><span class="val">${r.valor == null ? '—' : fmtN(r.valor, q.u)}</span><span class="pts">${r.pontos ? '+' + r.pontos : '0'}</span></div>`).join('')}
        ${lista.every(r => !r.pontos) ? '<p class="muted small center">Ninguém ficou abaixo da resposta. Ninguém pontua.</p>' : ''}
      </div>
      <div class="card"><span class="label">Placar</span>${tabelaPlacar(rv.resultado)}</div>
      ${souHost ? `<button class="btn" id="prox">${ultima ? '🏆 Ver campeão' : 'Próxima rodada'}</button>` : '<p class="muted center">Aguardando o anfitrião…</p>'}
    `);
    if (souHost) document.getElementById('prox').onclick = proxima;
  }

const tbNL = (hist, campo) => { const t = {}; (hist || []).forEach(h => (h[campo] || []).forEach(r => { const x = t[r.jogador] = t[r.jogador] || [0, 0, 0]; if (r.status === 'exact') x[0]++; if (r.status === 'close') x[1]++; if (r.status === 'bust') x[2]--; })); return t; };
  function telaFinal() {
    const tbs = tbNL(estado.historico, 'res');
    const cl = C.classificar(estado.jogadores.map(j => ({ nome: j.nome, pts: estado.placar[j.id] || 0, tb: tbs[j.id] || [] })), ['cravar mais vezes', 'ficar mais vezes com o palpite mais perto', 'estourar menos vezes']);
    const rank = cl.rank, camp = cl.camp;
    if (souHost) window.Ranking && Ranking.registrar(H, 'nolimite-sala', rank.map(r => r[0]), camp);
    render(`
      <div class="center" style="margin-top:10px"><div class="trophy">🏆</div>
        <p class="muted" style="margin:6px 0 0">${camp.length > 1 ? 'Empate! Campeões da vez' : 'Campeão da vez'}</p>
        <h1 class="logo" style="font-size:2.4rem">${camp.map(esc).join(' & ')}</h1></div>
      ${C.htmlDesempate(cl.motivo)}
      ${C.htmlPodio(rank)}
      <div class="card"><span class="label">Classificação final</span>${tabelaPlacar()}</div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : '<p class="muted center">O anfitrião pode começar outra partida.</p>'}
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>
    `);
    if (souHost) document.getElementById('denovo').onclick = voltarLobby;
  }
})();
