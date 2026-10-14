// Áudio Reverso — modo um celular.
// Rodada: A grava uma frase → o app inverte → B escuta o áudio invertido e imita → o app inverte a imitação
// → todo mundo tenta entender a frase. Quem acertar ganha 1 ponto; quem gravou ganha 1 se alguém acertou.
(function () {
  const C = window.Comum, A = window.Reverso.Audio, F = window.Reverso.Frases;
  const { esc } = C;
  const app = document.getElementById('app');
  const render = html => { A.parar(); pararGravacao(); C.pararContagem(); app.innerHTML = html; window.scrollTo(0, 0); };
  const ls = (k, d) => { try { const v = localStorage.getItem('reverso:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem('reverso:' + k, JSON.stringify(v)); } catch (e) {} };
  const cfg = { jogadores: C.carregarJogadores(), tema: ls('tema', 'misto'), voltas: ls('voltas', 1), tentativas: ls('tentativas', 3) };
  let p = null;

  // ---------- gravador ----------
  let grav = null, gravTick = null;
  function pararGravacao() { clearInterval(gravTick); gravTick = null; if (grav) { const g = grav; grav = null; g.parar(); } }
  // liga um botão de gravar: toque para começar, toque para parar
  function ligarGravador(id, rotulo, onPronto) {
    const b = document.getElementById(id); if (!b) return;
    const barra = document.getElementById(id + 'Nivel');
    const fim = async () => {
      clearInterval(gravTick); gravTick = null;
      const g = grav; grav = null; if (!g) return;
      b.disabled = true; b.classList.remove('gravando'); b.textContent = '⏳ Processando…';
      const buf = await g.parar();
      if (!buf || buf.duration < 0.25) { C.toast('Não deu para ouvir nada. Grave de novo.'); b.disabled = false; b.textContent = rotulo; if (barra) barra.style.width = '0'; return; }
      onPronto(buf);
    };
    b.onclick = async () => {
      if (grav) return fim();
      if (!A.suportado()) return C.toast('Este navegador não deixa gravar áudio.');
      A.parar();
      try {
        b.disabled = true;
        grav = await A.gravar(() => fim());
      } catch (e) {
        b.disabled = false; grav = null;
        const msg = document.getElementById(id + 'Erro');
        if (msg) msg.innerHTML = '🎙️ Não consegui usar o microfone. Libere o microfone para este site (cadeado/“aA” na barra de endereço) e tente de novo.';
        return;
      }
      b.disabled = false; b.classList.add('gravando');
      gravTick = setInterval(() => {
        if (!grav) return;
        const s = grav.segundos();
        b.textContent = `⏹️ Parar · ${s.toFixed(0)}s`;
        if (barra) barra.style.width = Math.round(grav.nivel() * 100) + '%';
      }, 80);
    };
  }
  const htmlGravador = (id, rotulo) => `
    <button class="btn rv-rec" id="${id}">${rotulo}</button>
    <div class="rv-nivel"><div id="${id}Nivel"></div></div>
    <p class="muted small center" id="${id}Erro" style="margin:4px 0 0"></p>`;

  // botão de tocar: mostra ⏸️ enquanto toca
  function ligarPlay(id, getBuf) {
    const b = document.getElementById(id); if (!b) return;
    const txt = b.innerHTML;
    b.onclick = () => {
      if (b.dataset.on) { A.parar(); return; }
      const buf = typeof getBuf === 'function' ? getBuf() : getBuf;
      if (!buf) return;
      A.tocar(buf, () => { delete b.dataset.on; b.innerHTML = txt; });
      b.dataset.on = '1'; b.innerHTML = '⏸️ Parar';
    };
  }
  // toca vários buffers em sequência
  function tocarSeq(bufs, b, txt) {
    const vai = i => {
      if (i >= bufs.length) { delete b.dataset.on; b.innerHTML = txt; return; }
      A.tocar(bufs[i], () => { if (b.dataset.on) setTimeout(() => b.dataset.on && vai(i + 1), 450); });
    };
    b.dataset.on = '1'; b.innerHTML = '⏸️ Parar'; vai(0);
  }

  // ---------- telas ----------
  function telaSetup() {
    render(`
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="center" style="margin-bottom:18px"><div style="font-size:4rem">🔄</div><div class="logo">Áudio Reverso</div>
        <p class="muted" style="margin:4px 0 0">Um grava uma frase, o app <strong>inverte</strong>. O próximo escuta o áudio ao contrário e tenta <strong>imitar</strong>.
        O app inverte a imitação e… dá para entender a frase? 😂</p></div>
      ${C.htmlEditorJogadores(cfg.jogadores)}
      <div class="card"><span class="label">Frases</span><div class="chips">${Object.entries(F.TEMAS).map(([k, v]) => `<button type="button" class="chip ${cfg.tema === k ? 'on' : ''}" data-tema="${k}">${v}</button>`).join('')}</div>
        <p class="muted small" style="margin:6px 0 0">${cfg.tema === 'livre' ? 'Quem grava escreve a própria frase e depois fala.' : 'O app sorteia uma frase para quem grava (dá para trocar ou escrever outra).'}</p></div>
      <div class="card"><span class="label">Voltas</span><div class="chips">${[1, 2, 3].map(n => `<button type="button" class="chip ${cfg.voltas === n ? 'on' : ''}" data-voltas="${n}">${n}</button>`).join('')}</div>
        <p class="muted small" style="margin:6px 0 0">Em cada volta, cada pessoa grava uma vez e imita uma vez.</p>
        <span class="label" style="margin-top:12px">Tentativas para imitar</span><div class="chips">${[1, 2, 3, 5].map(n => `<button type="button" class="chip ${cfg.tentativas === n ? 'on' : ''}" data-tent="${n}">${n}</button>`).join('')}</div></div>
      <button class="btn" id="comecar" ${cfg.jogadores.length >= 2 ? '' : 'disabled'}>Começar</button>
      ${cfg.jogadores.length < 2 ? '<p class="muted small center">Precisa de pelo menos 2 pessoas.</p>' : ''}
      ${A.suportado() ? '' : '<p class="muted small center">⚠️ Este navegador não grava áudio. Use o Chrome ou o Safari atualizados.</p>'}
      <div class="card"><span class="label">Como funciona</span>
        <p class="small" style="margin:6px 0">1. <strong>Quem grava</strong> escreve (ou sorteia) a frase e fala no celular (os outros não podem ouvir — saiam de perto ou tampem os ouvidos 🙉).</p>
        <p class="small" style="margin:6px 0">2. <strong>Quem imita</strong> ouve o áudio ao contrário quantas vezes quiser e grava a imitação, sílaba por sílaba.</p>
        <p class="small" style="margin:6px 0">3. O app inverte a imitação e toca. Quem imitou escreve qual acha que é a frase.</p>
        <p class="small" style="margin:6px 0">4. Quem imitou escreve o palpite. O app mostra a frase escrita, o palpite e os áudios, e os dois confirmam se acertou. Acertou: <strong>1 ponto</strong> para quem gravou e <strong>1</strong> para quem imitou.</p></div>`);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => { cfg.tema = b.dataset.tema; lsSet('tema', cfg.tema); telaSetup(); });
    app.querySelectorAll('[data-voltas]').forEach(b => b.onclick = () => { cfg.voltas = +b.dataset.voltas; lsSet('voltas', cfg.voltas); telaSetup(); });
    app.querySelectorAll('[data-tent]').forEach(b => b.onclick = () => { cfg.tentativas = +b.dataset.tent; lsSet('tentativas', cfg.tentativas); telaSetup(); });
    document.getElementById('comecar').onclick = () => {
      A.ctx(); // libera o áudio no toque (iPhone)
      const ordem = C.shuffle(cfg.jogadores);
      const rodadas = [];
      for (let v = 0; v < cfg.voltas; v++) ordem.forEach((n, i) => rodadas.push({ fala: n, imita: ordem[(i + 1) % ordem.length] }));
      const pts = {}, tb = {}; ordem.forEach(n => { pts[n] = 0; tb[n] = 0; });
      p = { jogadores: ordem, rodadas, k: 0, pts, tb, usados: [], tema: cfg.tema, tentativas: cfg.tentativas };
      telaPasseFala();
    };
  }

  const cab = () => `<div class="topbar"><span class="pill">Rodada ${p.k + 1} de ${p.rodadas.length}</span><button class="link-back" id="sair">Sair</button></div>`;
  function ligarSair() { const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair da partida?')) { p = null; telaSetup(); } }; }
  const outros = (...nomes) => p.jogadores.filter(n => !nomes.includes(n));
  const lista = xs => xs.length > 1 ? xs.slice(0, -1).map(esc).join(', ') + ' e ' + esc(xs[xs.length - 1]) : esc(xs[0] || '');

  function telaPasseFala() {
    const r = p.rodadas[p.k];
    render(`${cab()}<div class="pass"><div class="emoji">🎙️</div>
      <p style="margin:10px 0 4px">Entregue o celular para</p><div class="big-name">${esc(r.fala)}</div>
      <p class="muted"><strong>${esc(r.imita)}</strong> vai imitar. ${esc(r.imita)}, não pode ouvir a frase! 🙉</p>
      <button class="btn" id="ver">Sou ${esc(r.fala)} — ver a frase</button></div>${htmlPlacar()}`);
    ligarSair();
    document.getElementById('ver').onclick = () => {
      A.ctx();
      r.frase = p.tema === 'livre' ? '' : F.sortear(p.tema, p.usados);
      r.original = null; r.invertido = null; r.imitacoes = [];
      telaFala();
    };
  }

  function telaFala() {
    const r = p.rodadas[p.k];
    const livre = p.tema === 'livre';
    render(`${cab()}<div class="card center"><span class="label">Só ${esc(r.fala)} pode ver</span>
      ${livre || r.editando
        ? `<input class="campo" id="frase" maxlength="60" placeholder="Escreva a frase que você vai falar" value="${esc(r.frase || '')}" style="margin-top:8px">`
        : `<div class="big-name rv-frase">“${esc(r.frase)}”</div>
           ${r.original ? '' : `<div class="row" style="gap:8px;justify-content:center"><button class="chip" id="outra">🔀 Outra frase</button><button class="chip" id="escrever">✍️ Escrever a minha</button></div>`}`}
      <p class="muted small" style="margin:10px 0 0">Fale a frase no microfone, normal e bem claro. ${esc(r.imita)} não pode ouvir!</p></div>
      ${r.original ? `
        <div class="card center"><span class="label">Gravado ✅ · ${A.duracao(r.original).toFixed(1)}s</span>
          <button class="btn secondary" id="ouvirOrig">▶️ Ouvir (normal)</button>
          <button class="btn secondary" id="ouvirInv">🔄 Ouvir ao contrário</button>
          <button class="btn ghost" id="regravar">🎙️ Gravar de novo</button></div>
        <button class="btn" id="pronto">Pronto — passar para ${esc(r.imita)}</button>`
      : htmlGravador('gravar', '🎙️ Gravar a frase')}`);
    ligarSair();
    const inp = document.getElementById('frase');
    if (inp) inp.oninput = () => { r.frase = inp.value.trim(); };
    const outra = document.getElementById('outra');
    if (outra) outra.onclick = () => { r.frase = F.sortear(p.tema, p.usados.concat([r.frase])); telaFala(); };
    const escr = document.getElementById('escrever');
    if (escr) escr.onclick = () => { r.editando = true; r.frase = ''; telaFala(); const i = document.getElementById('frase'); if (i) i.focus(); };
    ligarGravador('gravar', '🎙️ Gravar a frase', buf => { r.original = buf; r.invertido = A.inverter(buf); telaFala(); });
    ligarPlay('ouvirOrig', () => r.original);
    ligarPlay('ouvirInv', () => r.invertido);
    const reg = document.getElementById('regravar');
    if (reg) reg.onclick = () => { r.original = null; r.invertido = null; telaFala(); };
    const pr = document.getElementById('pronto');
    if (pr) pr.onclick = () => {
      if (inp) r.frase = inp.value.trim();
      if (!r.frase) { C.toast('Escreva a frase que você falou.'); if (inp) inp.focus(); return; }
      p.usados.push(r.frase);
      telaPasseImita();
    };
  }

  function telaPasseImita() {
    const r = p.rodadas[p.k];
    render(`${cab()}<div class="pass"><div class="emoji">🔄</div>
      <p style="margin:10px 0 4px">Entregue o celular para</p><div class="big-name">${esc(r.imita)}</div>
      <p class="muted">Você vai ouvir a frase de ${esc(r.fala)} <strong>ao contrário</strong> e tentar imitar.</p>
      <button class="btn" id="ir">Sou ${esc(r.imita)} — ouvir</button></div>`);
    ligarSair();
    document.getElementById('ir').onclick = () => { A.ctx(); telaImita(); };
  }

  function telaImita() {
    const r = p.rodadas[p.k];
    const ult = r.imitacoes[r.imitacoes.length - 1];
    const resta = p.tentativas - r.imitacoes.length;
    render(`${cab()}<div class="card center"><span class="label">${esc(r.imita)} imita</span>
      <p class="muted small" style="margin:4px 0 10px">Ouça quantas vezes quiser e repita o som do jeito que ouviu — sílaba por sílaba, mesmo sem sentido.</p>
      <button class="btn secondary" id="ouvirInv">🔄 Ouvir o áudio ao contrário (${A.duracao(r.invertido).toFixed(1)}s)</button></div>
      ${ult ? `
        <div class="card center"><span class="label">Imitação ${r.imitacoes.length} de ${p.tentativas} ✅</span>
          <p class="muted small" style="margin:4px 0 10px">Todo mundo perto do celular! O app vai tocar sua imitação ao contrário.</p>
          <button class="btn" id="ouvirRes">🔊 Tocar a imitação ao contrário</button>
          <button class="btn secondary" id="ouvirMinha">▶️ Ouvir minha imitação (como gravei)</button>
          ${resta > 0 ? `<button class="btn ghost" id="denovo">🎙️ Tentar de novo (${C.plural(resta, 'tentativa restante', 'tentativas restantes')})</button>` : ''}</div>
        <button class="btn" id="chutar">✍️ Escrever meu palpite</button>`
      : htmlGravador('gravar', '🎙️ Gravar a imitação')}`);
    ligarSair();
    ligarPlay('ouvirInv', () => r.invertido);
    ligarGravador('gravar', '🎙️ Gravar a imitação', buf => { r.imitacoes.push({ gravado: buf, resultado: A.inverter(buf) }); r.novo = true; telaImita(); });
    ligarPlay('ouvirRes', () => ult && ult.resultado);
    ligarPlay('ouvirMinha', () => ult && ult.gravado);
    const dn = document.getElementById('denovo');
    if (dn) dn.onclick = renderGravarDeNovo;
    const ch = document.getElementById('chutar');
    if (ch) ch.onclick = telaPalpite;
    // toca o resultado sozinho assim que a imitação é gravada
    if (ult && r.novo) { r.novo = false; const b = document.getElementById('ouvirRes'); if (b) setTimeout(() => b.click(), 250); }
  }
  // tela para regravar (mantém as tentativas anteriores)
  function renderGravarDeNovo() {
    const r = p.rodadas[p.k];
    render(`${cab()}<div class="card center"><span class="label">${esc(r.imita)} · tentativa ${r.imitacoes.length + 1} de ${p.tentativas}</span>
      <button class="btn secondary" id="ouvirInv">🔄 Ouvir o áudio ao contrário</button></div>
      ${htmlGravador('gravar', '🎙️ Gravar a imitação')}
      <button class="btn ghost" id="cancelar">← Voltar para a última imitação</button>`);
    ligarSair();
    ligarPlay('ouvirInv', () => r.invertido);
    ligarGravador('gravar', '🎙️ Gravar a imitação', buf => { r.imitacoes.push({ gravado: buf, resultado: A.inverter(buf) }); r.novo = true; telaImita(); });
    document.getElementById('cancelar').onclick = telaImita;
  }

  // quem imitou escreve o que acha que é a frase
  function telaPalpite() {
    const r = p.rodadas[p.k];
    const ult = r.imitacoes[r.imitacoes.length - 1];
    render(`${cab()}<div class="card center"><span class="label">${esc(r.imita)}, qual é a frase?</span>
      <p class="muted small" style="margin:4px 0 10px">Ouça sua imitação ao contrário e escreva a frase que você acha que ${esc(r.fala)} falou.</p>
      <button class="btn secondary" id="ouvirRes">🔊 Tocar a imitação ao contrário</button>
      <input class="campo" id="palpite" maxlength="80" placeholder="Escreva seu palpite" value="${esc(r.palpite || '')}" style="margin-top:10px" autocomplete="off"></div>
      <button class="btn" id="enviar">👀 Enviar palpite e revelar</button>`);
    ligarSair();
    ligarPlay('ouvirRes', () => ult.resultado);
    const inp = document.getElementById('palpite');
    inp.oninput = () => { r.palpite = inp.value.trim(); };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('enviar').click(); } };
    document.getElementById('enviar').onclick = () => {
      r.palpite = inp.value.trim();
      if (!r.palpite) { C.toast('Escreva seu palpite (mesmo que seja um chute).'); inp.focus(); return; }
      r.votos = {}; telaRevela();
    };
  }

  // parecido de 0 a 100 entre a frase escrita e o palpite (só uma ajuda; quem decide são os dois)
  function parecido(a, b) {
    a = C.norm(a); b = C.norm(b);
    if (!a || !b) return 0;
    if (a === b) return 100;
    const n = Math.max(a.length, b.length);
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return Math.max(0, Math.round(100 * (1 - prev[b.length] / n)));
  }

  function telaRevela() {
    const r = p.rodadas[p.k];
    const ult = r.imitacoes[r.imitacoes.length - 1];
    const v = r.votos, quem = [r.fala, r.imita];
    const votaram = quem.every(n => v[n] !== undefined);
    const concordam = votaram && v[r.fala] === v[r.imita];
    const pct = parecido(r.frase, r.palpite);
    const btnVoto = (n, val, txt) => `<button type="button" class="chip ${v[n] === val ? 'on' : ''}" data-voto="${esc(n)}" data-val="${val ? 1 : 0}">${txt}</button>`;
    render(`${cab()}<div class="card center">
        <span class="label">Frase que ${esc(r.fala)} escreveu</span>
        <div class="big-name rv-frase">“${esc(r.frase)}”</div>
        <span class="label" style="margin-top:6px">Palpite de ${esc(r.imita)}</span>
        <div class="big-name rv-frase" style="color:var(--accent2)">“${esc(r.palpite)}”</div>
        <p class="muted small" style="margin:0">${pct === 100 ? '🎯 Idênticas!' : `Parecido: ${pct}%`}</p></div>
      <div class="card center"><span class="label">Ouça e confira</span>
        <button class="btn secondary" id="ouvirOrig">▶️ O que ${esc(r.fala)} falou (original)</button>
        <button class="btn secondary" id="ouvirRes">🔄 Imitação de ${esc(r.imita)} ao contrário</button>
        <button class="btn secondary" id="comparar">🆚 Os dois em sequência</button></div>
      <div class="card"><span class="label">Os dois confirmam: acertou a frase?</span>
        ${quem.map(n => `<div class="row" style="align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap">
          <strong style="min-width:90px">${esc(n)}</strong><span class="muted small">${n === r.fala ? '(gravou)' : '(imitou)'}</span>
          <div class="chips" style="margin:0">${btnVoto(n, true, '✅ Acertou')}${btnVoto(n, false, '❌ Errou')}</div></div>`).join('')}
        ${votaram && !concordam ? '<p class="small" style="margin:6px 0 0;color:#ff6b6b">⚠️ Vocês discordaram. Conversem e mudem o voto até concordar.</p>' : ''}
        ${concordam ? `<p class="small" style="margin:6px 0 0"><strong>${v[r.fala] ? '✅ Acertou!' : '❌ Errou.'}</strong> ${v[r.fala] ? `${esc(r.fala)} e ${esc(r.imita)} ganham 1 ponto cada.` : 'Ninguém pontua nesta rodada.'}</p>` : ''}
        ${!votaram ? '<p class="muted small" style="margin:6px 0 0">Se acertar, quem gravou e quem imitou ganham 1 ponto cada.</p>' : ''}</div>
      <button class="btn" id="prox" ${concordam ? '' : 'disabled'}>${p.k + 1 >= p.rodadas.length ? '🏆 Ver resultado' : 'Próxima rodada'}</button>
      ${htmlPlacar()}`);
    ligarSair();
    ligarPlay('ouvirOrig', () => r.original);
    ligarPlay('ouvirRes', () => ult.resultado);
    const cmp = document.getElementById('comparar');
    const cmpTxt = cmp.innerHTML;
    cmp.onclick = () => { if (cmp.dataset.on) { delete cmp.dataset.on; A.parar(); cmp.innerHTML = cmpTxt; return; } tocarSeq([r.original, ult.resultado], cmp, cmpTxt); };
    app.querySelectorAll('[data-voto]').forEach(b => b.onclick = () => {
      const y = window.scrollY;
      v[b.dataset.voto] = b.dataset.val === '1';
      telaRevela(); window.scrollTo(0, y);
    });
    document.getElementById('prox').onclick = () => {
      if (!concordam) return;
      r.acertou = !!v[r.fala];
      if (r.acertou) { p.pts[r.fala]++; p.pts[r.imita]++; p.tb[r.imita]++; }
      r.feita = true;
      // libera a memória dos áudios antigos
      r.original = r.invertido = null; r.imitacoes = [];
      if (p.k + 1 >= p.rodadas.length) return telaFinal();
      p.k++; telaPasseFala();
    };
  }

  function classif() {
    return C.classificar(p.jogadores.map(n => ({ nome: n, pts: p.pts[n], tb: [p.tb[n]] })), ['acertos imitando']);
  }
  function htmlPlacar() {
    if (!p || !p.rodadas.some(r => r.feita)) return '';
    return `<div class="card"><span class="label">Placar</span>${classif().rank.map(([n, s]) => `<p style="margin:6px 0">${esc(n)} — <strong>${C.plural(s, 'pt')}</strong></p>`).join('')}</div>`;
  }
  function telaFinal() {
    const cl = classif();
    window.Ranking && Ranking.registrar(p, 'reverso', p.jogadores, cl.camp);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">Venceu</p>
      <h1 class="logo" style="font-size:2rem">${cl.camp.map(esc).join('<br>')}</h1></div>
      ${C.htmlDesempate(cl.motivo)}
      ${C.htmlPodio(cl.rank)}
      <div class="card"><span class="label">Rodadas</span>${p.rodadas.map(r => `<p class="small" style="margin:6px 0">${r.acertou ? '✅' : '❌'} <strong>${esc(r.fala)}</strong> → ${esc(r.imita)}: “${esc(r.frase)}” <span class="muted">· palpite: “${esc(r.palpite || '')}”</span></p>`).join('')}</div>
      <button class="btn" id="denovo">Jogar de novo</button>
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    document.getElementById('denovo').onclick = telaSetup;
  }

  // estilos próprios do jogo
  const st = document.createElement('style');
  st.textContent = `
    .rv-frase { font-size: 1.9rem; font-weight: 900; margin: 12px 0; line-height: 1.2; }
    .rv-rec { font-size: 1.15rem; padding: 18px; }
    .rv-rec.gravando { background: #e5383b; animation: rvPulso 1s infinite; }
    @keyframes rvPulso { 50% { opacity: .75; } }
    .rv-nivel { height: 6px; border-radius: 3px; background: var(--bg2); overflow: hidden; margin: 8px 0 0; }
    .rv-nivel > div { height: 100%; width: 0; background: #2ec4b6; transition: width .08s; }`;
  document.head.appendChild(st);

  telaSetup();
})();
