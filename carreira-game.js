// De Quem É a Carreira? — modo um celular
// Os clubes da carreira aparecem um por vez. Quem acertar o jogador mais cedo ganha mais pontos:
// acertou vendo k de N clubes → N - k + 1 pontos.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, store, toast } = C;
  const app = document.getElementById('app');
  const render = html => { app.innerHTML = html; window.scrollTo(0, 0); };

  const cfg = { jogadores: C.carregarJogadores(), pool: store.get('car:pool', 'famosos'), rodadas: store.get('car:rodadas', 5) };
  const salvar = () => { store.set('car:pool', cfg.pool); store.set('car:rodadas', cfg.rodadas); };
  let vistos = new Set(store.get('car:vistos', []));
  let p = null;

  function telaSetup() {
    const pode = cfg.jogadores.length >= 1;
    render(`
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="carreira-sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px"><div class="logo">De Quem É a Carreira?</div>
        <p class="muted" style="margin:4px 0 0">Os clubes aparecem um por vez.<br>Acerte o jogador o quanto antes: quanto menos clubes, mais pontos.</p></div>
      ${C.htmlEditorJogadores(cfg.jogadores)}
      <div class="card"><span class="label">Jogadores sorteados</span>
        ${Object.entries(F.POOLS).map(([k, v]) => `<button class="list-opt ${cfg.pool === k ? 'on' : ''}" data-pool="${k}"><strong>${esc(v.nome)}</strong><span class="muted small">${F.poolCarreira(k).length} jogadores</span></button>`).join('')}
        <span class="label" style="margin-top:12px">Rodadas</span>
        <div class="chips">${[3, 5, 10, 15].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}</div>
        <p class="muted small" style="margin:10px 0 0">Carreira de clubes profissionais (inclui empréstimos), segundo o Wikidata (set/2026). Categorias de base e seleções não entram.</p>
      </div>
      <button class="btn" id="comecar" ${pode ? '' : 'disabled'}>Começar</button>`);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-pool]').forEach(b => b.onclick = () => { cfg.pool = b.dataset.pool; salvar(); telaSetup(); });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { cfg.rodadas = +b.dataset.rod; salvar(); telaSetup(); });
    document.getElementById('comecar').onclick = iniciar;
  }

  function sortear() {
    let pool = F.poolCarreira(cfg.pool).filter(j => !vistos.has(j.id) && !p.usados.includes(j.id));
    if (!pool.length) { vistos = new Set(); pool = F.poolCarreira(cfg.pool).filter(j => !p.usados.includes(j.id)); }
    const j = pool[Math.floor(Math.random() * pool.length)];
    p.usados.push(j.id); vistos.add(j.id); store.set('car:vistos', [...vistos]);
    return j;
  }

  function iniciar() {
    p = { rodada: 0, usados: [], placar: Object.fromEntries(cfg.jogadores.map(j => [j, 0])), hist: [] };
    novaRodada();
  }
  function novaRodada(trocar) {
    if (!trocar) p.rodada++;
    p.alvo = sortear(); p.passo = 1; p.acertou = {}; p.chutes = [];
    const n = cfg.jogadores.length, ini = (p.rodada - 1) % n;
    p.ordem = cfg.jogadores.slice(ini).concat(cfg.jogadores.slice(0, ini));
    p.vez = 0;
    proximoChute();
  }

  // troca o jogador da rodada sem avançar (ex.: já jogaram com ele); desfaz os pontos ganhos nele
  function trocarJogador() {
    if (!confirm('Trocar o jogador desta rodada? Os pontos ganhos nele são desfeitos.')) return;
    Object.entries(p.acertou).forEach(([n, ps]) => { p.placar[n] -= N() - ps + 1; });
    toast('🔄 Jogador trocado.');
    novaRodada(true);
  }
  const btnTrocar = '<button class="btn ghost" id="trocarJog">🔄 Já jogamos com ele? Trocar jogador</button>';
  const ligarTrocar = () => { const b = document.getElementById('trocarJog'); if (b) b.onclick = trocarJogador; };
  const N = () => p.alvo.car.length;
  const pend = () => p.ordem.filter(j => !p.acertou[j]);
  const cab = () => `<div class="topbar"><span class="pill">Rodada ${p.rodada}/${cfg.rodadas} · clube ${p.passo}/${N()}</span><button class="link-back" id="sair">Sair</button></div>`;
  function ligarSair() { const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair da partida?')) { p = null; telaSetup(); } }; }
  const htmlCarreira = (ate, mostrarTudo) => `<ol class="car-list">${p.alvo.car.slice(0, mostrarTudo ? N() : ate).map((c, i) => `<li><span class="n">${i + 1}</span><strong>${esc(c.nome)}</strong><span class="anos">${esc(F.anos(c))}</span></li>`).join('')}
    ${!mostrarTudo && ate < N() ? `<li class="muted"><span class="n">?</span>mais ${N() - ate} clube${N() - ate > 1 ? 's' : ''}…</li>` : ''}</ol>`;

  function proximoChute() {
    const faltam = pend();
    if (!faltam.length) return fimRodada();
    if (p.vez >= faltam.length) {
      // todos que faltam já chutaram neste passo
      if (p.passo >= N()) return fimRodada();
      p.passo++; p.vez = 0;
    }
    telaChute(pend()[p.vez]);
  }

  function telaChute(nome) {
    // o que os outros fizeram NESTE clube fica escondido até o clube fechar
    let escolhido = null;
    render(`${cab()}
      <div class="card"><span class="label">A carreira</span>${htmlCarreira(p.passo)}</div>
      ${F.htmlHistChutes(p.chutes.filter(c => c.passo < p.passo).map(c => c.ok ? { ...c, nome: null } : c), n => n)}
      <div class="card"><p style="margin:0 0 8px"><strong style="font-size:1.25rem">${esc(nome)}</strong>, de quem é essa carreira? <span class="muted small">(vale ${N() - p.passo + 1} pts)</span></p>
        ${F.htmlBusca('busca')}
        <button class="btn" id="chutar" disabled>Chutar</button>
        <button class="btn ghost" id="passar">Passar (esperar mais um clube)</button></div>
      ${btnTrocar}
      <div class="card"><span class="label">Placar</span>${placar(true)}</div>`);
    ligarSair();
    ligarTrocar();
    const bt = document.getElementById('chutar');
    F.ligarBusca('busca', j => { escolhido = j; bt.disabled = !j; });
    bt.onclick = () => {
      const ok = escolhido.id === p.alvo.id;
      p.chutes.push({ quem: nome, passo: p.passo, nome: escolhido.nome, ok });
      const pts = N() - p.passo + 1;
      if (ok) { p.acertou[nome] = p.passo; p.placar[nome] += pts; }
      else p.vez++;
      telaResultado(nome, ok ? `✅ Acertou! +${pts} pts` : `❌ Não é ${esc(escolhido.nome)}.`);
    };
    document.getElementById('passar').onclick = () => { p.chutes.push({ quem: nome, passo: p.passo, passou: true }); p.vez++; telaResultado(nome, 'Você passou.'); };
  }

  // resultado só para quem chutou; depois passa o celular (sem entregar nada ao próximo)
  function telaResultado(nome, msg) {
    const faltam = pend(), prox = faltam.length && p.vez < faltam.length ? faltam[p.vez] : null;
    render(`${cab()}<div class="pass"><div class="emoji">🤫</div><p class="muted">${esc(nome)}</p><div class="big-name" style="font-size:1.6rem">${msg}</div>
      <p class="muted small">Não conte para os outros!</p>
      <button class="btn" id="seguir">${prox ? 'Passar o celular para ' + esc(prox) : 'Continuar'}</button></div>`);
    ligarSair();
    document.getElementById('seguir').onclick = proximoChute;
  }

  function fimRodada() {
    const j = p.alvo;
    p.hist.push({ nome: j.nome, acertos: { ...p.acertou } });
    render(`<div class="topbar"><span class="pill">Rodada ${p.rodada}/${cfg.rodadas}</span><button class="link-back" id="sair">Sair</button></div>
      <div class="card center"><div class="muted small">Era</div><div class="question" style="font-size:1.8rem">${esc(j.nome)}</div>
        <div class="muted small">${esc(F.descPos(j))}${j.ano ? ' · nascido em ' + j.ano : ''}${j.sel ? ' · ' + esc(j.sel) : ''}</div></div>
      <div class="card"><span class="label">Carreira completa</span>${htmlCarreira(N(), true)}</div>
      ${F.htmlHistChutes(p.chutes, n => n, 'Chutes da rodada')}
      <div class="card"><span class="label">Quem acertou</span>${p.ordem.map(n => `<p class="small" style="margin:4px 0">${esc(n)}: ${p.acertou[n] ? `✅ no ${p.acertou[n]}º clube (+${N() - p.acertou[n] + 1})` : '❌ não acertou'}</p>`).join('')}</div>
      <div class="card"><span class="label">Placar</span>${placar()}</div>
      <button class="btn" id="prox">${p.rodada >= cfg.rodadas ? '🏆 Ver campeão' : 'Próximo jogador'}</button>`);
    ligarSair();
    document.getElementById('prox').onclick = () => p.rodada >= cfg.rodadas ? telaFinal() : novaRodada();
  }

  const ranking = () => Object.entries(p.placar).sort((a, b) => b[1] - a[1]);
  // escondido = não mostra os pontos ganhos no clube que ainda está aberto
  const placar = (escondido) => `<table class="score">${(escondido ? Object.entries(p.placar).map(([n, v]) => [n, p.acertou[n] === p.passo ? v - (N() - p.passo + 1) : v]).sort((a, b) => b[1] - a[1]) : ranking()).map(([n, v]) => `<tr><td>${esc(n)}</td><td>${C.plural(v, 'pt')}</td></tr>`).join('')}</table>`;

  function telaFinal() {
    const cl = C.classificar(cfg.jogadores.map(n => {
      const ac = p.hist.filter(h => h.acertos[n]); return { nome: n, pts: p.placar[n], tb: [ac.length, -ac.reduce((t, h) => t + h.acertos[n], 0)] };
    }), ['acertar mais jogadores', 'precisar de menos clubes (soma dos clubes vistos nos acertos)']);
    const rank = cl.rank, camp = cl.camp;
    window.Ranking && Ranking.registrar(p, 'carreira', cfg.jogadores, camp);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${camp.length > 1 ? 'Empate!' : 'Campeão'}</p>
      <h1 class="logo" style="font-size:2.3rem">${camp.map(esc).join(' & ')}</h1></div>
      ${C.htmlDesempate(cl.motivo)}
      ${cfg.jogadores.length > 1 ? C.htmlPodio(rank) : ''}
      <div class="card"><span class="label">Classificação</span><table class="score">${rank.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${C.plural(v, 'pt')}</td></tr>`).join('')}</table></div>
      <div class="card"><span class="label">Jogadores da partida</span>${p.hist.map((h, i) => `<p class="small" style="margin:4px 0">${i + 1}. <strong>${esc(h.nome)}</strong></p>`).join('')}</div>
      <button class="btn" id="denovo">Jogar de novo</button>
      <button class="btn secondary" id="config">Mudar jogadores / opções</button>
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    document.getElementById('denovo').onclick = iniciar;
    document.getElementById('config').onclick = () => { p = null; telaSetup(); };
  }

  telaSetup();
})();
