// Alex — modo um celular
// Corrente: jogador → clube em que ele jogou → outro jogador desse clube → clube desse jogador → …
// Cada um tem 30 segundos. Não pode repetir jogador nem clube na rodada. Quem trava sai; o último vivo ganha.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const TEMPO = 30000;
  const render = html => { C.pararContagem(); app.innerHTML = html; window.scrollTo(0, 0); };
  const cfg = { jogadores: C.carregarJogadores() };
  let p = null;

  function telaSetup() {
    render(`
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="alex-sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px"><img src="alexturco.png" alt="" style="width:96px;height:96px;border-radius:50%"><div class="logo">Alex</div>
        <p class="muted" style="margin:4px 0 0">Jogador → clube dele → outro jogador desse clube → clube desse jogador…<br>30 segundos por vez. Não pode repetir. Quem travar sai. O último vivo ganha.</p></div>
      ${C.htmlEditorJogadores(cfg.jogadores)}
      <button class="btn" id="comecar" ${cfg.jogadores.length ? '' : 'disabled'}>Começar</button>`);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    document.getElementById('comecar').onclick = iniciar;
  }

  function iniciar() {
    p = { vivos: cfg.jogadores.slice(), ordem: cfg.jogadores.slice(), vez: 0, rodada: 0, log: [], maior: 0 };
    novaRodada(0);
  }
  function novaRodada(inicio) {
    p.rodada++; p.cadeia = []; p.vez = inicio % p.vivos.length;
    telaVez();
  }
  const precisa = () => !p.cadeia.length || p.cadeia[p.cadeia.length - 1].t === 'c' ? 'j' : 'c';
  const ultimo = () => p.cadeia[p.cadeia.length - 1];
  const nomeItem = x => x.t === 'j' ? `${esc(x.nome)}${F.seloAlex(x.id)}` : `🏟️ ${esc(x.nome)}`;
  const htmlCadeia = () => p.cadeia.length ? `<div class="card"><span class="label">Corrente da rodada (${p.cadeia.length})</span>
    <div class="cadeia">${p.cadeia.map((x, i) => `<div class="elo ${x.t}"><span class="muted small">${i + 1}. ${esc(x.quem)}</span><strong>${nomeItem(x)}</strong></div>`).join('<div class="seta">↓</div>')}</div></div>` : '';
  const cab = () => `<div class="topbar"><span class="pill">Rodada ${p.rodada} · ${C.plural(p.vivos.length, 'vivo', 'vivos')}</span><button class="link-back" id="sair">Sair</button></div>`;
  function ligarSair() { const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair da partida?')) { p = null; telaSetup(); } }; }
  const chips = () => `<div class="chips" style="justify-content:center;margin:8px 0">${p.ordem.map(n => `<span class="chip ${p.vivos.includes(n) ? (n === p.vivos[p.vez] ? 'on' : '') : 'out'}">${p.vivos.includes(n) ? '' : '❌ '}${esc(n)}</span>`).join('')}</div>`;

  function telaVez() {
    const nome = p.vivos[p.vez], t = precisa(), u = ultimo();
    const pedido = t === 'j' ? (u ? `um <strong>jogador</strong> que jogou no <strong>${esc(u.nome)}</strong>` : 'qualquer <strong>jogador</strong> para começar a corrente')
      : `um <strong>clube</strong> em que <strong>${esc(u.nome)}</strong>${F.seloAlex(u.id)} jogou`;
    render(`${cab()}${chips()}
      <div class="card"><p style="margin:0 0 10px"><strong style="font-size:1.35rem">${esc(nome)}</strong>, fale ${pedido}:</p>
        ${t === 'j' ? F.htmlBusca('busca') : F.htmlBusca('busca', 'Digite o nome do clube')}
        <button class="btn" id="confirmar" disabled>Confirmar</button>
        <button class="btn ghost" id="desisto">🏳️ Não sei (estou fora)</button></div>
      ${htmlCadeia()}`);
    ligarSair();
    let escolhido = null; const bt = document.getElementById('confirmar');
    const onEsc = x => { escolhido = x; bt.disabled = !x; };
    if (t === 'j') F.ligarBusca('busca', onEsc); else F.ligarBuscaClube('busca', onEsc);
    bt.onclick = () => jogar(nome, t, escolhido);
    document.getElementById('desisto').onclick = () => { if (confirm(`${nome} não sabe e sai da partida?`)) eliminar(nome, 'desistiu'); };
    C.contagem(Date.now() + TEMPO, () => eliminar(nome, 'tempo'));
  }

  function jogar(nome, t, x) {
    if (!x) return;
    const u = ultimo();
    if (t === 'j') {
      if (p.cadeia.some(e => e.t === 'j' && e.id === x.id)) return toast(`${x.nome} já foi falado nesta rodada.`);
      if (u && !F.jogouNoClube(x, u.id)) return toast(`❌ ${x.nome} não jogou no ${u.nome} (segundo a base). Tente outro.`);
      p.cadeia.push({ t: 'j', id: x.id, nome: x.nome, quem: nome });
      if (x.id === F.ALEX_ID) toast('🇹🇷 ALEX TURCO!');
    } else {
      if (p.cadeia.some(e => e.t === 'c' && F.mesmoClube(e.id, x.id))) return toast(`${x.nome} já foi falado nesta rodada.`);
      if (!F.jogouNoClube(F.porId[u.id], x.id)) return toast(`❌ ${u.nome} não jogou no ${x.nome} (segundo a base). Tente outro.`);
      p.cadeia.push({ t: 'c', id: x.id, nome: x.nome, quem: nome });
    }
    p.maior = Math.max(p.maior, p.cadeia.length);
    p.vez = (p.vez + 1) % p.vivos.length;
    telaVez();
  }

  function eliminar(nome, motivo) {
    const i = p.vivos.indexOf(nome);
    p.vivos.splice(i, 1);
    p.log.push(`${nome} saiu na rodada ${p.rodada} (${motivo === 'tempo' ? 'acabou o tempo' : 'não soube'}) · corrente de ${p.cadeia.length}`);
    const cadeia = p.cadeia;
    if (p.vivos.length <= (cfg.jogadores.length === 1 ? 0 : 1)) return telaFinal(cadeia);
    render(`${cab()}<div class="pass"><div class="emoji">${motivo === 'tempo' ? '⏱️' : '🏳️'}</div><div class="big-name" style="font-size:2rem">${esc(nome)} está fora!</div>
      <p class="muted">${motivo === 'tempo' ? 'Acabaram os 30 segundos.' : 'Não soube responder.'} A corrente parou em ${cadeia.length}.</p>${chips()}
      <button class="btn" id="seguir">Nova rodada</button></div>${htmlCadeiaDe(cadeia)}`);
    ligarSair();
    document.getElementById('seguir').onclick = () => novaRodada(i);
  }
  const htmlCadeiaDe = cad => { const s = p.cadeia; p.cadeia = cad; const h = htmlCadeia(); p.cadeia = s; return h; };

  function telaFinal(cadeia) {
    const venc = p.vivos[0];
    if (venc) window.Ranking && Ranking.registrar(p, 'alex', cfg.jogadores, [venc]);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div>
      <p class="muted" style="margin:6px 0 0">${venc ? 'Último vivo' : 'Fim do treino'}</p><h1 class="logo" style="font-size:2.3rem">${venc ? esc(venc) : `Corrente de ${p.maior}`}</h1></div>
      <div class="card"><span class="label">Como foi</span>${p.log.map(l => `<p class="small" style="margin:6px 0">${esc(l)}</p>`).join('')}
        <p class="muted small" style="margin:8px 0 0">Maior corrente da partida: ${p.maior}</p></div>
      ${htmlCadeiaDe(cadeia)}
      <button class="btn" id="denovo">Jogar de novo</button>
      <button class="btn secondary" id="config">Mudar jogadores</button>
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    document.getElementById('denovo').onclick = iniciar;
    document.getElementById('config').onclick = () => { p = null; telaSetup(); };
  }

  telaSetup();
})();
