// Monta o Time — modo um celular
// Critério fixo na partida (ex.: time mais alto). A cada rodada sai um tema (ex.: "Jogou pela Seleção Portuguesa").
// Cada um escolhe, em segredo, um jogador do tema para uma posição vazia do seu time (GOL, 2 DEF, 2 MEI, 2 ATA).
// Vale o número do critério (ex.: altura). Fora do tema = 0 (ou penalidade nos critérios de "menor vence").
(function () {
  const C = window.Comum, F = window.Futebol;
  const { esc, store, toast } = C;
  const app = document.getElementById('app');
  const render = html => { C.pararContagem(); app.innerHTML = html; window.scrollTo(0, 0); };

  const cfg = {
    jogadores: C.carregarJogadores(),
    crit: store.get('mt:crit', 'alto'),
    grupos: store.get('mt:grupos2', F.GRUPOS_PADRAO.slice())
  };
  const salvar = () => { store.set('mt:crit', cfg.crit); store.set('mt:grupos2', cfg.grupos); };
  let p = null;

  function telaSetup() {
    const pode = cfg.jogadores.length >= 1;
    render(`
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="montatime-sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px"><div class="logo">Monta o Time</div>
        <p class="muted" style="margin:4px 0 0">Monte o melhor time de acordo com o critério.<br>A cada rodada, um tema diferente: escolha alguém que se encaixe.</p></div>
      ${C.htmlEditorJogadores(cfg.jogadores)}
      <div class="card"><span class="label">Critério da partida</span>
        <button class="list-opt ${cfg.crit === 'sortear' ? 'on' : ''}" data-crit="sortear"><strong>🎲 Sortear</strong></button>
        ${F.CRITERIOS.map(c => `<button class="list-opt ${cfg.crit === c.id ? 'on' : ''}" data-crit="${c.id}"><strong>${esc(c.nome)}</strong><span class="muted small">${esc(c.desc)}</span></button>`).join('')}
      </div>
      <div class="card"><span class="label">Tipos de tema das rodadas</span>
        <div class="chips">${F.GRUPOS_TEMA.map(gp => `<button class="chip ${cfg.grupos.includes(gp) ? 'on' : ''}" data-gp="${gp}">${gp}</button>`).join('')}</div>
        <p class="muted small" style="margin:10px 0 0">“Mais clubes” = clubes menos conhecidos (Spartak, Celtic, Udinese…), começa desligado. Se cair um tema que ninguém conhece, dá para trocar na hora. São 7 rodadas, uma para cada posição: GOL, 2 defensores, 2 meias e 2 atacantes. Dados: Wikidata (set/2026).</p>
      </div>
      <button class="btn" id="comecar" ${pode ? '' : 'disabled'}>Começar</button>
    `);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-crit]').forEach(b => b.onclick = () => { cfg.crit = b.dataset.crit; salvar(); telaSetup(); });
    app.querySelectorAll('[data-gp]').forEach(b => b.onclick = () => {
      const g = b.dataset.gp; cfg.grupos = cfg.grupos.includes(g) ? cfg.grupos.filter(x => x !== g) : [...cfg.grupos, g];
      if (!cfg.grupos.length) cfg.grupos = [g]; salvar(); telaSetup();
    });
    document.getElementById('comecar').onclick = iniciar;
  }

  function iniciar() {
    const crit = cfg.crit === 'sortear' ? F.CRITERIOS[Math.floor(Math.random() * F.CRITERIOS.length)] : F.criterio(cfg.crit);
    p = {
      crit, rodada: 0, total: 7, usados: [],
      times: Object.fromEntries(cfg.jogadores.map(j => [j, {}])),
      offset: 0, escolhas: {}, tema: null, historico: []
    };
    novaRodada();
  }

  function sortearTema() {
    const pool = F.TEMAS.filter(t => cfg.grupos.includes(t.grupo) && !p.usados.includes(t.id) && F.temaValido(t, p.crit));
    const pool2 = F.TEMAS.filter(t => cfg.grupos.includes(t.grupo) && t.id !== (p.tema && p.tema.id) && F.temaValido(t, p.crit));
    const base = pool.length ? pool : pool2.length ? pool2 : F.TEMAS.filter(t => F.temaValido(t, p.crit));
    const t = base[Math.floor(Math.random() * base.length)];
    p.usados.push(t.id);
    return t;
  }

  function novaRodada() {
    p.rodada++; p.escolhas = {}; p.vez = 0;
    const n = cfg.jogadores.length, ini = (p.rodada - 1) % n;
    p.ordem = cfg.jogadores.slice(ini).concat(cfg.jogadores.slice(0, ini));
    p.tema = sortearTema();
    telaTema();
  }

  const cab = () => `<div class="topbar"><span class="pill">Rodada ${p.rodada}/${p.total} · ${esc(p.crit.nome)}</span><button class="link-back" id="sair">Sair</button></div>`;
  function ligarSair() { const s = document.getElementById('sair'); if (s) s.onclick = () => { if (confirm('Sair da partida?')) { p = null; telaSetup(); } }; }
  const cartaoTema = () => `<div class="card center"><div class="muted small">Tema da rodada</div><div class="question" style="font-size:1.45rem">${esc(p.tema.nome)}</div>
    <div class="muted small">${esc(p.crit.nome)} · ${esc(p.crit.desc)}</div></div>`;

  function telaTema() {
    render(`${cab()}${cartaoTema()}
      <p class="muted small center">Ordem: ${p.ordem.map(esc).join(' → ')}</p>
      <button class="btn" id="ir">Começar as escolhas</button>
      <button class="btn ghost" id="trocar">🔄 Sortear outro tema</button>`);
    ligarSair();
    document.getElementById('ir').onclick = telaPasse;
    document.getElementById('trocar').onclick = () => { p.tema = sortearTema(); telaTema(); };
  }

  // trocar o tema no meio da rodada: quem já escolheu escolhe de novo
  const botaoTrocar = () => `<button class="btn ghost" id="trocarTema" style="margin-top:12px">🔄 Ninguém conhece? Trocar o tema</button>`;
  function ligarTrocar() {
    const b = document.getElementById('trocarTema'); if (!b) return;
    b.onclick = () => {
      if (Object.keys(p.escolhas).length && !confirm('Trocar o tema? Quem já escolheu nesta rodada vai escolher de novo.')) return;
      p.tema = sortearTema(); p.escolhas = {}; p.vez = 0; telaTema();
    };
  }

  function telaPasse() {
    const nome = p.ordem[p.vez];
    render(`${cab()}<div class="pass"><div class="emoji">📱</div><p class="muted">Passe o celular para</p><div class="big-name">${esc(nome)}</div>
      <button class="btn" id="sou">Sou ${esc(nome)}, escolher</button></div>
      ${botaoTrocar()}`);
    ligarSair(); ligarTrocar();
    document.getElementById('sou').onclick = telaEscolha;
  }

  function telaEscolha() {
    const nome = p.ordem[p.vez], time = p.times[nome];
    const vazios = F.SLOTS.filter(s => !time[s.k]);
    let escolhido = null, slot = null;
    render(`${cab()}${cartaoTema()}
      <p style="margin:0 0 8px"><strong style="font-size:1.3rem">${esc(nome)}</strong>, escolha seu jogador:</p>
      ${F.htmlBusca('busca')}
      <div id="slots" class="card hidden"><span class="label">Em qual posição?</span><div class="chips" id="slotBtns"></div></div>
      <button class="btn" id="confirmar" disabled>Confirmar</button>
      ${F.htmlCampo(time, p.crit, 'Seu time')}
      ${botaoTrocar()}`);
    ligarSair(); ligarTrocar();
    const confirmar = document.getElementById('confirmar');
    const atualizar = () => { confirmar.disabled = !(escolhido && slot); };
    F.ligarBusca('busca', j => {
      escolhido = j; slot = null;
      const box = document.getElementById('slots'), btns = document.getElementById('slotBtns');
      if (!j) { box.classList.add('hidden'); atualizar(); return; }
      if (Object.values(time).some(s => s && s.id === j.id)) { toast('Esse jogador já está no seu time.'); escolhido = null; box.classList.add('hidden'); atualizar(); return; }
      // cada jogador de futebol só pode estar em um time da partida (quem confirmou primeiro fica com ele)
      const dono = cfg.jogadores.find(n => n !== nome && (Object.values(p.times[n]).some(s => s && s.id === j.id) || (p.escolhas[n] && p.escolhas[n].id === j.id)));
      const inval = dono ? `${j.nome} já está no time de ${dono}. Escolha outro jogador.` : F.motivoInvalido(j, p.tema, p.crit);
      if (inval) { escolhido = null; box.classList.remove('hidden'); btns.innerHTML = `<span class="erro-escolha">❌ ${esc(inval)}</span>`; atualizar(); return; }
      const ok = vazios.filter(s => F.encaixa(j, s.g)).filter((s, i, arr) => arr.findIndex(x => x.g === s.g) === i);
      box.classList.remove('hidden');
      btns.innerHTML = ok.length ? ok.map(s => `<button class="chip" data-slot="${s.k}">${F.POSN[s.g]}</button>`).join('')
        : `<span class="muted small">Sem posição livre para um ${esc(F.descPos(j).toLowerCase())}. Escolha outro jogador.</span>`;
      if (ok.length === 1) slot = ok[0].k;
      btns.querySelectorAll('[data-slot]').forEach(b => { if (b.dataset.slot === slot) b.classList.add('on'); b.onclick = () => { slot = b.dataset.slot; btns.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); atualizar(); }; });
      atualizar();
    });
    const seguir = () => { p.vez++; if (p.vez < p.ordem.length) telaPasse(); else revelar(); };
    confirmar.onclick = () => { p.escolhas[nome] = { id: escolhido.id, slot }; seguir(); };
    if (C.timerLigado()) C.contagem(Date.now() + C.TEMPO, () => {
      const oc = cfg.jogadores.flatMap(n => [...Object.values(p.times[n]).filter(Boolean).map(s => s.id), ...(p.escolhas[n] ? [p.escolhas[n].id] : [])]);
      const a = F.sortearAuto(p.tema, p.crit, vazios, oc);
      if (a) { p.escolhas[nome] = { id: a.id, slot: a.slot }; toast(`⏱️ Acabou o tempo de ${nome}. Sorteei ${a.nome}.`); }
      else { const s = ['G', 'D', 'M', 'A'].map(g => vazios.find(x => x.g === g)).find(Boolean); const j = F.J.find(x => F.encaixa(x, s.g)); p.escolhas[nome] = { id: j.id, slot: s.k }; }
      seguir();
    });
  }

  function revelar() {
    const linhas = p.ordem.map(nome => {
      const e = p.escolhas[nome], j = F.porId[e.id], r = F.pontuar(j, p.tema, p.crit);
      p.times[nome][e.slot] = { id: j.id, nome: j.nome, v: r.v, ok: r.ok };
      return { nome, j, r, slot: e.slot };
    });
    p.historico.push({ tema: p.tema.nome, linhas: linhas.map(l => ({ nome: l.nome, jogador: l.j.nome, ok: l.r.ok, v: l.r.v })) });
    render(`${cab()}${cartaoTema()}
      <div class="card"><span class="label">Escolhas</span>
        ${linhas.map((l, i) => `<div class="result ${l.r.ok ? 'exact' : 'bust'}" style="animation-delay:${i * .12}s"><span class="who">${esc(l.nome)}<br><span class="small muted">${esc(l.j.nome)} · ${F.POSN[l.slot[0]]}${l.r.ok ? '' : ' · ❌ ' + esc(l.r.motivo)}</span></span><span class="pts">${esc(p.crit.fmt(l.r.v))}</span></div>`).join('')}
      </div>
      <div class="card"><span class="label">Placar</span>${placar()}</div>
      <button class="btn" id="prox">${p.rodada >= p.total ? '🏆 Ver resultado' : 'Próxima rodada'}</button>`);
    ligarSair();
    document.getElementById('prox').onclick = () => p.rodada >= p.total ? telaFinal() : novaRodada();
  }

