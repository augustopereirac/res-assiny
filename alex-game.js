// Alex — modo um celular
// Corrente: jogador → clube em que ele jogou → outro jogador desse clube → clube desse jogador → …
// Cada um tem 30 segundos. Não pode repetir jogador nem clube na rodada.
// Travou? A pergunta VOLTA para quem falou o último nome: se ele souber, quem travou sai; se não souber, sai ele.
// Modo "Eu duvido" (opcional): a base não barra respostas — dá para blefar. Se alguém duvidar, a base decide.
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const TEMPO = 30000;
  const render = html => { C.pararContagem(); app.innerHTML = html; window.scrollTo(0, 0); };
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
  const cfg = { jogadores: C.carregarJogadores(), duvido: ler('alex:duvido', false) };
  let p = null;

  const REGRAS = `Jogador → clube dele → outro jogador desse clube → clube desse jogador…<br>30 segundos por vez. Não pode repetir.<br>
    <strong>Travou?</strong> A pergunta volta para quem falou o último nome. Se ele souber, você sai; se ele também não souber, sai ele.`;

  function telaSetup() {
    render(`
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="alex-sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px"><img src="alexturco.png" alt="" style="width:96px;height:96px;border-radius:50%"><div class="logo">Alex</div>
        <p class="muted" style="margin:4px 0 0">${REGRAS}</p></div>
      ${C.htmlEditorJogadores(cfg.jogadores)}
      <div class="card"><button type="button" class="chip treino-chip ${cfg.duvido ? 'on' : ''}" id="modoDuvido">🤨 Modo "Eu duvido" ${cfg.duvido ? 'LIGADO' : 'desligado'}</button>
        <p class="muted small" style="margin:6px 0 0">Ligado: o jogo não confere as respostas e dá para blefar. Depois de cada resposta, qualquer um pode dizer "Eu duvido". A base confere: se a resposta estava certa, quem duvidou sai; se era blefe, sai quem blefou.</p></div>
      <button class="btn" id="comecar" ${cfg.jogadores.length ? '' : 'disabled'}>Começar</button>`);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    document.getElementById('modoDuvido').onclick = () => { cfg.duvido = !cfg.duvido; gravar('alex:duvido', cfg.duvido); telaSetup(); };
    document.getElementById('comecar').onclick = iniciar;
  }

  function iniciar() {
    p = { vivos: cfg.jogadores.slice(), ordem: cfg.jogadores.slice(), vez: 0, rodada: 0, log: [], maior: 0, duvido: cfg.duvido };
    novaRodada(0);
  }
  function novaRodada(inicio) {
    p.rodada++; p.cadeia = []; p.dev = null; p.vez = inicio % p.vivos.length;
    telaVez();
  }
  // o que falta: 'j' (jogador) ou 'c' (clube). Na devolução, a pergunta é a mesma do penúltimo passo.
  const precisa = () => !p.cadeia.length || p.cadeia[p.cadeia.length - 1].t === 'c' ? 'j' : 'c';
  const ultimo = () => p.cadeia[p.cadeia.length - 1];
  const daVez = () => p.dev ? p.dev.para : p.vivos[p.vez];
  const nomeItem = x => x.t === 'j' ? `${esc(x.nome)}${F.seloAlex(x.id)}` : `🏟️ ${esc(x.nome)}`;
  const htmlCadeia = (cad = p.cadeia) => cad.length ? `<div class="card"><span class="label">Corrente da rodada (${cad.length})</span>
    <div class="cadeia">${cad.map((x, i) => `<div class="elo ${x.t}"><span class="muted small">${i + 1}. ${esc(x.quem)}</span><strong>${nomeItem(x)}</strong></div>`).join('<div class="seta">↓</div>')}</div></div>` : '';
  const cab = () => `<div class="topbar"><span class="pill">Rodada ${p.rodada} · ${C.plural(p.vivos.length, 'vivo', 'vivos')}${p.duvido ? ' · 🤨' : ''}</span><button class="link-back" id="sair">Sair</button></div>`;
  function ligarSair() { const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair da partida?')) { p = null; telaSetup(); } }; }
  const chips = () => `<div class="chips" style="justify-content:center;margin:8px 0">${p.ordem.map(n => `<span class="chip ${p.vivos.includes(n) ? (n === daVez() ? 'on' : '') : 'out'}">${p.vivos.includes(n) ? '' : '❌ '}${esc(n)}</span>`).join('')}</div>`;
  const pedidoDe = (t, u, outro) => t === 'j' ? (u ? `${outro ? 'outro' : 'um'} <strong>jogador</strong> que jogou no <strong>${esc(u.nome)}</strong>` : 'qualquer <strong>jogador</strong> para começar a corrente')
    : `${outro ? 'outro' : 'um'} <strong>clube</strong> em que <strong>${esc(u.nome)}</strong>${F.seloAlex(u.id)} jogou`;

  function telaVez() {
    const nome = daVez(), t = precisa(), u = ultimo();
    const aviso = p.dev ? `<div class="card" style="border-color:var(--warn,#f5a524)"><strong>↩️ ${esc(p.dev.falhou)} não soube.</strong>
      <p class="small" style="margin:6px 0 0">A pergunta voltou para ${esc(nome)}, que falou <strong>${esc(u.nome)}</strong>. Se você souber, ${esc(p.dev.falhou)} sai. Se não souber, sai você.</p></div>` : '';
    render(`${cab()}${chips()}${aviso}
      <div class="card"><p style="margin:0 0 10px"><strong style="font-size:1.35rem">${esc(nome)}</strong>, fale ${pedidoDe(t, u, !!p.dev)}:</p>
        ${t === 'j' ? F.htmlBusca('busca') : F.htmlBusca('busca', 'Digite o nome do clube')}
        <button class="btn" id="confirmar" disabled>Confirmar</button>
        <button class="btn ghost" id="desisto">🏳️ Não sei</button></div>
      ${htmlCadeia()}`);
    ligarSair();
    let escolhido = null; const bt = document.getElementById('confirmar');
    const onEsc = x => { escolhido = x; bt.disabled = !x; };
    if (t === 'j') F.ligarBusca('busca', onEsc); else F.ligarBuscaClube('busca', onEsc);
    bt.onclick = () => jogar(nome, t, escolhido);
    document.getElementById('desisto').onclick = () => { if (confirm(`${nome} não sabe?`)) travou(nome, 'desistiu'); };
    C.contagem(Date.now() + TEMPO, () => travou(nome, 'tempo'));
  }

  // alguém não soube responder
  function travou(nome, motivo) {
    if (p.dev) return eliminar(p.dev.para, `${p.dev.falhou} travou e a pergunta voltou, mas ${p.dev.para} também não soube`, motivo);
    const u = ultimo();
    if (u && u.quem !== nome && p.vivos.includes(u.quem)) { p.dev = { falhou: nome, para: u.quem, motivo }; return telaVez(); }
    eliminar(nome, motivo === 'tempo' ? 'acabou o tempo' : 'não soube', motivo);
  }

  function jogar(nome, t, x) {
    if (!x) return;
    const u = ultimo(); let ok;
    if (t === 'j') {
      if (p.cadeia.some(e => e.t === 'j' && e.id === x.id)) return toast(`${x.nome} já foi falado nesta rodada.`);
      ok = !u || F.jogouNoClube(x, u.id);
      if (!ok && !p.duvido) return toast(`❌ ${x.nome} não jogou no ${u.nome} (segundo a base). Tente outro.`);
      p.cadeia.push({ t: 'j', id: x.id, nome: x.nome, quem: nome, ok });
      if (x.id === F.ALEX_ID) toast('🇹🇷 ALEX TURCO!');
    } else {
      if (p.cadeia.some(e => e.t === 'c' && F.mesmoClube(e.id, x.id))) return toast(`${x.nome} já foi falado nesta rodada.`);
      ok = F.jogouNoClube(F.porId[u.id], x.id);
      if (!ok && !p.duvido) return toast(`❌ ${u.nome} não jogou no ${x.nome} (segundo a base). Tente outro.`);
      p.cadeia.push({ t: 'c', id: x.id, nome: x.nome, quem: nome, ok });
    }
    p.maior = Math.max(p.maior, p.cadeia.length);
    if (p.duvido && p.vivos.length > 1) return telaDuvida();
    seguir();
  }
  // resposta aceita (ninguém duvidou ou modo normal)
  function seguir() {
    if (p.dev) { const d = p.dev; return eliminar(d.falhou, `não soube e, quando a pergunta voltou, ${d.para} soube`, d.motivo); }
    p.vez = (p.vez + 1) % p.vivos.length;
    telaVez();
  }

  function telaDuvida() {
    const x = ultimo(), outros = p.vivos.filter(n => n !== x.quem);
    render(`${cab()}<div class="pass"><div class="emoji">🤨</div>
      <p class="muted" style="margin:0">${esc(x.quem)} disse</p><div class="big-name" style="font-size:1.8rem">${nomeItem(x)}</div>
      <p style="margin:12px 0 6px"><strong>Alguém duvida?</strong></p>
      <div class="chips" style="justify-content:center">${outros.map((n, i) => `<button class="chip" data-d="${i}">🙋 ${esc(n)} duvida</button>`).join('')}</div>
      <button class="btn" id="ninguem" style="margin-top:14px">Ninguém duvida → segue</button></div>${htmlCadeia()}`);
    ligarSair();
    document.getElementById('ninguem').onclick = seguir;
    app.querySelectorAll('[data-d]').forEach(b => b.onclick = () => telaVeredito(outros[+b.dataset.d]));
  }
  function telaVeredito(duvidou) {
    const x = ultimo(), cad = p.cadeia;
    const pergunta = x.t === 'j' ? (cad.length > 1 ? `${x.nome} jogou no ${cad[cad.length - 2].nome}?` : '') : `${cad[cad.length - 2].nome} jogou no ${x.nome}?`;
    const sai = x.ok ? duvidou : x.quem, outro = x.ok ? x.quem : duvidou;
    const motivo = n => n === duvidou ? `duvidou de ${x.nome}, mas estava certo` : `blefou com ${x.nome}`;
    render(`${cab()}<div class="pass"><div class="emoji">${x.ok ? '✅' : '❌'}</div>
      <p class="muted" style="margin:0">${esc(duvidou)} duvidou de ${esc(x.quem)}</p>
      <div class="big-name" style="font-size:1.5rem">${esc(pergunta)}</div>
      <p style="margin:8px 0">Segundo a base: <strong>${x.ok ? 'SIM, era verdade' : 'NÃO, foi blefe'}</strong></p>
      <button class="btn" id="conf">${esc(sai)} está fora</button>
      <button class="btn ghost" id="inv">⚖️ A base errou — sai ${esc(outro)}</button></div>${htmlCadeia()}`);
    ligarSair();
    document.getElementById('conf').onclick = () => eliminar(sai, motivo(sai), 'duvido');
    document.getElementById('inv').onclick = () => eliminar(outro, motivo(outro) + ' (decidido pelo grupo)', 'duvido');
  }

  function eliminar(nome, texto, motivo) {
    const i = p.vivos.indexOf(nome);
    if (i < 0) return;
    p.vivos.splice(i, 1);
    p.log.push(`${nome} saiu na rodada ${p.rodada}: ${texto} · corrente de ${p.cadeia.length}`);
    const cadeia = p.cadeia;
    if (p.vivos.length <= (cfg.jogadores.length === 1 ? 0 : 1)) return telaFinal(cadeia);
    const emoji = motivo === 'tempo' ? '⏱️' : motivo === 'duvido' ? '🤨' : '🏳️';
    render(`${cab()}<div class="pass"><div class="emoji">${emoji}</div><div class="big-name" style="font-size:2rem">${esc(nome)} está fora!</div>
      <p class="muted">${esc(texto.charAt(0).toUpperCase() + texto.slice(1))}. A corrente parou em ${cadeia.length}.</p>${chips()}
      <button class="btn" id="seguir">Nova rodada</button></div>${htmlCadeia(cadeia)}`);
    ligarSair();
    document.getElementById('seguir').onclick = () => novaRodada(i);
  }

  function telaFinal(cadeia) {
    const venc = p.vivos[0];
    if (venc) window.Ranking && Ranking.registrar(p, 'alex', cfg.jogadores, [venc]);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div>
      <p class="muted" style="margin:6px 0 0">${venc ? 'Último vivo' : 'Fim do treino'}</p><h1 class="logo" style="font-size:2.3rem">${venc ? esc(venc) : `Corrente de ${p.maior}`}</h1></div>
      <div class="card"><span class="label">Como foi</span>${p.log.map(l => `<p class="small" style="margin:6px 0">${esc(l)}</p>`).join('')}
        <p class="muted small" style="margin:8px 0 0">Maior corrente da partida: ${p.maior}</p></div>
      ${htmlCadeia(cadeia)}
      <button class="btn" id="denovo">Jogar de novo</button>
      <button class="btn secondary" id="config">Mudar jogadores</button>
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    document.getElementById('denovo').onclick = iniciar;
    document.getElementById('config').onclick = () => { p = null; telaSetup(); };
  }

  telaSetup();
})();
