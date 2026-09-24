// Impostor — modo um celular
// Todos recebem a mesma palavra, menos o(s) impostor(es).
// Modo "parecida": o impostor recebe uma palavra parecida e não sabe que é impostor.
// Modo "dica": o impostor sabe que é impostor e recebe uma dica.
// Depois das rodadas de palavras, votação: a maioria pegou o impostor → inocentes ganham.
// Votaram num inocente → impostores ganham. Com mais de um impostor, o jogo segue até pegar todos.
(function () {
  const C = window.Comum;
  const { esc, store, toast } = C;
  const app = document.getElementById('app');
  const BANCO = window.PALAVRAS_IMPOSTOR || [];
  const CATS = g => [...new Set(BANCO.filter(q => q.g === g).map(q => q.c))];

  const cfg = {
    jogadores: C.carregarJogadores(),
    grupo: store.get('imp:grupo', 'Futebol'),
    cats: store.get('imp:cats', null),
    modo: store.get('imp:modo', 'dica'), // 'dica' | 'parecida'
    impostores: store.get('imp:impostores', 1),
    rodadas: store.get('imp:rodadas', 2),
    votacao: store.get('imp:votacao', 'secreta') // 'secreta' | 'aberta'
  };
  const salvar = () => ['grupo', 'cats', 'modo', 'impostores', 'rodadas', 'votacao'].forEach(k => store.set('imp:' + k, cfg[k]));
  let usadas = new Set(store.get('imp:usadas', []));
  const placar = {}; // placar da noite (não salvo)

  let p = null;
  const render = html => { app.innerHTML = html; window.scrollTo(0, 0); };
  const maxImp = () => Math.max(1, Math.floor((cfg.jogadores.length - 1) / 2));

  function catsAtivas() {
    const todas = CATS(cfg.grupo);
    const sel = (cfg.cats && cfg.cats[cfg.grupo]) || todas;
    const f = sel.filter(c => todas.includes(c));
    return f.length ? f : todas;
  }

  // ---------- configuração ----------
  function telaSetup() {
    if (cfg.impostores > maxImp()) cfg.impostores = maxImp();
    const pode = cfg.jogadores.length >= 3;
    const ativas = catsAtivas();
    const opt = (key, val, label, desc) => `<button class="list-opt ${cfg[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}"><strong>${label}</strong>${desc ? `<span class="muted small">${desc}</span>` : ''}</button>`;
    render(`
      <div class="topbar"><a class="link-back" href="../">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px">
        <div class="logo">Impostor</div>
        <p class="muted" style="margin:4px 0 0">Todos sabem a palavra, menos o impostor.<br>Falem pistas, descubram quem está blefando.</p>
      </div>

      ${C.htmlEditorJogadores(cfg.jogadores)}
      ${cfg.jogadores.length < 3 ? '<p class="muted small center" style="margin-top:-6px">Mínimo de 3 jogadores.</p>' : ''}

      <div class="card">
        <span class="label">Tema</span>
        <div class="chips" style="margin-bottom:12px">
          <button class="chip ${cfg.grupo === 'Futebol' ? 'on' : ''}" data-grupo="Futebol">⚽ Futebol</button>
          <button class="chip ${cfg.grupo === 'Geral' ? 'on' : ''}" data-grupo="Geral">🌎 Geral</button>
        </div>
        <div class="chips">
          ${CATS(cfg.grupo).map(c => `<button class="chip ${ativas.includes(c) ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <span class="label">O que o impostor recebe</span>
        ${opt('modo', 'dica', '🕵️ Uma dica', 'Ele sabe que é o impostor e recebe uma pista ampla (ex.: "meio-campista espanhol").')}
        ${opt('modo', 'parecida', '🎭 Uma palavra parecida', 'Ele NÃO sabe que é o impostor: recebe algo parecido (ex.: Iniesta em vez de Xavi) e precisa perceber sozinho.')}
      </div>

      <div class="card">
        <span class="label">Impostores</span>
        <div class="chips" style="margin-bottom:14px">
          ${[1, 2, 3].map(n => `<button class="chip ${cfg.impostores === n ? 'on' : ''}" data-imp="${n}" ${n > maxImp() ? 'disabled style="opacity:.3"' : ''}>${n}</button>`).join('')}
        </div>
        <span class="label">Rodadas de palavras antes de votar</span>
        <div class="chips" style="margin-bottom:14px">
          ${[1, 2, 3].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}
        </div>
        <span class="label">Votação</span>
        <div class="chips">
          <button class="chip ${cfg.votacao === 'secreta' ? 'on' : ''}" data-vot="secreta">🤫 Secreta (passa o celular)</button>
          <button class="chip ${cfg.votacao === 'aberta' ? 'on' : ''}" data-vot="aberta">🗣️ Aberta (decidem juntos)</button>
        </div>
      </div>

      <button class="btn" id="comecar" ${pode ? '' : 'disabled'}>Começar</button>
      ${Object.keys(placar).length ? `<div class="card" style="margin-top:14px"><span class="label">Placar da noite</span>${tabelaPlacar()}</div>` : ''}
    `);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { cfg[b.dataset.k] = b.dataset.v; salvar(); telaSetup(); });
    app.querySelectorAll('[data-grupo]').forEach(b => b.onclick = () => { cfg.grupo = b.dataset.grupo; salvar(); telaSetup(); });
    app.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
      const c = b.dataset.cat; let at = catsAtivas();
      at = at.includes(c) ? at.filter(x => x !== c) : [...at, c];
      if (!at.length) { toast('Deixe pelo menos uma categoria.'); return; }
      cfg.cats = { ...(cfg.cats || {}), [cfg.grupo]: at }; salvar(); telaSetup();
    });
    app.querySelectorAll('[data-imp]').forEach(b => b.onclick = () => { if (+b.dataset.imp <= maxImp()) { cfg.impostores = +b.dataset.imp; salvar(); telaSetup(); } });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { cfg.rodadas = +b.dataset.rod; salvar(); telaSetup(); });
    app.querySelectorAll('[data-vot]').forEach(b => b.onclick = () => { cfg.votacao = b.dataset.vot; salvar(); telaSetup(); });
    document.getElementById('comecar').onclick = iniciar;
  }

  function sortearPalavra() {
    const cats = catsAtivas();
    const doTema = BANCO.filter(q => q.g === cfg.grupo && cats.includes(q.c));
    let pool = doTema.filter(q => !usadas.has(q.p));
    if (!pool.length) { pool = doTema; usadas = new Set(); toast('Todas as palavras desse tema já saíram. Recomeçando.'); }
    const q = pool[Math.floor(Math.random() * pool.length)];
    usadas.add(q.p); store.set('imp:usadas', [...usadas]);
    return q;
  }

  function iniciar() {
    const palavra = sortearPalavra();
    const js = cfg.jogadores.slice();
    const impostores = new Set(C.shuffle(js).slice(0, cfg.impostores));
    const ini = Math.floor(Math.random() * js.length);
    p = {
      palavra,
      impostores,
      jogadores: js,
      vivos: new Set(js),
      pegos: [],
      falas: js.slice(ini).concat(js.slice(0, ini)), // ordem de fala (começa aleatório)
      revelar: 0,
      rodadaFala: 1,
      rodadasAlvo: cfg.rodadas,
      votos: {},
      eleitorIdx: 0,
      candidatos: null,
      segundoTurno: false
    };
    telaPasse();
  }

  // ---------- distribuição das palavras ----------
  function telaPasse() {
    const nome = p.jogadores[p.revelar];
    render(`
      <div class="topbar"><span class="pill">Distribuindo ${p.revelar + 1}/${p.jogadores.length}</span><button class="link-back" id="sair">Sair</button></div>
      <div class="pass">
        <div class="emoji">📱</div>
        <p class="muted">Passe o celular para</p>
        <div class="big-name">${esc(nome)}</div>
        <p class="muted small">Só ${esc(nome)} pode ver a próxima tela.</p>
        <button class="btn" id="ver">Sou ${esc(nome)}, ver minha palavra</button>
      </div>
    `);
    ligarSair();
    document.getElementById('ver').onclick = telaSegredo;
  }

  function cartaSecreta(nome) {
    const imp = p.impostores.has(nome);
    const q = p.palavra;
    if (!imp) return `<div class="secret"><div class="muted small">A palavra é</div><div class="secret-word">${esc(q.p)}</div><div class="muted small">${esc(q.c)}</div></div>`;
    if (cfg.modo === 'parecida') return `<div class="secret"><div class="muted small">A palavra é</div><div class="secret-word">${esc(q.s)}</div><div class="muted small">${esc(q.c)}</div></div>`;
    return `<div class="secret imp"><div class="secret-word" style="color:var(--accent)">Você é o IMPOSTOR</div>
      ${cfg.impostores > 1 ? `<div class="muted small">Tem ${cfg.impostores} impostores nesta partida.</div>` : ''}
      <div style="margin-top:14px" class="muted small">Dica</div><div style="font-size:1.3rem;font-weight:800">${esc(q.d)}</div>
      <div class="muted small" style="margin-top:6px">${esc(q.c)}</div></div>`;
  }

  function telaSegredo() {
    const nome = p.jogadores[p.revelar];
    render(`
      <div class="topbar"><span class="pill">${esc(nome)}</span><button class="link-back" id="sair">Sair</button></div>
      <div class="card" id="carta" style="min-height:260px;display:grid;place-items:center;cursor:pointer;text-align:center">
        <div id="capa"><div class="emoji" style="font-size:3rem">👆</div><strong>Toque para revelar</strong><div class="muted small">Não deixe ninguém ver</div></div>
        <div id="conteudo" class="hidden">${cartaSecreta(nome)}</div>
      </div>
      <button class="btn hidden" id="esconder">Esconder e passar</button>
    `);
    ligarSair();
    document.getElementById('carta').onclick = () => {
      document.getElementById('capa').classList.add('hidden');
      document.getElementById('conteudo').classList.remove('hidden');
      document.getElementById('esconder').classList.remove('hidden');
    };
    document.getElementById('esconder').onclick = () => {
      p.revelar++;
      if (p.revelar < p.jogadores.length) telaPasse(); else telaFalas();
    };
  }

  // ---------- rodadas de palavras ----------
  function ordemViva() { return p.falas.filter(j => p.vivos.has(j)); }

  function telaFalas() {
    const ordem = ordemViva();
    render(`
      <div class="topbar"><span class="pill">Rodada de pistas ${p.rodadaFala}/${p.rodadasAlvo}</span><button class="link-back" id="sair">Sair</button></div>
      <div class="card center">
        <div class="emoji" style="font-size:2.4rem">🗣️</div>
        <h2 style="margin:6px 0">Cada um fala UMA palavra</h2>
        <p class="muted small" style="margin:0">Relacionada à palavra secreta, sem entregar demais. Na ordem:</p>
      </div>
      <div class="card">
        ${ordem.map((j, i) => `<div class="lineup-row"><span class="pos">${i + 1}º</span><span class="grow"><strong>${esc(j)}</strong></span></div>`).join('')}
      </div>
      ${p.pegos.length ? `<p class="muted small center">Fora: ${p.pegos.map(esc).join(', ')} (impostor${p.pegos.length > 1 ? 'es' : ''} pego${p.pegos.length > 1 ? 's' : ''})</p>` : ''}
      <button class="btn" id="fim">${p.rodadaFala < p.rodadasAlvo ? 'Todos falaram, próxima rodada' : 'Todos falaram, ir para a votação'}</button>
    `);
    ligarSair();
    document.getElementById('fim').onclick = () => {
      if (p.rodadaFala < p.rodadasAlvo) { p.rodadaFala++; telaFalas(); }
      else iniciarVotacao();
    };
  }

  // ---------- votação ----------
  function iniciarVotacao(candidatos) {
    p.votos = {};
    p.eleitorIdx = 0;
    p.candidatos = candidatos || null;
    if (cfg.votacao === 'aberta') return telaVotoAberto();
    telaPasseVoto();
  }

  const eleitores = () => ordemViva();
  const opcoesVoto = eleitor => (p.candidatos || ordemViva()).filter(j => j !== eleitor);

  function telaPasseVoto() {
    const nome = eleitores()[p.eleitorIdx];
    render(`
      <div class="topbar"><span class="pill">${p.segundoTurno ? 'Desempate' : 'Votação'} ${p.eleitorIdx + 1}/${eleitores().length}</span><button class="link-back" id="sair">Sair</button></div>
      <div class="pass">
        <div class="emoji">🗳️</div>
        <p class="muted">Passe o celular para</p>
        <div class="big-name">${esc(nome)}</div>
        <button class="btn" id="ir">Sou ${esc(nome)}, votar</button>
      </div>
    `);
    ligarSair();
    document.getElementById('ir').onclick = () => telaVoto(nome);
  }

  function telaVoto(nome) {
    render(`
      <div class="topbar"><span class="pill">${esc(nome)} votando</span><button class="link-back" id="sair">Sair</button></div>
      <h2 class="center" style="margin:10px 0 16px">Quem é o impostor?</h2>
      ${p.candidatos ? '<p class="muted small center">Desempate entre os mais votados.</p>' : ''}
      ${opcoesVoto(nome).map(j => `<button class="btn secondary" data-voto="${esc(j)}">${esc(j)}</button>`).join('')}
    `);
    ligarSair();
    app.querySelectorAll('[data-voto]').forEach(b => b.onclick = () => {
      p.votos[nome] = b.dataset.voto;
      p.eleitorIdx++;
      if (p.eleitorIdx < eleitores().length) telaPasseVoto(); else apurar();
    });
  }

  function telaVotoAberto() {
    const ops = p.candidatos || ordemViva();
    render(`
      <div class="topbar"><span class="pill">${p.segundoTurno ? 'Desempate' : 'Votação aberta'}</span><button class="link-back" id="sair">Sair</button></div>
      <h2 class="center" style="margin:10px 0 6px">Quem vocês acusam?</h2>
      <p class="muted small center" style="margin-top:0">Discutam e escolham quem teve a maioria dos votos.</p>
      ${ops.map(j => `<button class="btn secondary" data-acusado="${esc(j)}">${esc(j)}</button>`).join('')}
      <button class="btn ghost" id="empate">Deu empate</button>
    `);
    ligarSair();
    app.querySelectorAll('[data-acusado]').forEach(b => b.onclick = () => revelarAcusado(b.dataset.acusado, null));
    document.getElementById('empate').onclick = () => fimImpostores('Deu empate na votação: ninguém foi pego.');
  }

  function apurar() {
    const cont = {};
    Object.values(p.votos).forEach(v => cont[v] = (cont[v] || 0) + 1);
    const max = Math.max(...Object.values(cont));
    const top = Object.keys(cont).filter(k => cont[k] === max);
    if (top.length > 1) return telaApuracao(cont, null, () => fimImpostores('Deu empate na votação: ninguém foi pego.'));
    telaApuracao(cont, top[0], () => revelarAcusado(top[0], cont));
  }

  function telaApuracao(cont, acusado, seguir) {
    const linhas = Object.entries(cont).sort((a, b) => b[1] - a[1]);
    render(`
      <div class="topbar"><span class="pill">Apuração</span><button class="link-back" id="sair">Sair</button></div>
      <div class="card">
        <span class="label">Votos</span>
        <table class="score">${linhas.map(([n, v]) => `<tr class="${n === acusado ? 'lead' : ''}"><td>${esc(n)}</td><td>${C.plural(v, 'voto')}</td></tr>`).join('')}</table>
        <details style="margin-top:10px"><summary class="muted small">Ver quem votou em quem</summary>
          ${Object.entries(p.votos).map(([e, v]) => `<p class="small" style="margin:4px 0">${esc(e)} → ${esc(v)}</p>`).join('')}
        </details>
      </div>
      ${acusado ? `<p class="center">Mais votado: <strong>${esc(acusado)}</strong></p>` : `<p class="center"><strong>Empate!</strong> Sem maioria, o impostor escapa.</p>`}
      <button class="btn" id="seguir">${acusado ? 'Revelar' : 'Ver resultado'}</button>
    `);
    ligarSair();
    document.getElementById('seguir').onclick = seguir;
  }

  function telaFalasExtra() {
    // no voto aberto, empate leva a mais uma rodada de pistas e nova votação
    render(`
      <div class="topbar"><span class="pill">Desempate</span><button class="link-back" id="sair">Sair</button></div>
      <div class="card center"><div class="emoji" style="font-size:2.4rem">🗣️</div><h2>Mais uma palavra de cada</h2>
        <p class="muted small">Na ordem: ${ordemViva().map(esc).join(' → ')}</p></div>
      <button class="btn" id="ok">Ir para o desempate</button>
    `);
    ligarSair();
    document.getElementById('ok').onclick = () => telaVotoAberto();
  }

  function revelarAcusado(nome) {
    const era = p.impostores.has(nome);
    if (!era) return fimImpostores(`${nome} era inocente!`, nome);
    p.vivos.delete(nome);
    p.pegos.push(nome);
    const restantes = [...p.impostores].filter(i => p.vivos.has(i));
    render(`
      <div class="pass">
        <div class="emoji">🎯</div>
        <div class="big-name" style="font-size:2.1rem">${esc(nome)} era impostor!</div>
        ${restantes.length ? `<p class="muted">Ainda tem ${C.plural(restantes.length, 'impostor', 'impostores')} entre vocês.</p>` : ''}
        <button class="btn" id="seguir">Seguir</button>
      </div>
    `);
    const seguir = () => {
      if (!restantes.length) return fimInocentes();
      if (restantes.length >= p.vivos.size - restantes.length) return fimImpostores('Os impostores agora são maioria.');
      p.rodadaFala = 1; p.rodadasAlvo = 1; p.segundoTurno = false;
      telaFalas();
    };
    document.getElementById('seguir').onclick = seguir;
  }

  // ---------- fim ----------
  function pontuar(vencedores, pts) { cfg.jogadores.forEach(j => { placar[j] = placar[j] || 0; }); vencedores.forEach(j => placar[j] += pts); }
  function tabelaPlacar() {
    const rank = Object.entries(placar).sort((a, b) => b[1] - a[1]);
    return `<table class="score">${rank.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${C.plural(v, 'pt')}</td></tr>`).join('')}</table>`;
  }

  function fimInocentes() {
    const inocentes = p.jogadores.filter(j => !p.impostores.has(j));
    pontuar(inocentes, 1);
    telaFim(true, `Pegaram ${p.impostores.size > 1 ? 'todos os impostores' : 'o impostor'}!`);
  }
  function fimImpostores(motivo) {
    pontuar([...p.impostores], 2);
    telaFim(false, motivo);
  }

  function telaFim(inocentesVenceram, motivo) {
    const q = p.palavra;
    render(`
      <div class="center" style="margin-top:10px">
        <div class="trophy">${inocentesVenceram ? '🎉' : '🕵️'}</div>
        <p class="muted" style="margin:6px 0 0">${esc(motivo)}</p>
        <h1 class="logo" style="font-size:2.2rem">${inocentesVenceram ? 'Inocentes venceram' : (p.impostores.size > 1 ? 'Impostores venceram' : 'Impostor venceu')}</h1>
      </div>
      <div class="card center">
        <div class="muted small">A palavra era</div>
        <div class="secret-word">${esc(q.p)}</div>
        <div class="muted small">${cfg.modo === 'parecida' ? `O impostor recebeu: <strong>${esc(q.s)}</strong>` : `Dica do impostor: <strong>${esc(q.d)}</strong>`}</div>
        <p style="margin:14px 0 0">${p.impostores.size > 1 ? 'Impostores' : 'Impostor'}: <strong>${[...p.impostores].map(esc).join(' e ')}</strong></p>
      </div>
      <div class="card"><span class="label">Placar da noite</span>${tabelaPlacar()}
        <p class="muted small" style="margin:10px 0 0">Inocentes ganham 1 ponto cada quando vencem. Impostor ganha 2.</p></div>
      <button class="btn" id="denovo">Nova partida</button>
      <button class="btn secondary" id="config">Mudar jogadores / tema</button>
      <a class="btn ghost" href="../">Voltar aos jogos</a>
    `);
    document.getElementById('denovo').onclick = iniciar;
    document.getElementById('config').onclick = () => { p = null; telaSetup(); };
  }

  function ligarSair() {
    const s = document.getElementById('sair');
    if (s) s.onclick = () => { if (confirm('Sair desta partida?')) { p = null; telaSetup(); } };
  }

  telaSetup();
})();