const tbTime = (slots, maior) => Object.values(slots || {}).filter(Boolean).map(x => maior ? x.v : -x.v).sort((a, b) => b - a);
  const ROT_MT = ['ter o melhor jogador do time', 'o 2º melhor jogador', 'o 3º melhor jogador', 'o 4º melhor jogador', 'o 5º melhor jogador', 'o 6º melhor jogador', 'o 7º melhor jogador'];
  function ranking() {
    const r = cfg.jogadores.map(n => [n, F.total(p.times[n])]);
    return r.sort((a, b) => p.crit.maior ? b[1] - a[1] : a[1] - b[1]);
  }
  const placar = () => `<table class="score">${ranking().map(([n, v]) => `<tr><td>${esc(n)}</td><td>${esc(p.crit.fmt(v))}</td></tr>`).join('')}</table>`;

  function telaFinal() {
    const cl = C.classificar(cfg.jogadores.map(n => ({ nome: n, pts: F.total(p.times[n]), tb: tbTime(p.times[n], p.crit.maior) })), ROT_MT, !p.crit.maior);
    const camp = cl.camp;
    window.Ranking && Ranking.registrar(p, 'montatime', cfg.jogadores, camp);
    render(`<div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${esc(p.crit.nome)} · ${camp.length > 1 ? 'Empate!' : 'Campeão'}</p>
        <h1 class="logo" style="font-size:2.3rem">${camp.map(esc).join(' & ')}</h1></div>
      ${C.htmlDesempate(cl.motivo)}
      <div class="card"><span class="label">Classificação</span><table class="score">${cl.rank.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${esc(p.crit.fmt(v))}</td></tr>`).join('')}</table></div>
      ${cl.rank.map(([n, v]) => `<div style="margin-bottom:14px">${F.htmlCampo(p.times[n], p.crit, `${esc(n)} · ${esc(p.crit.fmt(v))}`)}</div>`).join('')}
      <div class="card"><span class="label">Temas da partida</span>${p.historico.map((h, i) => `<p class="small" style="margin:6px 0"><strong>${i + 1}. ${esc(h.tema)}</strong><br>${h.linhas.map(l => `${esc(l.nome)}: ${esc(l.jogador)} ${l.ok ? '✅' : '❌'}`).join(' · ')}</p>`).join('')}</div>
      <button class="btn" id="denovo">Jogar de novo</button>
      <button class="btn secondary" id="config">Mudar jogadores / critério</button>
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    document.getElementById('denovo').onclick = iniciar;
    document.getElementById('config').onclick = () => { p = null; telaSetup(); };
  }

  telaSetup();
})();
