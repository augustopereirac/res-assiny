// Ordene a Carreira — modo um celular
// Aparece o jogador e os clubes embaralhados. Cada um monta, em segredo, a ordem em que ele passou pelos clubes.
// +1 ponto por clube na posição certa; acertou a ordem inteira: +3 de bônus.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, store } = C;
  const app = document.getElementById('app');
  const render = html => { app.innerHTML = html; window.scrollTo(0, 0); };

  const cfg = { jogadores: C.carregarJogadores(), pool: store.get('ord:pool', 'famosos'), rodadas: store.get('ord:rodadas', 5) };
  const salvar = () => { store.set('ord:pool', cfg.pool); store.set('ord:rodadas', cfg.rodadas); };
  let vistos = new Set(store.get('ord:vistos', []));
  let p = null;

  function telaSetup() {
    render(`
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="ordene-sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px"><div class="logo">Ordene a Carreira</div>
        <p class="muted" style="margin:4px 0 0">Você recebe o jogador e os clubes embaralhados.<br>Coloque na ordem em que ele jogou em cada um.</p></div>
      ${C.htmlEditorJogadores(cfg.jogadores)}
      <div class="card"><span class="label">Jogadores sorteados</span>
        ${Object.entries(F.POOLS).map(([k, v]) => `<button class="list-opt ${cfg.pool === k ? 'on' : ''}" data-pool="${k}"><strong>${esc(v.nome)}</strong><span class="muted small">${F.poolCarreira(k).length} jogadores</span></button>`).join('')}
        <span class="label" style="margin-top:12px">Rodadas</span>
        <div class="chips">${[3, 5, 10, 15].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}</div>
        <p class="muted small" style="margin:10px 0 0">+1 por clube na posição certa, +3 se acertar tudo. Carreira de clubes profissionais (com empréstimos), Wikidata (set/2026).</p>
      </div>
      <button class="btn" id="comecar" ${cfg.jogadores.length ? '' : 'disabled'}>Começar</button>`);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-pool]').forEach(b => b.onclick = () => { cfg.pool = b.dataset.pool; salvar(); telaSetup(); });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { cfg.rodadas = +b.dataset.rod; salvar(); telaSetup(); });
    document.getElementById('comecar').onclick = iniciar;
  }

  function sortear() {
    let pool = F.poolCarreira(cfg.pool).filter(j => j.car.length <= 9 && !vistos.has(j.id) && !p.usados.includes(j.id));
    if (!pool.length) { vistos = new Set(); pool = F.poolCarreira(cfg.pool).filter(j => j.car.length <= 9 && !p.usados.includes(j.id)); }
    const j = pool[Math.floor(Math.random() * pool.length)];
    p.usados.push(j.id); vistos.add(j.id); store.set('ord:vistos', [...vistos]);
    return j;
  }

  function iniciar() { p = { rodada: 0, usados: [], placar: Object.fromEntries(cfg.jogadores.map(j => [j, 0])) }; novaRodada(); }
  function novaRodada(trocar) {
    if (!trocar) p.rodada++;
    p.alvo = sortear(); p.respostas = {}; p.vez = 0;
    p.certo = p.alvo.car.map(c => c.nome);
    p.embaralhado = C.shuffle(p.certo.map((n, i) => ({ n, i })));
    // garante que não venha já na ordem certa
    if (p.embaralhado.every((x, i) => x.n === p.certo[i]) && p.certo.length > 1) p.embaralhado.reverse();
    telaPasse();
  }
  const cab = () => `<div class="topbar"><span class="pill">Rodada ${p.rodada}/${cfg.rodadas}</span><button class="link-back" id="sair">Sair</button></div>`;
  function ligarSair() { const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair da partida?')) { p = null; telaSetup(); } }; }
  const cartao = () => `<div class="card center"><div class="muted small">Ordene a carreira de</div><div class="question" style="font-size:1.7rem">${esc(p.alvo.nome)}</div>
    <div class="muted small">${esc(F.descPos(p.alvo))}${p.alvo.ano ? ' · nascido em ' + p.alvo.ano : ''} · ${p.certo.length} passagens</div>
    <button class="btn ghost small" id="trocarJog" style="margin-top:10px">🔄 Não conheço, trocar jogador</button></div>`;
  // troca o jogador da rodada (quem já ordenou nesta rodada ordena de novo)
  function ligarTrocar() {
    const b = document.getElementById('trocarJog'); if (!b) return;
    b.onclick = () => { if (Object.keys(p.respostas).length && !confirm('Trocar o jogador? Quem já ordenou nesta rodada vai ordenar de novo.')) return; novaRodada(true); };
  }

  function telaPasse() {
    const nome = cfg.jogadores[p.vez];
    if (cfg.jogadores.length === 1) return telaOrdenar(nome);
    render(`${cab()}${cartao()}<div class="pass" style="padding-top:10px"><p class="muted">Passe o celular para</p><div class="big-name">${esc(nome)}</div>
      <button class="btn" id="sou">Sou ${esc(nome)}, ordenar</button></div>`);
    ligarSair(); ligarTrocar();
    document.getElementById('sou').onclick = () => telaOrdenar(nome);
  }

  function telaOrdenar(nome) {
    const ordem = [];
    const desenhar = () => {
      render(`${cab()}${cartao()}
        <div class="card"><span class="label">${esc(nome)}, toque nos clubes na ordem (do primeiro ao último)</span>
          <div>${p.embaralhado.map((x, k) => `<button class="chip-club ${ordem.includes(k) ? 'usado' : ''}" data-k="${k}">${esc(x.n)}</button>`).join('')}</div></div>
        <div class="card"><span class="label">Sua ordem</span>
          <ol class="car-list">${ordem.map((k, i) => `<li><span class="n">${i + 1}</span><strong>${esc(p.embaralhado[k].n)}</strong></li>`).join('') || '<li class="muted">Nenhum clube ainda</li>'}</ol>
          <div class="row" style="margin-top:10px"><button class="btn secondary small" id="desfazer" ${ordem.length ? '' : 'disabled'}>↩ Desfazer</button><button class="btn secondary small" id="limpar" ${ordem.length ? '' : 'disabled'}>Limpar</button></div></div>
        <button class="btn" id="ok" ${ordem.length === p.embaralhado.length ? '' : 'disabled'}>Confirmar ordem</button>`);
      ligarSair(); ligarTrocar();
      app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { ordem.push(+b.dataset.k); desenhar(); });
      document.getElementById('desfazer').onclick = () => { ordem.pop(); desenhar(); };
      document.getElementById('limpar').onclick = () => { ordem.length = 0; desenhar(); };
      document.getElementById('ok').onclick = () => {
        p.respostas[nome] = ordem.map(k => p.embaralhado[k].n);
        p.vez++;
        if (p.vez < cfg.jogadores.length) telaPasse(); else revelar();
      };
    };
    desenhar();
  }

  function pontos(resp) {
    const acertos = resp.filter((n, i) => n === p.certo[i]).length;
    return { acertos, pts: acertos + (acertos === p.certo.length ? 3 : 0) };
  }

  function revelar() {
    const res = cfg.jogadores.map(n => ({ n, ...pontos(p.respostas[n]) }));
    res.forEach(r => p.placar[r.n] += r.pts);
    render(`${cab()}
      <div class="card"><span class="label">Ordem certa · ${esc(p.alvo.nome)}</span>
        <ol class="car-list">${p.alvo.car.map((c, i) => `<li><span class="n">${i + 1}</span><strong>${esc(c.nome)}</strong><span class="anos">${esc(F.anos(c))}</span></li>`).join('')}</ol></div>
      ${res.map(r => `<div class="card"><span class="label">${esc(r.n)} · ${r.acertos}/${p.certo.length} ${r.acertos === p.certo.length ? '🎯 PERFEITO (+3)' : ''} · +${r.pts}</span>
        <div class="said">${p.respostas[r.n].map((n, i) => `<span class="said-item ${n === p.certo[i] ? 'ok' : 'miss'}">${i + 1}. ${esc(n)}</span>`).join('')}</div></div>`).join('')}
      <div class="card"><span class="label">Placar</span>${placar()}</div>
      <button class="btn" id="prox">${p.rodada >= cfg.rodadas ? '🏆 Ver campeão' : 'Próximo jogador'}</button>`);
    ligarSair(); ligarTrocar();
    document.getElementById('prox').onclick = () => p.rodada >= cfg.rodadas ? telaFinal() : novaRodada();
  }

  const ranking = () => Object.entries(p.placar).sort((a, b) => b[1] - a[1]);
  const placar = () => `<table class="score">${ranking().map(([n, v]) => `<tr><td>${esc(n)}</td><td>${C.plural(v, 'pt')}</td></tr>`).join('')}</table>`;
  function telaFinal() {
    const rank = ranking(), top = rank[0][1], camp = rank.filter(r => r[1] === top).map(r => r[0]);
    window.Ranking && Ranking.registrar(p, 'ordene', cfg.jogadores, camp);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${camp.length > 1 ? 'Empate!' : 'Campeão'}</p>
      <h1 class="logo" style="font-size:2.3rem">${camp.map(esc).join(' & ')}</h1></div>
      ${cfg.jogadores.length > 1 ? C.htmlPodio(rank) : ''}
      <div class="card"><span class="label">Classificação</span>${placar()}</div>
      <button class="btn" id="denovo">Jogar de novo</button>
      <button class="btn secondary" id="config">Mudar jogadores / opções</button>
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    document.getElementById('denovo').onclick = iniciar;
    document.getElementById('config').onclick = () => { p = null; telaSetup(); };
  }

  telaSetup();
})();
