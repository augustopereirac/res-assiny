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

  // ---------- entrada ----------
  Sala.telaEntrada(app, 'No Limite', 'nolimite.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    if (souHost) {
      H = Sala.carregarHost(JOGO, codigo) || {
        cfg: { rodadas: 10, temas: TEMAS.slice() },
        fase: 'lobby', rodada: 0, jogadores: [], placar: {}, usadas: [], pergunta: null, palpites: {}, resultado: null, historico: []
      };
    }
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { if (e.fase === 'lobby' || e.rodada !== rodadaPalpite) meuPalpite = null; estado = e; desenhar(); },
      onAcao: souHost ? acaoHost : null,
      onPresenca: lista => { presentes = lista; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) publicar(); else if (!estado) desenhar(); } if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') toast('Problema de conexão. Tentando de novo…'); }
    });
  });

  // ---------- anfitrião ----------
  function publico() {
    const q = H.pergunta;
    return {
      fase: H.fase, rodada: H.rodada, total: H.cfg.rodadas, cfg: H.cfg,
      jogadores: H.jogadores, placar: H.placar,
      pergunta: q ? { c: q.c, p: q.p, u: q.u } : null,
      respondeu: Object.fromEntries(Object.keys(H.palpites).map(k => [k, true])),
      revelado: H.fase === 'revelado' || H.fase === 'final' ? { r: q && q.r, i: q && q.i, resultado: H.resultado } : null,
      historico: H.fase === 'final' ? H.historico : null
    };
  }
  function publicar() {
    Sala.salvarHost(JOGO, sala.codigo, H);
    sala.publicar(publico());
  }

  function sortear() {
    const pool = PERGUNTAS.filter(q => H.cfg.temas.includes(q.c) && !H.usadas.includes(q.id));
    const base = pool.length ? pool : PERGUNTAS.filter(q => H.cfg.temas.includes(q.c));
    const q = base[Math.floor(Math.random() * base.length)];
    H.usadas.push(q.id);
    return q;
  }

  function acaoHost(msg) {
    if (msg.tipo === 'palpite' && H.fase === 'pergunta' && H.jogadores.some(j => j.id === msg.de)) {
      const v = Math.floor(Number(msg.dados.valor));
      if (Number.isFinite(v) && v >= 0) { H.palpites[msg.de] = v; publicar(); }
    }
  }

  function iniciar() {
    const lista = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (lista.length < 2) { toast('Precisa de pelo menos 2 pessoas na sala.'); return; }
    H.jogadores = lista;
    H.placar = Object.fromEntries(lista.map(j => [j.id, 0]));
    H.rodada = 0; H.historico = [];
    novaRodada();
  }
  function novaRodada() {
    H.rodada++; H.fase = 'pergunta'; H.palpites = {}; H.resultado = null;
    H.pergunta = sortear();
    publicar();
  }
  function trocar() {
    if (Object.keys(H.palpites).length) { toast('Alguém já respondeu. Não dá mais para trocar.'); return; }
    H.pergunta = sortear(); publicar();
  }
  function revelar() {
    const q = H.pergunta;
    const quem = H.jogadores.filter(j => H.palpites[j.id] !== undefined);
    const res = pontuarRodada(q.r, quem.map(j => ({ jogador: j.id, valor: H.palpites[j.id] })));
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
      ${Sala.htmlJogadores(presentes, sala.id)}
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
        <div class="card center"><div class="muted small">Seu palpite</div><div class="answer-num" style="font-size:2.6rem">${meuPalpite !== null ? fmtN(meuPalpite, q.u) : '✔'}</div><div class="muted small">Aguardando os outros…</div></div>
      ` : `
        <form id="fp">
          <input class="guess-input" id="palpite" type="text" inputmode="numeric" autocomplete="off" placeholder="0">
          <button class="btn" type="submit" id="confirmar" disabled>Confirmar palpite</button>
        </form>`}
      ${statusRespostas()}
      ${souHost ? `
        <button class="btn ${todos ? '' : 'secondary'}" id="revelar" ${n ? '' : 'disabled'}>${todos ? 'Revelar resposta' : `Revelar agora (${n}/${estado.jogadores.length} responderam)`}</button>
        ${n ? '' : '<button class="btn ghost" id="trocar">🔄 Já conhecemos essa, sortear outra</button>'}
      ` : ''}
    `);
    const inp = document.getElementById('palpite');
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
    const ordem = { exact: 0, close: 1, under: 2, bust: 3 };
    const lista = rv.resultado.slice().sort((a, b) => ordem[a.status] - ordem[b.status] || a.distancia - b.distancia);
    const tag = { exact: '🎯 CRAVOU', close: '✅ MAIS PERTO', under: 'abaixo', bust: '💥 ESTOUROU' };
    const ultima = estado.rodada >= estado.total;
    render(`
      ${topo(`Rodada ${estado.rodada}/${estado.total}`)}
      <div class="card">${`<span class="pill theme">${esc(q.c)}</span><div class="question">${esc(q.p)}</div>`}
        <div class="answer-box"><div class="answer-num">${fmtN(rv.r, q.u)}</div>${q.u ? `<div class="unit">${esc(q.u)}</div>` : ''}${rv.i ? `<div class="fact">💡 ${esc(rv.i)}</div>` : ''}</div>
      </div>
      <div class="card"><span class="label">Palpites</span>
        ${lista.map((r, i) => `<div class="result ${r.status}" style="animation-delay:${i * 0.1}s"><span class="who">${esc(r.nome)}<br><span class="tag ${r.status}">${tag[r.status]}</span></span><span class="val">${fmtN(r.valor, q.u)}</span><span class="pts">${r.pontos ? '+' + r.pontos : '0'}</span></div>`).join('')}
        ${lista.every(r => !r.pontos) ? '<p class="muted small center">Todo mundo estourou. Ninguém pontua.</p>' : ''}
      </div>
      <div class="card"><span class="label">Placar</span>${tabelaPlacar(rv.resultado)}</div>
      ${souHost ? `<button class="btn" id="prox">${ultima ? '🏆 Ver campeão' : 'Próxima rodada'}</button>` : '<p class="muted center">Aguardando o anfitrião…</p>'}
    `);
    if (souHost) document.getElementById('prox').onclick = proxima;
  }

  function telaFinal() {
    const rank = estado.jogadores.map(j => [j.nome, estado.placar[j.id] || 0]).sort((a, b) => b[1] - a[1]);
    const top = rank[0][1];
    const camp = rank.filter(r => r[1] === top).map(r => r[0]);
    render(`
      <div class="center" style="margin-top:10px"><div class="trophy">🏆</div>
        <p class="muted" style="margin:6px 0 0">${camp.length > 1 ? 'Empate! Campeões da vez' : 'Campeão da vez'}</p>
        <h1 class="logo" style="font-size:2.4rem">${camp.map(esc).join(' & ')}</h1></div>
      ${C.htmlPodio(rank)}
      <div class="card"><span class="label">Classificação final</span>${tabelaPlacar()}</div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : '<p class="muted center">O anfitrião pode começar outra partida.</p>'}
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>
    `);
    if (souHost) document.getElementById('denovo').onclick = voltarLobby;
  }
})();
