// Salas para jogar com vários celulares (Supabase Realtime: broadcast + presence).
// Modelo: o celular que cria a sala é o "anfitrião" e guarda o estado do jogo.
// Os outros enviam ações ("acao") e recebem o estado público ("estado") e, se for o caso, algo só para eles ("privado").
(function (global) {
  const C = global.Comum;
  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };

  function meuId() {
    let id = ss.get('noite:meuId');
    if (!id) { id = Math.random().toString(36).slice(2, 10); ss.set('noite:meuId', id); }
    return id;
  }

  function cliente() {
    if (global.__MOCK_SUPABASE__) return global.__MOCK_SUPABASE__;
    if (!global.supabase || !global.NOITE_CONFIG) throw new Error('Supabase não carregado');
    if (!global.__clienteSupabase) {
      global.__clienteSupabase = global.supabase.createClient(global.NOITE_CONFIG.supabaseUrl, global.NOITE_CONFIG.supabaseKey, {
        realtime: { params: { eventsPerSecond: 20 } }
      });
    }
    return global.__clienteSupabase;
  }

  const gerarCodigo = () => Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
  const normCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

  // conectar({ jogo, codigo, nome, host, onEstado, onPrivado, onAcao, onPresenca, onStatus, snapshot, onVirarHost, onDeixarHost })
  // Troca de anfitrião: o anfitrião manda de tempos em tempos uma cópia do estado dele (snapshot).
  // Se ele sair da sala, quem entrou primeiro depois dele vira anfitrião com essa cópia e o jogo continua.
  function conectar(o) {
    let id = meuId();
    const chaveId = `noite:id:${o.jogo}:${o.codigo}:${C.norm(o.nome || '')}`;
    try { const salvo = localStorage.getItem(chaveId); if (salvo) { id = salvo; ss.set('noite:meuId', id); } else localStorage.setItem(chaveId, id); } catch (e) {}
    const sb = cliente();
    const ch = sb.channel(`noite-${o.jogo}-${o.codigo}`, { config: { broadcast: { self: false }, presence: { key: id } } });
    const chaveSnap = `noite:snap:${o.jogo}:${o.codigo}`;
    let ultimoEstado = null, ehHost = false, aguardando = !!o.host, hs = 0, meuT = Date.now(), inscrito = false, timerEleicao = null, timerSnap = null, ultimoSnapEnvio = 0;
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(chaveSnap) || 'null'); } catch (e) {}
    const privados = {}; // para: dados (anfitrião guarda para reenviar)
    const track = () => ch.track({ nome: o.nome, host: ehHost, hs, t: meuT }).catch(() => {});
    const membros = () => Object.entries(ch.presenceState()).map(([pid, metas]) => ({ id: pid, ...(metas[0] || {}) }));

    function enviarSnap() {
      if (!ehHost || !o.snapshot) return;
      const agora = Date.now(), falta = 1000 - (agora - ultimoSnapEnvio);
      if (falta > 0) { if (!timerSnap) timerSnap = setTimeout(() => { timerSnap = null; enviarSnap(); }, falta); return; }
      ultimoSnapEnvio = agora;
      try {
        const h = JSON.parse(JSON.stringify(o.snapshot() || null));
        ch.send({ type: 'broadcast', event: 'snap', payload: { h, privados, estado: ultimoEstado, hs } });
      } catch (e) {}
    }
    function virarHost() {
      ehHost = true; aguardando = false; hs = Date.now(); track();
      if (snap && snap.privados) Object.assign(privados, snap.privados);
      if (snap && snap.estado) ultimoEstado = snap.estado;
      try { ss.set(`noite:souHost:${o.jogo}`, o.codigo); } catch (e) {}
      if (o.onVirarHost) o.onVirarHost(snap ? snap.h : null);
      enviarSnap();
    }
    function deixarHost() {
      const era = ehHost; ehHost = false; aguardando = false; hs = 0; track();
      try { if (ss.get(`noite:souHost:${o.jogo}`) === o.codigo) sessionStorage.removeItem(`noite:souHost:${o.jogo}`); } catch (e) {}
      ch.send({ type: 'broadcast', event: 'acao', payload: { de: id, nome: o.nome, tipo: 'oi', dados: {} } });
      barraTroca(null, false);
      if (o.onDeixarHost) o.onDeixarHost(era);
    }
    function avaliar() {
      if (!inscrito) return;
      const ms = membros(), outrosHosts = ms.filter(m => m.id !== id && m.host);
      if (aguardando) return;
      if (ehHost) {
        // dois anfitriões (ex.: o antigo voltou depois de o celular bloquear): fica quem assumiu por último,
        // porque é ele que tem o jogo mais atualizado
        const ganha = outrosHosts.find(m => (m.hs || 0) > hs || ((m.hs || 0) === hs && m.id < id));
        if (ganha) deixarHost();
        return;
      }
      if (outrosHosts.length) { clearTimeout(timerEleicao); timerEleicao = null; return; }
      if (timerEleicao) return;
      // ninguém é anfitrião: espera um pouco (pode ser só uma reconexão) e o primeiro da fila assume
      timerEleicao = setTimeout(() => {
        timerEleicao = null;
        const ms2 = membros();
        if (ms2.some(m => m.host)) return;
        const fila = ms2.filter(m => m.t).sort((a, b) => (a.t - b.t) || (a.id < b.id ? -1 : 1));
        if (fila.length && fila[0].id === id) virarHost();
      }, 20000); // 20 s: celular bloqueado/sem sinal por pouco tempo não troca o anfitrião
    }

    const expulsos = new Set(); let fora = false;
    const api = {
      id, codigo: o.codigo, nome: o.nome,
      get host() { return ehHost; },
      expulsos,
      enviar(tipo, dados) {
        const msg = { de: id, nome: o.nome, tipo, dados: dados || {} };
        if (ehHost) { if (o.onAcao) o.onAcao(msg); return; }
        ch.send({ type: 'broadcast', event: 'acao', payload: msg });
      },
      publicar(estado) {
        if (!ehHost) return;
        ultimoEstado = estado; selo(estado); barraTroca(o.jogo, estado && ['lobby', 'final', 'fim'].includes(estado.fase));
        ch.send({ type: 'broadcast', event: 'estado', payload: estado });
        if (o.onEstado) o.onEstado(estado);
        enviarSnap();
      },
      privado(para, dados) {
        if (!ehHost) return;
        privados[para] = dados;
        if (para === id) { if (o.onPrivado) o.onPrivado(dados); return; }
        ch.send({ type: 'broadcast', event: 'privado', payload: { para, dados } });
      },
      limparPrivados() { Object.keys(privados).forEach(k => delete privados[k]); },
      // anfitrião remove alguém da sala (ele recebe o aviso e sai)
      expulsar(pid) {
        if (!ehHost || pid === id) return;
        expulsos.add(pid);
        ch.send({ type: 'broadcast', event: 'expulso', payload: { id: pid } });
        if (o.onPresenca) o.onPresenca(api.jogadores());
      },
      jogadores() {
        return membros().filter(m => !expulsos.has(m.id)).map(m => ({ id: m.id, nome: m.nome || '?', host: !!m.host, t: m.t || 0 }))
          .sort((a, b) => (b.host - a.host) || (a.t - b.t));
      },
      sair() { fora = true; try { ch.untrack(); sb.removeChannel(ch); } catch (e) {} },
      // anfitrião leva todo mundo da sala para outro jogo, com o mesmo código
      trocarJogo(jogo) {
        if (!ehHost) return;
        const g = JOGOS_SALA.find(x => x.jogo === jogo); if (!g) return;
        const t = { jogo: g.jogo, pagina: g.pagina, t: Date.now() };
        ultimoEstado = { ...(ultimoEstado || {}), __trocar: t };
        ch.send({ type: 'broadcast', event: 'estado', payload: ultimoEstado });
        ch.send({ type: 'broadcast', event: 'trocar', payload: t });
        try { localStorage.removeItem(`noite:host:${g.jogo}:${o.codigo}`); } catch (e) {}
        ss.set(`noite:souHost:${g.jogo}`, o.codigo);
        setTimeout(() => irPara(t), 900);
      }
    };
    const irPara = t => { if (fora && !ehHost) return; fora = true; ss.set('noite:auto', o.codigo); ss.set('noite:autoNome', o.nome); try { ch.untrack(); } catch (e) {} location.href = `${t.pagina}?sala=${o.codigo}`; };

    const selo = e => { if (global.Ranking && e) global.Ranking.badge(!!(e.cfg && e.cfg.treino)); };
    ch.on('broadcast', { event: 'estado' }, ({ payload }) => { if (fora) return; if (payload && payload.__trocar) { if (!ehHost) irPara(payload.__trocar); return; } selo(payload); if (!ehHost && o.onEstado) o.onEstado(payload); });
    ch.on('broadcast', { event: 'trocar' }, ({ payload }) => { if (!ehHost && payload && payload.pagina) irPara(payload); });
    ch.on('broadcast', { event: 'snap' }, ({ payload }) => {
      if (ehHost || !payload) return;
      snap = payload;
      try { localStorage.setItem(chaveSnap, JSON.stringify(payload)); } catch (e) {}
    });
    ch.on('broadcast', { event: 'expulso' }, ({ payload }) => {
      if (!payload) return;
      expulsos.add(payload.id);
      if (payload.id !== id) { if (o.onPresenca) o.onPresenca(api.jogadores()); return; }
      api.sair(); C.pararContagem && C.pararContagem();
      const app = document.getElementById('app');
      if (app) app.innerHTML = `<div class="pass"><div class="emoji">🚪</div><div class="big-name" style="font-size:1.8rem">Você foi removido da sala</div><p class="muted">O anfitrião tirou você da sala ${C.esc(o.codigo)}.</p><a class="btn" href="${location.pathname}">Entrar em outra sala</a><a class="btn ghost" href="index.html">Voltar aos jogos</a></div>`;
      const bar = document.getElementById('barraAusentes'); if (bar) bar.remove();
    });
    ch.on('broadcast', { event: 'privado' }, ({ payload }) => { if (fora) return; if (!ehHost && payload && payload.para === id && o.onPrivado) o.onPrivado(payload.dados); });
    ch.on('broadcast', { event: 'acao' }, ({ payload }) => {
      if (!ehHost) return;
      if (payload && payload.tipo === 'oi') {
        // alguém entrou/recarregou: reenvia estado e o privado dele
        if (ultimoEstado) ch.send({ type: 'broadcast', event: 'estado', payload: ultimoEstado });
        if (privados[payload.de] !== undefined) ch.send({ type: 'broadcast', event: 'privado', payload: { para: payload.de, dados: privados[payload.de] } });
        enviarSnap();
      }
      if (o.onAcao) o.onAcao(payload);
    });
    ch.on('presence', { event: 'sync' }, () => { if (fora) return; avaliar(); if (o.onPresenca) o.onPresenca(api.jogadores()); });

    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        inscrito = true;
        await track();
        if (aguardando) {
          // quer ser anfitrião (criou a sala ou recarregou): confere se já não tem outro anfitrião na sala
          setTimeout(() => {
            if (!aguardando) return;
            const outro = membros().some(m => m.id !== id && m.host);
            aguardando = false;
            if (outro) { deixarHost(); if (o.onStatus) o.onStatus(status); return; }
            ehHost = true; hs = hs || Date.now(); track();
            if (o.onStatus) o.onStatus(status);
            enviarSnap();
          }, 1200);
          return;
        }
        ch.send({ type: 'broadcast', event: 'acao', payload: { de: id, nome: o.nome, tipo: 'oi', dados: {} } });
        avaliar();
      }
      if (o.onStatus) o.onStatus(status);
    });
    // celular bloqueado / app em segundo plano: NÃO sai da sala. Ao voltar, reconecta e pede o estado de novo.
    if (global.document) document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || fora) return;
      setTimeout(() => {
        try { if (ch.state !== 'joined' && ch.state !== 'joining') ch.subscribe(); } catch (e) {}
        track();
        if (!ehHost) ch.send({ type: 'broadcast', event: 'acao', payload: { de: id, nome: o.nome, tipo: 'oi', dados: {} } });
        avaliar();
      }, 800);
    });
    global.__salaAtual = api;
    return api;
  }

  // ---------- trocar de jogo sem sair da sala ----------
  const JOGOS_SALA = [
    { jogo: 'alex', pagina: 'alex-sala.html', nome: 'Alex', ic: '🇹🇷' },
    { jogo: 'mimica', pagina: 'mimica-sala.html', nome: 'Mímica', ic: '🎭' },
    { jogo: 'nolimite', pagina: 'nolimite-sala.html', nome: 'No Limite', ic: '🎯' },
    { jogo: 'top100', pagina: 'top100-sala.html', nome: 'Top 100', ic: '💯' },
    { jogo: 'qtl', pagina: 'qtl-sala.html', nome: 'Quem Tava Lá', ic: '🕵️' },
    { jogo: 'impostor', pagina: 'impostor-sala.html', nome: 'Impostor', ic: '🤫' },
    { jogo: 'montatime', pagina: 'montatime-sala.html', nome: 'Monta o Time', ic: '📋' },
    { jogo: 'carreira', pagina: 'carreira-sala.html', nome: 'De Quem É a Carreira?', ic: '🧭' },
    { jogo: 'ordene', pagina: 'ordene-sala.html', nome: 'Ordene a Carreira', ic: '🔢' }
  ];
  function barraTroca(atual, mostrar) {
    if (!global.document) return;
    let b = document.getElementById('barraTroca');
    if (!mostrar) { if (b) b.remove(); return; }
    if (b) return;
    b = document.createElement('div'); b.id = 'barraTroca'; b.className = 'barra-troca';
    b.innerHTML = '<button class="btn secondary" type="button" id="abrirTroca">🎮 Trocar de jogo (mesma sala)</button>';
    document.body.appendChild(b);
    b.querySelector('#abrirTroca').onclick = () => {
      const fundo = document.createElement('div'); fundo.className = 'troca-fundo';
      fundo.innerHTML = `<div class="troca-box"><div class="label">Levar todo mundo da sala para:</div>
        ${JOGOS_SALA.filter(g => g.jogo !== atual).map(g => `<button type="button" class="btn secondary" data-troca="${g.jogo}">${g.ic} ${C.esc(g.nome)}</button>`).join('')}
        <button type="button" class="btn ghost" id="fecharTroca">Cancelar</button></div>`;
      document.body.appendChild(fundo);
      fundo.querySelector('#fecharTroca').onclick = () => fundo.remove();
      fundo.querySelectorAll('[data-troca]').forEach(x => x.onclick = () => { x.disabled = true; x.textContent = 'Levando todo mundo…'; global.__salaAtual && global.__salaAtual.trocarJogo(x.dataset.troca); });
    };
  }

  // Aviso para o anfitrião quando alguém da partida saiu da sala (o jogo não trava esperando por ele).
  // ativos: ids que o jogo espera; presentes: [{id}]; nome(id); onTirar(ids)
  // modo treino na sala: o anfitrião liga/desliga no lobby
  const htmlTreino = (on, host) => host
    ? `<div class="card"><button type="button" class="chip treino-chip ${on ? 'on' : ''}" id="treinoSala">🧪 Modo treino ${on ? 'LIGADO' : 'desligado'}</button><p class="muted small" style="margin:6px 0 0">No treino a partida não conta no ranking.</p></div>`
    : (on ? '<div class="card center"><strong>🧪 Partida de treino</strong><div class="muted small">Não conta no ranking.</div></div>' : '');
  const ligarTreino = fn => { const b = document.getElementById('treinoSala'); if (b) b.onclick = fn; };

  // ---------- timer de 1 minuto (vários celulares) ----------
  // O anfitrião guarda H.prazo (horário limite) e H.prazoKey (qual jogada). Todos mostram a contagem;
  // quando zera, o anfitrião executa onExpira(key).
  const htmlTimer = (on, host) => host
    ? `<div class="card">${C.htmlTimerBtn(on, 'timerSala')}<p class="muted small" style="margin:6px 0 0">Quem não jogar em 1 minuto perde a vez (conta como passe/erro).</p></div>`
    : (on ? '<p class="muted small center">⏱️ Timer de 1 minuto por jogada ligado.</p>' : '');
  const ligarTimer = fn => { const b = document.getElementById('timerSala'); if (b) b.onclick = fn; };
  function relogio(getH, onExpira, folga) {
    let t = null;
    return {
      novo(key, mult) { const H = getH(); if (!H) return; if (H.cfg && H.cfg.timer === false) { H.prazo = null; return; } H.prazo = Date.now() + C.TEMPO * (mult || 1); H.prazoKey = String(key); },
      limpar() { const H = getH(); if (H) H.prazo = null; },
      armar() {
        clearTimeout(t); const H = getH(); if (!H || !H.prazo) return;
        const k = H.prazoKey;
        t = setTimeout(() => { const H2 = getH(); if (H2 && H2.prazo && H2.prazoKey === k) { H2.prazo = null; onExpira(k); } }, Math.max(0, H.prazo - Date.now()) + (folga || 400));
      },
      parar() { clearTimeout(t); }
    };
  }
  const mostrarPrazo = prazo => { if (prazo) C.contagem(prazo); else C.pararContagem(); };

  const foraDesde = {}, jaTirados = new Set(); let timerBarra = null;
  function barraAusentes(ativos, presentes, nome, onTirar) {
    let bar = document.getElementById('barraAusentes');
    const agora = Date.now();
    // quem o anfitrião removeu sai da partida na hora
    const exp = global.__salaAtual && global.__salaAtual.expulsos;
    const removidos = exp ? (ativos || []).filter(id => exp.has(id) && !jaTirados.has(id)) : [];
    if (removidos.length) { removidos.forEach(id => jaTirados.add(id)); setTimeout(() => onTirar(removidos), 0); return; }
    (ativos || []).forEach(id => { if (presentes.some(p => p.id === id)) delete foraDesde[id]; else if (!foraDesde[id]) foraDesde[id] = agora; });
    // celular bloqueado por pouco tempo não conta como saída: só avisa depois de 30 s fora
    const aus = (ativos || []).filter(id => foraDesde[id] && agora - foraDesde[id] >= 30000);
    clearTimeout(timerBarra);
    if ((ativos || []).some(id => foraDesde[id] && agora - foraDesde[id] < 30000)) timerBarra = setTimeout(() => barraAusentes(ativos, presentes, nome, onTirar), 5000);
    if (!aus.length) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'barraAusentes'; bar.className = 'barra-ausentes'; document.body.appendChild(bar); }
    bar.innerHTML = `<span>🚪 ${aus.map(id => C.esc(nome(id))).join(', ')} saiu da sala.</span><button class="btn small" id="tirarAusentes">Tirar da partida</button>`;
    bar.querySelector('#tirarAusentes').onclick = () => { bar.remove(); onTirar(aus); };
  }

  // ---------- telas comuns ----------
  const linkSala = codigo => location.origin + location.pathname + '?sala=' + codigo;

  function htmlQR(texto) {
    try {
      const qr = global.qrcode(0, 'M'); qr.addData(texto); qr.make();
      return `<div class="qr">${qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true })}</div>`;
    } catch (e) { return ''; }
  }

  function htmlCodigo(codigo) {
    return `<div class="card center">
      <div class="muted small">Código da sala</div>
      <div class="sala-codigo">${C.esc(codigo)}</div>
      ${htmlQR(linkSala(codigo))}
      <div class="muted small" style="word-break:break-all">Os amigos abrem o site, entram no jogo e digitam o código, ou apontam a câmera para o QR.</div>
      <button class="btn secondary small" id="copiarLink" style="margin-top:10px">Copiar link da sala</button>
    </div>`;
  }
  function ligarCodigo(codigo) {
    const b = document.getElementById('copiarLink');
    if (b) b.onclick = async () => {
      try { await navigator.clipboard.writeText(linkSala(codigo)); C.toast('Link copiado!'); }
      catch (e) { C.toast(linkSala(codigo)); }
    };
  }

  // tira da partida (estado do anfitrião) quem foi removido da sala
  function limparExpulsos(H) {
    const exp = global.__salaAtual && global.__salaAtual.expulsos;
    if (!H || !exp || !exp.size || !Array.isArray(H.jogadores)) return;
    if (!H.jogadores.some(j => exp.has(j.id))) return;
    H.jogadores = H.jogadores.filter(j => !exp.has(j.id));
    ['placar', 'times', 'tb', 'palpites', 'resp', 'escolhas', 'acertou'].forEach(k => { if (H[k] && typeof H[k] === 'object') exp.forEach(id => delete H[k][id]); });
  }
  const souAnfitriao = () => !!(global.__salaAtual && global.__salaAtual.host);
  if (global.document) document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-expulsar]'); if (!b || !souAnfitriao()) return;
    if (confirm(`Remover ${b.dataset.nome} da sala?`)) global.__salaAtual.expulsar(b.dataset.expulsar);
  });
  function htmlJogadores(lista, meu) {
    return `<div class="card"><span class="label">Na sala (${lista.length})</span>
      ${lista.map(j => `<div class="player-item"><span class="name">${C.esc(j.nome)}${j.id === meu ? ' <span class="muted small">(você)</span>' : ''}</span>${j.host ? '<span class="tag close">anfitrião</span>' : ''}${souAnfitriao() && j.id !== meu ? `<button type="button" class="icon-btn" data-expulsar="${C.esc(j.id)}" data-nome="${C.esc(j.nome)}" aria-label="Remover da sala" title="Remover da sala">✕</button>` : ''}</div>`).join('')}
    </div>`;
  }

  // Tela de entrada: criar ou entrar. cb(nome, codigo, souHost)
  function telaEntrada(app, titulo, voltarHref, cb) {
    const params = new URLSearchParams(location.search);
    const codigoUrl = normCodigo(params.get('sala'));
    let nome = C.store.get('meuNome', '');
    // veio de "Trocar de jogo": entra direto na mesma sala, com o mesmo nome
    const nomeAuto = ss.get('noite:autoNome') || nome;
    if (codigoUrl && nomeAuto && ss.get('noite:auto') === codigoUrl) { try { sessionStorage.removeItem('noite:auto'); } catch (e) {} return cb(nomeAuto, codigoUrl, false); }
    app.innerHTML = `
      <div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="modo-toggle"><a href="${voltarHref}">📱 Um celular</a><span class="on">📲 Vários celulares</span></div>
      <div class="center" style="margin-bottom:18px">
        <div class="logo">${C.esc(titulo)}</div>
        <p class="muted" style="margin:4px 0 0">📲 Vários celulares: cada um joga no seu.</p>
      </div>
      <div class="card">
        <span class="label">Seu nome</span>
        <input type="text" id="meuNome" maxlength="20" autocomplete="off" placeholder="Como te chamam" value="${C.esc(nome)}">
        <div id="cadBox"></div>
      </div>
      ${codigoUrl ? `
        <div class="card center"><div class="muted small">Entrando na sala</div><div class="sala-codigo">${codigoUrl}</div></div>
        <button class="btn" id="entrarUrl">Entrar</button>
      ` : `
        <div class="card">
          <span class="label">Entrar numa sala</span>
          <div class="row"><input class="grow" type="text" id="codigo" maxlength="4" placeholder="Código (ex.: KXPM)" autocomplete="off" style="text-transform:uppercase;letter-spacing:4px;font-weight:800;text-align:center">
          <button class="btn small" id="entrar">Entrar</button></div>
        </div>
        <div class="center muted small" style="margin:6px 0">ou</div>
        <button class="btn" id="criar">Criar uma sala nova</button>
      `}
    `;
    const R = global.Ranking;
    const chips = () => {
      const box = document.getElementById('cadBox'); if (!box || !R) return;
      box.innerHTML = R.htmlChips([], 'data-eu').replace('Cadastrados:', 'Toque no seu nome:').replace(/\+ /g, '');
      box.querySelectorAll('[data-eu]').forEach(b => b.onclick = () => { document.getElementById('meuNome').value = b.dataset.eu; box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); });
    };
    if (R) { chips(); R.atualizar().then(chips); }
    const pegarNome = () => {
      let n = document.getElementById('meuNome').value.trim();
      if (!n) { C.toast('Coloque seu nome.'); return null; }
      if (R) { n = R.canonico(n); R.cadastrar(n); }
      C.store.set('meuNome', n);
      return n;
    };
    const eu = document.getElementById('entrarUrl');
    if (eu) eu.onclick = () => { const n = pegarNome(); if (n) cb(n, codigoUrl, false); };
    const e = document.getElementById('entrar');
    if (e) e.onclick = () => {
      const n = pegarNome(); if (!n) return;
      const c = normCodigo(document.getElementById('codigo').value);
      if (c.length !== 4) { C.toast('O código tem 4 letras.'); return; }
      cb(n, c, false);
    };
    const cr = document.getElementById('criar');
    if (cr) cr.onclick = () => { const n = pegarNome(); if (n) cb(n, gerarCodigo(), true); };
  }

  // Guarda o estado do anfitrião para sobreviver a um recarregamento da página
  const salvarHost = (jogo, codigo, dados) => { try { localStorage.setItem(`noite:host:${jogo}:${codigo}`, JSON.stringify(dados)); ss.set(`noite:souHost:${jogo}`, codigo); } catch (e) {} };
  const carregarHost = (jogo, codigo) => { try { return JSON.parse(localStorage.getItem(`noite:host:${jogo}:${codigo}`) || 'null'); } catch (e) { return null; } };
  const souHostDe = jogo => ss.get(`noite:souHost:${jogo}`);

  global.Sala = { conectar, limparExpulsos, barraAusentes, htmlTreino, ligarTreino, htmlTimer, ligarTimer, relogio, mostrarPrazo, telaEntrada, htmlCodigo, ligarCodigo, htmlJogadores, gerarCodigo, meuId, salvarHost, carregarHost, souHostDe, linkSala };
})(window);
