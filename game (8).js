// Quem Tava Lá — modo um celular
// Cada jogador, na vez, diz um jogador que estava em campo (titular ou reserva que entrou).
// Modo "Duvido": os outros podem duvidar. Duvidou e o nome estava lá → quem duvidou sai e quem falou ganha folga.
//                Duvidou e o nome NÃO estava → quem falou sai e quem duvidou ganha folga. Ninguém duvidou → passa.
// Modo "Sem duvido": o app confere na hora. Errou, está fora.
(function () {
  const C = window.Comum;
  const { esc, store, toast } = C;
  const app = document.getElementById('app');
  const JOGOS = window.JOGOS_QTL || [];

  const cfg = {
    jogadores: C.carregarJogadores(),
    modo: store.get('qtl:modo', 'duvido'),
    jogo: store.get('qtl:jogo', 'sortear')
  };
  const salvar = () => { store.set('qtl:modo', cfg.modo); store.set('qtl:jogo', cfg.jogo); };
  let vistos = new Set(store.get('qtl:vistos', []));

  let p = null; // partida
  const render = html => { app.innerHTML = html; window.scrollTo(0, 0); };
  const fmtData = d => { const [a, m, dd] = d.split('-'); return `${dd}/${m}/${a}`; };
  const POS = { GOL: 'Goleiro', ZAG: 'Zagueiro', LAT: 'Lateral', VOL: 'Volante', MEI: 'Meia', ATA: 'Atacante' };

  // ---------- configuração ----------
  function telaSetup() {
    const pode = cfg.jogadores.length >= 2;
    const comps = [...new Set(JOGOS.map(j => j.competicao))];
    render(`
      <div class="topbar"><a class="link-back" href="../">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px">
        <div class="logo">Quem Tava Lá</div>
        <p class="muted" style="margin:4px 0 0">Um jogo histórico. Cada um fala alguém que estava em campo.<br>Errou? Tá fora. Último vivo ganha.</p>
      </div>

      ${C.htmlEditorJogadores(cfg.jogadores)}

      <div class="card">
        <span class="label">Modo</span>
        <button class="list-opt ${cfg.modo === 'duvido' ? 'on' : ''}" data-modo="duvido">
          <strong>✋ Com "Duvido"</strong>
          <span class="muted small">Ninguém duvidou, o nome passa (mesmo errado). Duvidou e acertou quem falou: quem duvidou sai e quem falou ganha uma folga. Duvidou e o nome não estava: quem falou sai e quem duvidou ganha a folga.</span>
        </button>
        <button class="list-opt ${cfg.modo === 'direto' ? 'on' : ''}" data-modo="direto">
          <strong>✅ Sem "Duvido"</strong>
          <span class="muted small">O app confere cada nome na hora. Falou alguém que não estava, está eliminado.</span>
        </button>
      </div>

      <div class="card">
        <span class="label">Jogo</span>
        <button class="list-opt ${cfg.jogo === 'sortear' ? 'on' : ''}" data-jogo="sortear"><strong>🎲 Sortear um jogo</strong>
          <span class="muted small">Evita jogos que vocês já jogaram neste celular (${vistos.size} de ${JOGOS.length} jogados)${vistos.size ? ' · <u id="zerar">zerar</u>' : ''}</span></button>
        ${comps.map(c => `
          <div class="muted small" style="margin:12px 0 6px;font-weight:700">${esc(c)}</div>
          ${JOGOS.filter(j => j.competicao === c).map(j => `
            <button class="list-opt ${cfg.jogo === j.id ? 'on' : ''}" data-jogo="${esc(j.id)}">
              <strong>${esc(j.titulo)}</strong>
              <span class="muted small">${esc(j.placar)}${vistos.has(j.id) ? ' · já jogado' : ''}</span>
            </button>`).join('')}
        `).join('')}
      </div>

      <button class="btn" id="comecar" ${pode ? '' : 'disabled'}>Começar</button>
    `);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { cfg.modo = b.dataset.modo; salvar(); telaSetup(); });
    app.querySelectorAll('[data-jogo]').forEach(b => b.onclick = e => {
      if (e.target.id === 'zerar') { vistos = new Set(); store.set('qtl:vistos', []); telaSetup(); return; }
      cfg.jogo = b.dataset.jogo; salvar(); telaSetup();
    });
    document.getElementById('comecar').onclick = () => iniciar();
  }

  function escolherJogo() {
    if (cfg.jogo !== 'sortear') return JOGOS.find(j => j.id === cfg.jogo) || JOGOS[0];
    let pool = JOGOS.filter(j => !vistos.has(j.id));
    if (!pool.length) { pool = JOGOS; toast('Vocês já jogaram todos. Repetindo.'); }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function iniciar(offset, jogoFixo) {
    const jogo = jogoFixo || escolherJogo();
    vistos.add(jogo.id); store.set('qtl:vistos', [...vistos]);
    const atletas = [];
    jogo.times.forEach(t => t.jogadores.forEach(a => atletas.push({ ...a, time: t.nome })));
    const n = cfg.jogadores.length;
    const ini = (offset || 0) % n;
    p = {
      jogo,
      atletas,
      match: C.criarMatcher(atletas),
      incompleto: jogo.times.some(t => t.reservas_completas === false),
      ordem: cfg.jogadores.slice(ini).concat(cfg.jogadores.slice(0, ini)),
      vivos: new Set(cfg.jogadores),
      folgas: Object.fromEntries(cfg.jogadores.map(j => [j, 0])),
      vez: 0,
      ditos: [], // {jogador, texto, atleta|null, status: 'passou'|'certo'|'duvidado-certo'|'duvidado-errado'|'errou'|'juiz'}
      log: [],
      offset: ini
    };
    telaApresentacao();
  }

  function cartaoJogo() {
    const j = p.jogo;
    return `<div class="card">
      <span class="pill theme">${esc(j.competicao)}</span>
      <div class="question" style="font-size:1.35rem">${esc(j.titulo)}</div>
      <div style="font-size:1.1rem;font-weight:800;margin:6px 0">${esc(j.placar)}</div>
      <div class="unit">${fmtData(j.data)} · ${esc(j.local)}</div>
    </div>`;
  }

  function telaApresentacao() {
    render(`
      <div class="topbar"><span class="pill">${cfg.modo === 'duvido' ? '✋ Com Duvido' : '✅ Sem Duvido'}</span><button class="link-back" id="sair">Sair</button></div>
      ${cartaoJogo()}
      <p class="muted small center">Vale titular e reserva que entrou em campo. Técnico não conta.<br>Ordem: ${p.ordem.map(esc).join(' → ')}</p>
      ${p.incompleto ? `<div class="fact" style="margin-bottom:10px">⚠️ Neste jogo posso não ter todos os reservas que entraram (${p.jogo.times.filter(t => t.reservas_completas === false).map(t => esc(t.nome)).join(' e ')}). Os titulares estão completos. Se alguém falar um reserva que eu não tenho, o grupo decide se vale.</div>` : ''}
      <button class="btn" id="ir">Começar</button>
      ${cfg.jogo === 'sortear' ? '<button class="btn ghost" id="outro">🎲 Sortear outro jogo</button>' : ''}
    `);
    ligarSair();
    document.getElementById('ir').onclick = proximaVez;
    const o = document.getElementById('outro');
    if (o) o.onclick = () => iniciar(p.offset);
  }

  function ligarSair() {
    const s = document.getElementById('sair');
    if (s) s.onclick = () => { if (confirm('Sair desta partida?')) { p = null; telaSetup(); } };
  }

  function cabecalho() {
    return `<div class="topbar"><span class="pill">${p.vivos.size} na disputa</span><button class="link-back" id="sair">Sair</button></div>`;
  }

  function chipsJogadores() {
    return `<div class="chips" style="justify-content:center;margin:10px 0 4px">${p.ordem.map(j => `
      <span class="chip ${p.vivos.has(j) ? (j === p.ordem[p.vez] ? 'on' : '') : 'out'}">${p.vivos.has(j) ? '' : '❌ '}${esc(j)}${p.folgas[j] ? ' 🛡️' : ''}</span>`).join('')}</div>`;
  }

  function listaDitos() {
    if (!p.ditos.length) return '';
    return `<div class="card"><span class="label">Já falados (${p.ditos.length})</span><div class="said">
      ${p.ditos.slice().reverse().map(d => {
        const revelado = d.status !== 'passou';
        const cls = !revelado ? '' : (d.atleta ? 'ok' : 'miss');
        return `<span class="said-item ${cls}">${esc(d.atleta && revelado ? d.atleta.nome : d.texto)}<span class="by">${esc(d.jogador)}</span></span>`;
      }).join('')}
    </div></div>`;
  }

  // ---------- fluxo de vez ----------
  function avancarPonteiro() {
    do { p.vez = (p.vez + 1) % p.ordem.length; } while (!p.vivos.has(p.ordem[p.vez]));
  }

  function proximaVez(msg) {
    if (verificarFim()) return;
    const atual = p.ordem[p.vez];
    if (!p.vivos.has(atual)) { avancarPonteiro(); return proximaVez(msg); }
    if (p.folgas[atual] > 0) return telaFolga(atual, msg);
    telaVez(atual, msg);
  }

  function verificarFim() {
    if (p.vivos.size <= 1) { telaFinal(); return true; }
    const falados = new Set(p.ditos.filter(d => d.atleta).map(d => d.atleta));
    if (falados.size >= p.atletas.length) { telaFinal('nomes'); return true; }
    return false;
  }

  function faixa(msg) {
    if (!msg) return '';
    return `<div class="result ${msg.tipo}" style="margin-bottom:14px"><span class="who">${msg.html}</span></div>`;
  }

  function telaFolga(nome, msg) {
    render(`
      ${cabecalho()}
      ${faixa(msg)}
      <div class="pass">
        <div class="emoji">🛡️</div>
        <div class="big-name" style="font-size:2rem">${esc(nome)} está de folga</div>
        <p class="muted">Ganhou essa rodada sem precisar falar ninguém.</p>
        ${chipsJogadores()}
        <button class="btn" id="ok">Seguir</button>
      </div>
    `);
    ligarSair();
    document.getElementById('ok').onclick = () => { p.folgas[nome]--; avancarPonteiro(); proximaVez(); };
  }

  function telaVez(nome, msg) {
    render(`
      ${cabecalho()}
      ${faixa(msg)}
      ${cartaoJogo()}
      ${chipsJogadores()}
      <div class="card">
        <p style="margin:0 0 10px"><strong style="font-size:1.4rem">${esc(nome)}</strong>, quem tava lá?</p>
        <form id="f">
          <input type="text" id="nome" autocomplete="off" autocapitalize="words" placeholder="Nome do jogador">
          <button class="btn" type="submit">${cfg.modo === 'duvido' ? 'Falar' : 'Conferir'}</button>
        </form>
      </div>
      ${listaDitos()}
    `);
    ligarSair();
    const inp = document.getElementById('nome');
    inp.focus();
    document.getElementById('f').onsubmit = e => { e.preventDefault(); falar(nome, inp.value.trim()); };
  }

  function jaDito(texto, atleta) {
    return p.ditos.some(d => (atleta && d.atleta === atleta) || C.norm(d.texto) === C.norm(texto));
  }

  function identificar(texto) {
    const r = p.match(texto);
    if (!r) return { atleta: null };
    if (r.ambiguos) return { ambiguos: r.ambiguos };
    return { atleta: r.item };
  }

  function falar(nome, texto) {
    if (!texto) return;
    const id = identificar(texto);
    if (id.ambiguos) {
      const livres = id.ambiguos.filter(a => !p.ditos.some(d => d.atleta === a));
      const mesmoNome = livres.length > 1 && livres.every(a => C.norm(a.nome) === C.norm(livres[0].nome));
      if (livres.length === 1 || mesmoNome) id.atleta = livres[0];
      else { toast('Tem mais de um jogador com esse nome neste jogo. Digite o nome completo.'); return; }
    }
    if (jaDito(texto, id.atleta)) { toast('Esse nome já foi falado. Fale outro.'); return; }

    if (cfg.modo === 'direto') {
      if (id.atleta) return resolverCerto(nome, texto, id.atleta);
      if (p.incompleto) return telaJuiz(nome, texto, null);
      return resolverErrado(nome, texto, null);
    }
    telaDuvido(nome, texto, id.atleta);
  }

  function telaDuvido(nome, texto, atleta) {
    const outros = p.ordem.filter(j => p.vivos.has(j) && j !== nome);
    render(`
      ${cabecalho()}
      <div class="pass" style="padding-top:20px">
        <p class="muted">${esc(nome)} disse</p>
        <div class="big-name" style="font-size:2.2rem">${esc(texto)}</div>
        <p class="muted">Alguém duvida?</p>
        <button class="btn secondary" id="passa">👍 Ninguém duvida, passa</button>
        <div class="label" style="margin-top:22px">Quem duvidou?</div>
        ${outros.map(o => `<button class="btn duvido" data-quem="${esc(o)}">✋ ${esc(o)} duvida!</button>`).join('')}
      </div>
    `);
    ligarSair();
    document.getElementById('passa').onclick = () => {
      p.ditos.push({ jogador: nome, texto, atleta, status: 'passou' });
      avancarPonteiro();
      proximaVez({ tipo: 'under', html: `${esc(nome)}: <strong>${esc(texto)}</strong> passou sem dúvida.` });
    };
    app.querySelectorAll('[data-quem]').forEach(b => b.onclick = () => {
      const quem = b.dataset.quem;
      if (atleta) return resolverDuvida(nome, texto, atleta, quem, true);
      if (p.incompleto) return telaJuiz(nome, texto, quem);
      resolverDuvida(nome, texto, null, quem, false);
    });
  }

  // Quando o nome não está no banco mas a lista de reservas pode estar incompleta, o grupo decide.
  function telaJuiz(nome, texto, duvidou) {
    const incompletos = p.jogo.times.filter(t => t.reservas_completas === false).map(t => t.nome);
    render(`
      ${cabecalho()}
      <div class="pass" style="padding-top:20px">
        <div class="emoji">🤔</div>
        <div class="big-name" style="font-size:1.8rem">${esc(texto)}</div>
        <p>Esse nome <strong>não está</strong> entre os titulares nem entre os reservas que tenho deste jogo.</p>
        <p class="muted small">Mas a lista de reservas de ${incompletos.map(esc).join(' e ')} pode estar incompleta. Se ele entrou no decorrer do jogo, o grupo pode validar.</p>
        <button class="btn secondary" id="entrou">Ele entrou em campo, vale</button>
        <button class="btn" id="nao">Não estava</button>
      </div>
    `);
    ligarSair();
    document.getElementById('entrou').onclick = () => {
      const extra = { nome: texto, pos: '', titular: false, time: '(validado pelo grupo)' };
      p.atletas.push(extra);
      if (duvidou) resolverDuvida(nome, texto, extra, duvidou, true);
      else resolverCerto(nome, texto, extra);
    };
    document.getElementById('nao').onclick = () => {
      if (duvidou) resolverDuvida(nome, texto, null, duvidou, false);
      else resolverErrado(nome, texto, null);
    };
  }

  const descAtleta = a => `${esc(a.nome)} <span class="small muted">(${esc(a.time)}${a.pos ? ', ' + (POS[a.pos] || a.pos) : ''}${a.titular ? '' : a.pos ? ', entrou no jogo' : ''})</span>`;

  function resolverCerto(nome, texto, atleta) {
    p.ditos.push({ jogador: nome, texto, atleta, status: 'certo' });
    avancarPonteiro();
    proximaVez({ tipo: 'exact', html: `✅ ${esc(nome)} acertou: ${descAtleta(atleta)}` });
  }

  function resolverErrado(nome, texto) {
    p.ditos.push({ jogador: nome, texto, atleta: null, status: 'errou' });
    p.vivos.delete(nome);
    p.log.push(`${nome} saiu ao falar “${texto}”, que não estava no jogo.`);
    avancarPonteiro();
    telaRevelacao({ ok: false, titulo: `${texto} não estava`, sub: `${nome} está eliminado.` });
  }

  function resolverDuvida(nome, texto, atleta, quem, estava) {
    if (estava) {
      p.ditos.push({ jogador: nome, texto, atleta, status: 'duvidado-certo' });
      p.vivos.delete(quem);
      p.folgas[nome]++;
      p.log.push(`${quem} duvidou de ${atleta.nome} (falado por ${nome}) e saiu.`);
      avancarPonteiro();
      telaRevelacao({ ok: true, titulo: `${atleta.nome} estava lá!`, sub: `${quem} duvidou errado e está eliminado. ${nome} ganha uma folga 🛡️.`, atleta });
    } else {
      p.ditos.push({ jogador: nome, texto, atleta: null, status: 'duvidado-errado' });
      p.vivos.delete(nome);
      p.folgas[quem]++;
      p.log.push(`${nome} falou “${texto}”, ${quem} duvidou e ${nome} saiu.`);
      avancarPonteiro();
      telaRevelacao({ ok: false, titulo: `${texto} não estava!`, sub: `${nome} está eliminado. ${quem} duvidou certo e ganha uma folga 🛡️.` });
    }
  }

  function telaRevelacao(r) {
    render(`
      ${cabecalho()}
      <div class="pass">
        <div class="emoji">${r.ok ? '✅' : '❌'}</div>
        <div class="big-name" style="font-size:2rem">${esc(r.titulo)}</div>
        ${r.atleta ? `<p>${descAtleta(r.atleta)}</p>` : ''}
        <p class="muted">${esc(r.sub)}</p>
        ${chipsJogadores()}
        <button class="btn" id="ok">Seguir</button>
      </div>
    `);
    ligarSair();
    document.getElementById('ok').onclick = () => proximaVez();
  }

  // ---------- fim ----------
  function telaFinal(motivo) {
    const vivos = p.ordem.filter(j => p.vivos.has(j));
    const falados = new Set(p.ditos.filter(d => d.atleta && d.status !== 'passou').map(d => d.atleta.nome));
    const passados = new Set(p.ditos.filter(d => d.status === 'passou').map(d => d.atleta ? d.atleta.nome : null).filter(Boolean));
    const blefes = p.ditos.filter(d => d.status === 'passou' && !d.atleta);

    render(`
      <div class="center" style="margin-top:10px">
        <div class="trophy">🏆</div>
        <p class="muted" style="margin:6px 0 0">${motivo === 'nomes' ? 'Acabaram os nomes! ' : ''}${vivos.length > 1 ? 'Sobreviventes' : 'Último em pé'}</p>
        <h1 class="logo" style="font-size:2.4rem">${vivos.map(esc).join(' & ')}</h1>
      </div>
      ${p.log.length ? `<div class="card"><span class="label">Eliminações</span>${p.log.map(l => `<p class="small" style="margin:6px 0">${esc(l)}</p>`).join('')}</div>` : ''}
      ${blefes.length ? `<div class="card"><span class="label">Passaram sem ninguém duvidar, mas não estavam 🤫</span>
        ${blefes.map(b => `<p class="small" style="margin:6px 0"><strong>${esc(b.jogador)}</strong>: ${esc(b.texto)}</p>`).join('')}</div>` : ''}
      ${cartaoJogo()}
      ${p.jogo.times.map(t => `
        <div class="card">
          <span class="label">${esc(t.nome)}${t.tecnico ? ` · técnico ${esc(t.tecnico)}` : ''}</span>
          ${t.jogadores.map(a => `
            <div class="lineup-row ${falados.has(a.nome) || passados.has(a.nome) ? 'hit' : ''}">
              <span class="pos">${esc(a.pos)}</span><span class="grow">${esc(a.nome)}</span>${a.titular ? '' : '<span class="tag under">entrou</span>'}
            </div>`).join('')}
          ${t.reservas_completas === false ? '<p class="muted small" style="margin:8px 0 0">Pode faltar algum reserva que entrou.</p>' : ''}
        </div>`).join('')}
      ${p.jogo.curiosidade ? `<div class="fact">💡 ${esc(p.jogo.curiosidade)}</div>` : ''}
      <button class="btn" id="denovo">Jogar de novo (outro jogo)</button>
      <button class="btn secondary" id="config">Mudar jogadores / modo</button>
      <a class="btn ghost" href="../">Voltar aos jogos</a>
    `);
    document.getElementById('denovo').onclick = () => { if (cfg.jogo !== 'sortear') { cfg.jogo = 'sortear'; salvar(); } iniciar(p.offset + 1); };
    document.getElementById('config').onclick = () => { p = null; telaSetup(); };
  }

  telaSetup();
})();
