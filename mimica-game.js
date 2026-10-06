// Mímica — modo um celular. Quem faz a mímica segura o celular e vê os 3 nomes; quem adivinha não vê nada.
(function () {
  const C = window.Comum, M = window.Mimica;
  const { esc } = C;
  const app = document.getElementById('app');
  const render = html => { C.pararContagem(); app.innerHTML = html; window.scrollTo(0, 0); };
  const lerTema = () => { try { return localStorage.getItem('mimica:tema') || 'futebol'; } catch (e) { return 'futebol'; } };
  const cfg = { jogadores: C.carregarJogadores(), tema: lerTema() };
  let p = null;

  const nomeTime = (t, i) => `Time ${i + 1}: ${t.map(esc).join(' & ')}`;

  function telaSetup() {
    render(`
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="mimica-sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px"><div style="font-size:4rem">🎭</div><div class="logo">Mímica</div>
        <p class="muted" style="margin:4px 0 0">Duplas: um faz a mímica, o outro adivinha.<br>Cada rodada tem <strong>1:30</strong> e <strong>3 nomes</strong>. Na dupla, cada um faz mímica em uma rodada.</p></div>
      ${C.htmlEditorJogadores(cfg.jogadores)}
      <div class="card"><span class="label">Tema dos nomes</span><div class="chips">${Object.entries(M.TEMAS).map(([k, v]) => `<button type="button" class="chip ${cfg.tema === k ? 'on' : ''}" data-tema="${k}">${v}</button>`).join('')}</div></div>
      <button class="btn" id="comecar" ${cfg.jogadores.length >= 2 ? '' : 'disabled'}>Montar as duplas</button>
      ${cfg.jogadores.length < 2 ? '<p class="muted small center">Precisa de pelo menos 2 pessoas.</p>' : ''}`);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => { cfg.tema = b.dataset.tema; try { localStorage.setItem('mimica:tema', cfg.tema); } catch (e) {} telaSetup(); });
    document.getElementById('comecar').onclick = () => telaTimes(M.montarTimes(cfg.jogadores));
  }

  function telaTimes(times) {
    const nr = times.reduce((s, t) => s + t.length, 0);
    render(`<div class="topbar"><button class="link-back" id="voltar">← Voltar</button></div>
      <div class="center"><div style="font-size:3rem">🎭</div><h2 style="margin:4px 0">Duplas</h2></div>
      <div class="card">${times.map((t, i) => `<p style="margin:8px 0"><strong>${nomeTime(t, i)}</strong>${t.length === 3 ? ' <span class="muted small">(trio: 3 rodadas, conta a % de acertos)</span>' : ''}</p>`).join('')}</div>
      <p class="muted center small">${C.plural(nr, 'rodada', 'rodadas')} de 1:30 · ${M.TEMAS[cfg.tema]}</p>
      <button class="btn" id="ir">Começar</button>
      <button class="btn secondary" id="resortear">🔀 Sortear de novo</button>
      <button class="btn secondary" id="manual">✋ Escolher as duplas</button>`);
    document.getElementById('manual').onclick = () => telaManual([]);
    document.getElementById('voltar').onclick = telaSetup;
    document.getElementById('resortear').onclick = () => telaTimes(M.montarTimes(cfg.jogadores));
    document.getElementById('ir').onclick = () => {
      p = { times, rodadas: M.rodadas(times), k: 0, feitas: [], usados: [], tema: cfg.tema };
      telaPasse();
    };
  }

  function telaManual(ordem) {
    render(`<div class="topbar"><button class="link-back" id="voltar">← Voltar</button></div>
      <div class="center"><div style="font-size:3rem">🎭</div><h2 style="margin:4px 0">Escolher as duplas</h2></div>
      ${M.htmlManual(cfg.jogadores, ordem, esc)}`);
    document.getElementById('voltar').onclick = () => telaTimes(M.montarTimes(cfg.jogadores));
    app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const n = b.dataset.pick;
      telaManual(ordem.includes(n) ? ordem.filter(x => x !== n) : ordem.concat([n]));
    });
    document.getElementById('manualLimpar').onclick = () => telaManual([]);
    document.getElementById('manualOk').onclick = () => telaTimes(M.fecharManual(ordem, cfg.jogadores));
  }

  const cab = () => `<div class="topbar"><span class="pill">Rodada ${p.k + 1} de ${p.rodadas.length}</span><button class="link-back" id="sair">Sair</button></div>`;
  function ligarSair() { const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair da partida?')) { p = null; telaSetup(); } }; }
  const lista = xs => xs.map(esc).join(' e ');

  function telaPasse() {
    const r = p.rodadas[p.k];
    render(`${cab()}<div class="pass"><div class="emoji">📱</div>
      <p class="muted" style="margin:0">${nomeTime(p.times[r.time], r.time)}</p>
      <p style="margin:10px 0 4px">Entregue o celular para</p><div class="big-name">${esc(r.mimo)}</div>
      <p class="muted">${lista(r.adivinha)}, não olhe a tela! 🙈</p>
      <button class="btn" id="ver">Sou ${esc(r.mimo)} — ver os nomes</button></div>${htmlPlacar()}`);
    ligarSair();
    document.getElementById('ver').onclick = () => {
      r.nomes = M.sortear(p.tema, M.POR_RODADA, p.usados); p.usados.push(...r.nomes);
      r.acertos = []; telaNomes();
    };
  }
  // antes de começar: só quem faz a mímica vê os nomes e escolhe a ordem
  function telaNomes() {
    const r = p.rodadas[p.k];
    render(`${cab()}<div class="card center"><span class="label">Só ${esc(r.mimo)} pode ver</span>
      <p class="muted small" style="margin:4px 0 10px">Faça a mímica na ordem que quiser. Quando ${lista(r.adivinha)} acertar, toque em ✅.</p>
      ${r.nomes.map(n => `<div class="big-name" style="font-size:1.6rem;margin:10px 0">${esc(n)}</div>`).join('')}</div>
      <button class="btn" id="go">▶️ Começar (1:30)</button>`);
    ligarSair();
    document.getElementById('go').onclick = () => { r.inicio = Date.now(); telaJogo(); };
  }
  function telaJogo() {
    const r = p.rodadas[p.k];
    render(`${cab()}<div class="card center"><span class="label">${esc(r.mimo)} faz a mímica para ${lista(r.adivinha)}</span>
      <p class="muted small" style="margin:4px 0 0">${r.acertos.length} de ${r.nomes.length} acertados</p></div>
      ${r.nomes.map((n, i) => r.acertos.includes(i)
        ? `<div class="card center" style="opacity:.55"><div class="big-name" style="font-size:1.5rem;text-decoration:line-through">${esc(n)}</div><div class="small">✅ acertou</div></div>`
        : `<div class="card center"><div class="big-name" style="font-size:1.6rem">${esc(n)}</div><button class="btn" data-ac="${i}" style="margin-top:8px">✅ Acertou</button></div>`).join('')}
      <button class="btn ghost" id="parar">⏹️ Encerrar a rodada</button>`);
    ligarSair();
    app.querySelectorAll('[data-ac]').forEach(b => b.onclick = () => {
      r.acertos.push(+b.dataset.ac);
      if (r.acertos.length === r.nomes.length) { r.tempo = Date.now() - r.inicio; return fimRodada(); }
      telaJogo();
    });
    document.getElementById('parar').onclick = () => { if (confirm('Encerrar a rodada agora?')) fimRodada(); };
    C.contagem(r.inicio + M.TEMPO, () => fimRodada());
  }
  function fimRodada() {
    const r = p.rodadas[p.k];
    if (r.tempo === undefined) r.tempo = M.TEMPO;
    p.feitas.push(r);
    const ultima = p.k + 1 >= p.rodadas.length;
    render(`${cab()}<div class="pass"><div class="emoji">${r.acertos.length === 3 ? '🎉' : r.acertos.length ? '👏' : '😅'}</div>
      <div class="big-name" style="font-size:1.8rem">${r.acertos.length} de ${r.nomes.length}</div>
      <p class="muted">${esc(r.mimo)} → ${lista(r.adivinha)}${r.acertos.length === 3 ? ` · em ${M.fmt(r.tempo)}` : ''}</p></div>
      <div class="card">${r.nomes.map((n, i) => `<p style="margin:6px 0">${r.acertos.includes(i) ? '✅' : '❌'} <strong>${esc(n)}</strong></p>`).join('')}</div>
      ${htmlPlacar()}
      <button class="btn" id="prox">${ultima ? '🏆 Ver resultado' : 'Próxima rodada'}</button>`);
    ligarSair();
    document.getElementById('prox').onclick = () => { if (ultima) return telaFinal(); p.k++; telaPasse(); };
  }
  function htmlPlacar() {
    if (!p.feitas.length) return '';
    return `<div class="card"><span class="label">Placar</span>${M.placar(p.times, p.feitas).sort((a, b) => a.ti - b.ti).map(s => `<p style="margin:6px 0">${nomeTime(s.membros, s.ti)} — <strong>${s.acertos}</strong><span class="muted small"> de ${s.total}</span></p>`).join('')}</div>`;
  }
  function telaFinal() {
    const pl = M.placar(p.times, p.feitas), top = pl[0];
    const venc = pl.filter(s => s.pct === top.pct && s.acertos === top.acertos && s.tempo === top.tempo);
    const empateTempo = pl.length > 1 && pl[1].pct === top.pct && pl[1].acertos === top.acertos;
    window.Ranking && Ranking.registrar(p, 'mimica', cfg.jogadores, venc.flatMap(s => s.membros));
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">Venceu</p>
      <h1 class="logo" style="font-size:2rem">${venc.map(s => s.membros.map(esc).join(' & ')).join('<br>')}</h1>
      ${empateTempo && venc.length === 1 ? '<p class="muted small">Empate em acertos — desempate pelo menor tempo.</p>' : ''}</div>
      <div class="card"><span class="label">Placar final</span>${pl.map((s, i) => `<p style="margin:8px 0">${i + 1}º · <strong>${s.membros.map(esc).join(' & ')}</strong> — ${s.acertos} de ${s.total}<span class="muted small"> · tempo médio ${M.fmt(s.tempo)}</span></p>`).join('')}</div>
      <button class="btn" id="denovo">Jogar de novo (novas duplas)</button>
      <button class="btn secondary" id="mesmas">Jogar de novo (mesmas duplas)</button>
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    document.getElementById('denovo').onclick = () => telaTimes(M.montarTimes(cfg.jogadores));
    document.getElementById('mesmas').onclick = () => telaTimes(p.times);
  }

  telaSetup();
})();
