// No Limite — modo um celular (passa o celular de mão em mão)
(function () {
  const app = document.getElementById('app');
  const PERGUNTAS = window.PERGUNTAS || [];
  const { pontuarRodada } = window.NoLimiteRegras;
  const TEMAS = [...new Set(PERGUNTAS.map(q => q.c))];
  const OPCOES_RODADAS = [5, 10, 15, 20];

  // ---------- armazenamento local (opcional, nunca obrigatório) ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem('nolimite:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('nolimite:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- helpers ----------
  const fmtBase = n => Number(n).toLocaleString('pt-BR');
  // anos aparecem sem ponto (1922, não 1.922)
  const fmt = n => (jogo && jogo.pergunta && jogo.pergunta.u === 'ano') ? String(Number(n)) : fmtBase(n);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }

  // ---------- estado ----------
  const cfg = {
    jogadores: store.get('jogadores', []),
    rodadas: store.get('rodadas', 10),
    temas: store.get('temas', null) || TEMAS.slice()
  };
  cfg.temas = cfg.temas.filter(t => TEMAS.includes(t));
  if (!cfg.temas.length) cfg.temas = TEMAS.slice();

  let jogo = null;
  let vistas = new Set(store.get('vistas', [])); // perguntas já vistas neste aparelho

  function salvarCfg() {
    store.set('jogadores', cfg.jogadores);
    store.set('rodadas', cfg.rodadas);
    store.set('temas', cfg.temas);
  }
  function marcarVista(id) { vistas.add(id); store.set('vistas', [...vistas]); }

  function sortearPergunta() {
    const doTema = PERGUNTAS.filter(q => cfg.temas.includes(q.c));
    let pool = doTema.filter(q => !jogo.usadas.has(q.id) && !vistas.has(q.id));
    if (!pool.length) {
      pool = doTema.filter(q => !jogo.usadas.has(q.id));
      if (pool.length) toast('Vocês já viram todas as perguntas desses temas. Repetindo as antigas.');
    }
    if (!pool.length) return null;
    const q = pool[Math.floor(Math.random() * pool.length)];
    jogo.usadas.add(q.id);
    marcarVista(q.id);
    return q;
  }

  // ---------- telas ----------
  function render(html) { app.innerHTML = html; window.scrollTo(0, 0); }

  function telaSetup() {
    const podeComecar = cfg.jogadores.length >= 2 && cfg.temas.length > 0;
    const totalTemas = PERGUNTAS.filter(q => cfg.temas.includes(q.c)).length;
    render(`
      <div class="topbar"><a class="link-back" href="../">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="sala.html">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px">
        <div class="logo">No Limite</div>
        <p class="muted" style="margin:4px 0 0">Chegue o mais perto possível da resposta.<br>Passou do número? Estourou.</p>
      </div>

      <div class="card">
        <span class="label">Jogadores (ordem da vez)</span>
        <div id="lista">
          ${cfg.jogadores.map((n, i) => `
            <div class="player-item">
              <span class="num">${i + 1}</span>
              <span class="name">${esc(n)}</span>
              <button class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
              <button class="icon-btn" data-down="${i}" ${i === cfg.jogadores.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
              <button class="icon-btn" data-del="${i}" aria-label="Remover">✕</button>
            </div>`).join('') || '<p class="muted small" style="margin-top:0">Adicione pelo menos 2 jogadores.</p>'}
        </div>
        <form id="addForm" class="row" style="margin-top:8px">
          <input class="grow" type="text" id="novoNome" placeholder="Nome do jogador" maxlength="20" autocomplete="off">
          <button class="btn small" type="submit">Adicionar</button>
        </form>
      </div>

      <div class="card">
        <span class="label">Número de rodadas</span>
        <div class="chips">
          ${OPCOES_RODADAS.map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between; margin-bottom:10px">
          <span class="label" style="margin:0">Temas</span>
          <button class="link-back small" id="todosTemas">${cfg.temas.length === TEMAS.length ? 'Limpar' : 'Marcar todos'}</button>
        </div>
        <div class="chips">
          ${TEMAS.map(t => `<button class="chip ${cfg.temas.includes(t) ? 'on' : ''}" data-tema="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <p class="muted small" style="margin:12px 0 0">${totalTemas} perguntas nos temas escolhidos · ${vistas.size} já vistas neste celular
          ${vistas.size ? ' · <button class="link-back small" id="zerar" style="text-decoration:underline">zerar histórico</button>' : ''}</p>
      </div>

      <button class="btn" id="comecar" ${podeComecar ? '' : 'disabled'}>Começar jogo</button>
    `);

    const input = document.getElementById('novoNome');
    document.getElementById('addForm').onsubmit = e => {
      e.preventDefault();
      const nome = input.value.trim();
      if (!nome) return;
      if (cfg.jogadores.some(j => j.toLowerCase() === nome.toLowerCase())) { toast('Esse nome já está na lista.'); return; }
      cfg.jogadores.push(nome); salvarCfg(); telaSetup();
      document.getElementById('novoNome').focus();
    };
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { cfg.jogadores.splice(+b.dataset.del, 1); salvarCfg(); telaSetup(); });
    app.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [cfg.jogadores[i - 1], cfg.jogadores[i]] = [cfg.jogadores[i], cfg.jogadores[i - 1]]; salvarCfg(); telaSetup(); });
    app.querySelectorAll('[data-down]').forEach(b => b.onclick = () => { const i = +b.dataset.down; [cfg.jogadores[i + 1], cfg.jogadores[i]] = [cfg.jogadores[i], cfg.jogadores[i + 1]]; salvarCfg(); telaSetup(); });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { cfg.rodadas = +b.dataset.rod; salvarCfg(); telaSetup(); });
    app.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => {
      const t = b.dataset.tema;
      cfg.temas = cfg.temas.includes(t) ? cfg.temas.filter(x => x !== t) : [...cfg.temas, t];
      salvarCfg(); telaSetup();
    });
    document.getElementById('todosTemas').onclick = () => { cfg.temas = cfg.temas.length === TEMAS.length ? [] : TEMAS.slice(); salvarCfg(); telaSetup(); };
    const z = document.getElementById('zerar');
    if (z) z.onclick = () => { if (confirm('Zerar o histórico de perguntas já vistas neste celular?')) { vistas = new Set(); store.set('vistas', []); telaSetup(); } };
    document.getElementById('comecar').onclick = iniciarJogo;
  }

  function iniciarJogo(inicioOffset) {
    jogo = {
      rodada: 0,
      total: cfg.rodadas,
      placar: Object.fromEntries(cfg.jogadores.map(j => [j, 0])),
      usadas: new Set(),
      historico: [],
      offset: typeof inicioOffset === 'number' ? inicioOffset : 0
    };
    novaRodada();
  }

  function novaRodada() {
    jogo.rodada++;
    const n = cfg.jogadores.length;
    const inicio = (jogo.offset + jogo.rodada - 1) % n; // quem começa gira a cada rodada
    jogo.ordem = cfg.jogadores.slice(inicio).concat(cfg.jogadores.slice(0, inicio));
    jogo.vez = 0;
    jogo.palpites = {};
    jogo.pergunta = sortearPergunta();
    if (!jogo.pergunta) { toast('Sem perguntas disponíveis nesses temas.'); telaSetup(); return; }
    telaPergunta();
  }

  function cabecalho() {
    return `<div class="topbar">
      <span class="pill">Rodada ${jogo.rodada}/${jogo.total}</span>
      <button class="link-back" id="sair">Sair</button>
    </div>`;
  }
  function ligarSair() {
    const s = document.getElementById('sair');
    if (s) s.onclick = () => { if (confirm('Sair do jogo atual? O placar será perdido.')) { jogo = null; telaSetup(); } };
  }
  function blocoPergunta(q) {
    return `<span class="pill theme">${esc(q.c)}</span>
      <div class="question">${esc(q.p)}</div>
      ${q.u ? `<div class="unit">Resposta em: ${esc(q.u)}</div>` : ''}`;
  }

  function telaPergunta() {
    const q = jogo.pergunta;
    render(`
      ${cabecalho()}
      <div class="card">${blocoPergunta(q)}</div>
      <p class="muted small center">Ordem desta rodada: ${jogo.ordem.map(esc).join(' → ')}</p>
      <button class="btn" id="iniciar">Começar palpites</button>
      <button class="btn ghost" id="trocar">🔄 Já conhecemos essa, sortear outra</button>
    `);
    ligarSair();
    document.getElementById('iniciar').onclick = telaPasse;
    document.getElementById('trocar').onclick = () => {
      const nova = sortearPergunta();
      if (!nova) { toast('Não há mais perguntas nesses temas.'); return; }
      jogo.pergunta = nova; telaPergunta();
    };
  }

  function dots() {
    return `<div class="dots">${jogo.ordem.map((_, i) => `<span class="dot ${i < jogo.vez ? 'done' : i === jogo.vez ? 'now' : ''}"></span>`).join('')}</div>`;
  }

  function telaPasse() {
    const nome = jogo.ordem[jogo.vez];
    render(`
      ${cabecalho()}
      <div class="pass">
        <div class="emoji">📱</div>
        <p class="muted">Passe o celular para</p>
        <div class="big-name">${esc(nome)}</div>
        ${dots()}
        <button class="btn" id="sou">Sou ${esc(nome)}, mostrar pergunta</button>
      </div>
    `);
    ligarSair();
    document.getElementById('sou').onclick = telaPalpite;
  }

  function telaPalpite() {
    const nome = jogo.ordem[jogo.vez];
    const q = jogo.pergunta;
    render(`
      ${cabecalho()}
      <p class="center" style="margin:0 0 10px"><strong>${esc(nome)}</strong>, é a sua vez</p>
      <div class="card">${blocoPergunta(q)}</div>
      <form id="fp">
        <input class="guess-input" id="palpite" type="text" inputmode="numeric" autocomplete="off" placeholder="0">
        <button class="btn" id="confirmar" type="submit" disabled>Confirmar palpite</button>
      </form>
      ${dots()}
    `);
    ligarSair();
    const inp = document.getElementById('palpite');
    const btn = document.getElementById('confirmar');
    inp.focus();
    inp.oninput = () => {
      const dig = inp.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
      inp.value = dig ? fmt(dig) : '';
      btn.disabled = !dig;
    };
    document.getElementById('fp').onsubmit = e => {
      e.preventDefault();
      const dig = inp.value.replace(/\D/g, '');
      if (!dig) return;
      jogo.palpites[nome] = Number(dig);
      jogo.vez++;
      if (jogo.vez < jogo.ordem.length) telaPasse(); else telaTodos();
    };
  }

  function telaTodos() {
    render(`
      ${cabecalho()}
      <div class="pass">
        <div class="emoji">🔒</div>
        <div class="big-name" style="font-size:2rem">Todos responderam!</div>
        <p class="muted">Coloque o celular no meio da galera.</p>
        <button class="btn" id="revelar">Revelar resposta</button>
      </div>
    `);
    ligarSair();
    document.getElementById('revelar').onclick = telaRevelar;
  }

  function telaRevelar() {
    const q = jogo.pergunta;
    const res = pontuarRodada(q.r, jogo.ordem.map(j => ({ jogador: j, valor: jogo.palpites[j] })));
    res.forEach(r => jogo.placar[r.jogador] += r.pontos);
    jogo.historico.push({ pergunta: q, resultados: res });

    const ordemStatus = { exact: 0, close: 1, under: 2, bust: 3 };
    const lista = res.slice().sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || a.distancia - b.distancia);
    const tagTxt = { exact: '🎯 CRAVOU', close: '✅ MAIS PERTO', under: 'abaixo', bust: '💥 ESTOUROU' };
    const ninguem = res.every(r => r.pontos === 0);
    const ultima = jogo.rodada >= jogo.total;

    render(`
      ${cabecalho()}
      <div class="card">
        ${blocoPergunta(q)}
        <div class="answer-box">
          <div class="answer-num">${fmt(q.r)}</div>
          ${q.u ? `<div class="unit">${esc(q.u)}</div>` : ''}
          ${q.i ? `<div class="fact">💡 ${esc(q.i)}</div>` : ''}
        </div>
      </div>

      <div class="card">
        <span class="label">Palpites</span>
        ${lista.map((r, idx) => `
          <div class="result ${r.status}" style="animation-delay:${idx * 0.12}s">
            <span class="who">${esc(r.jogador)}<br><span class="tag ${r.status}">${tagTxt[r.status]}</span></span>
            <span class="val">${fmt(r.valor)}</span>
            <span class="pts">${r.pontos ? '+' + r.pontos : '0'}</span>
          </div>`).join('')}
        ${ninguem ? '<p class="muted small center" style="margin:8px 0 0">Todo mundo estourou. Ninguém pontua nesta rodada.</p>' : ''}
      </div>

      <div class="card">
        <span class="label">Placar</span>
        ${tabelaPlacar(res)}
      </div>

      <button class="btn" id="prox">${ultima ? '🏆 Ver campeão' : 'Próxima rodada'}</button>
    `);
    ligarSair();
    document.getElementById('prox').onclick = () => ultima ? telaFinal() : novaRodada();
  }

  function ranking() {
    return Object.entries(jogo.placar).sort((a, b) => b[1] - a[1]);
  }

  function tabelaPlacar(res) {
    const ganhou = res ? Object.fromEntries(res.map(r => [r.jogador, r.pontos])) : {};
    const rank = ranking();
    const topo = rank[0][1];
    return `<table class="score">${rank.map(([n, p]) => `
      <tr class="${p === topo && p > 0 ? 'lead' : ''}">
        <td>${esc(n)}${ganhou[n] ? `<span class="delta">+${ganhou[n]}</span>` : ''}</td>
        <td>${p} pt${p === 1 ? '' : 's'}</td>
      </tr>`).join('')}</table>`;
  }

  function telaFinal() {
    const rank = ranking();
    const topo = rank[0][1];
    const campeoes = rank.filter(r => r[1] === topo).map(r => r[0]);
    const pod = rank.slice(0, 3);
    const cravadas = {};
    jogo.historico.forEach(h => h.resultados.forEach(r => { if (r.status === 'exact') cravadas[r.jogador] = (cravadas[r.jogador] || 0) + 1; }));
    const reiCravada = Object.entries(cravadas).sort((a, b) => b[1] - a[1])[0];

    render(`
      <div class="center" style="margin-top:10px">
        <div class="trophy">🏆</div>
        <p class="muted" style="margin:6px 0 0">${campeoes.length > 1 ? 'Empate! Campeões da vez' : 'Campeão da vez'}</p>
        <h1 class="logo" style="font-size:2.4rem">${campeoes.map(esc).join(' & ')}</h1>
      </div>

      <div class="podium">
        ${[1, 0, 2].filter(i => pod[i]).map(i => `
          <div class="step p${i + 1}">
            <div class="pname">${esc(pod[i][0])}</div>
            <div class="ppts">${pod[i][1]} pt${pod[i][1] === 1 ? '' : 's'}</div>
            <div class="block">${i + 1}º</div>
          </div>`).join('')}
      </div>

      <div class="card">
        <span class="label">Classificação final</span>
        ${tabelaPlacar()}
        ${reiCravada ? `<p class="muted small" style="margin:12px 0 0">🎯 Mais cravadas: <strong>${esc(reiCravada[0])}</strong> (${reiCravada[1]})</p>` : ''}
      </div>

      <button class="btn" id="denovo">Jogar de novo</button>
      <button class="btn secondary" id="config">Mudar jogadores / temas</button>
      <a class="btn ghost" href="../">Voltar aos jogos</a>
    `);
    const offset = (jogo.offset + 1) % cfg.jogadores.length;
    document.getElementById('denovo').onclick = () => iniciarJogo(offset);
    document.getElementById('config').onclick = () => { jogo = null; telaSetup(); };
  }

  telaSetup();
})();
