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

  // conectar({ jogo, codigo, nome, host, onEstado, onPrivado, onAcao, onPresenca, onStatus })
  function conectar(o) {
    const id = meuId();
    const sb = cliente();
    const ch = sb.channel(`noite-${o.jogo}-${o.codigo}`, { config: { broadcast: { self: false }, presence: { key: id } } });
    let ultimoEstado = null;
    const privados = {}; // para: dados (anfitrião guarda para reenviar)

    const api = {
      id, codigo: o.codigo, host: !!o.host, nome: o.nome,
      enviar(tipo, dados) {
        const msg = { de: id, nome: o.nome, tipo, dados: dados || {} };
        if (o.host) { if (o.onAcao) o.onAcao(msg); return; }
        ch.send({ type: 'broadcast', event: 'acao', payload: msg });
      },
      publicar(estado) {
        ultimoEstado = estado;
        ch.send({ type: 'broadcast', event: 'estado', payload: estado });
        if (o.onEstado) o.onEstado(estado);
      },
      privado(para, dados) {
        privados[para] = dados;
        if (para === id) { if (o.onPrivado) o.onPrivado(dados); return; }
        ch.send({ type: 'broadcast', event: 'privado', payload: { para, dados } });
      },
      limparPrivados() { Object.keys(privados).forEach(k => delete privados[k]); },
      jogadores() {
        const st = ch.presenceState();
        return Object.entries(st).map(([pid, metas]) => ({ id: pid, nome: (metas[0] || {}).nome || '?', host: !!(metas[0] || {}).host, t: (metas[0] || {}).t || 0 }))
          .sort((a, b) => (b.host - a.host) || (a.t - b.t));
      },
      sair() { try { ch.untrack(); sb.removeChannel(ch); } catch (e) {} }
    };

    ch.on('broadcast', { event: 'estado' }, ({ payload }) => { if (!o.host && o.onEstado) o.onEstado(payload); });
    ch.on('broadcast', { event: 'privado' }, ({ payload }) => { if (!o.host && payload && payload.para === id && o.onPrivado) o.onPrivado(payload.dados); });
    ch.on('broadcast', { event: 'acao' }, ({ payload }) => {
      if (!o.host) return;
      if (payload && payload.tipo === 'oi') {
        // alguém entrou/recarregou: reenvia estado e o privado dele
        if (ultimoEstado) ch.send({ type: 'broadcast', event: 'estado', payload: ultimoEstado });
        if (privados[payload.de] !== undefined) ch.send({ type: 'broadcast', event: 'privado', payload: { para: payload.de, dados: privados[payload.de] } });
      }
      if (o.onAcao) o.onAcao(payload);
    });
    ch.on('presence', { event: 'sync' }, () => { if (o.onPresenca) o.onPresenca(api.jogadores()); });

    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ nome: o.nome, host: !!o.host, t: Date.now() });
        if (!o.host) ch.send({ type: 'broadcast', event: 'acao', payload: { de: id, nome: o.nome, tipo: 'oi', dados: {} } });
      }
      if (o.onStatus) o.onStatus(status);
    });
    return api;
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

  function htmlJogadores(lista, meu) {
    return `<div class="card"><span class="label">Na sala (${lista.length})</span>
      ${lista.map(j => `<div class="player-item"><span class="name">${C.esc(j.nome)}${j.id === meu ? ' <span class="muted small">(você)</span>' : ''}</span>${j.host ? '<span class="tag close">anfitrião</span>' : ''}</div>`).join('')}
    </div>`;
  }

  // Tela de entrada: criar ou entrar. cb(nome, codigo, souHost)
  function telaEntrada(app, titulo, voltarHref, cb) {
    const params = new URLSearchParams(location.search);
    const codigoUrl = normCodigo(params.get('sala'));
    let nome = C.store.get('meuNome', '');
    app.innerHTML = `
      <div class="topbar"><a class="link-back" href="../">← Jogos</a></div>
      <div class="modo-toggle"><a href="${voltarHref}">📱 Um celular</a><span class="on">📲 Vários celulares</span></div>
      <div class="center" style="margin-bottom:18px">
        <div class="logo">${C.esc(titulo)}</div>
        <p class="muted" style="margin:4px 0 0">📲 Vários celulares: cada um joga no seu.</p>
      </div>
      <div class="card">
        <span class="label">Seu nome</span>
        <input type="text" id="meuNome" maxlength="20" autocomplete="off" placeholder="Como te chamam" value="${C.esc(nome)}">
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
    const pegarNome = () => {
      const n = document.getElementById('meuNome').value.trim();
      if (!n) { C.toast('Coloque seu nome.'); return null; }
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

  global.Sala = { conectar, telaEntrada, htmlCodigo, ligarCodigo, htmlJogadores, gerarCodigo, meuId, salvarHost, carregarHost, souHostDe, linkSala };
})(window);
