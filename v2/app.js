// Impostor v2: salas online (Supabase Realtime, via sala.js). O anfitrião guarda o estado da partida e distribui;
// os outros mandam ações (vi a carta, palavra, reação, voto) e recebem o estado público e a própria carta.
(function () {
  const C = window.Comum, { esc, toast } = C;
  const app = document.getElementById('app');
  const BANCO = window.PALAVRAS_IMPOSTOR_V2 || [];
  const JOGO = 'impostor-v2';
  const CATS = g => [...new Set(BANCO.filter(q => q.g === g).map(q => q.c))];
  const ls = { get(k, d) { try { const v = localStorage.getItem('imp2:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('imp2:' + k, JSON.stringify(v)); } catch (e) {} } };
  const T = { ids: [], set(f, ms) { const i = setTimeout(f, ms); this.ids.push(i); return i; }, int(f, ms) { const i = setInterval(f, ms); this.ids.push(i); return i; }, limpar() { this.ids.forEach(i => { clearTimeout(i); clearInterval(i); }); this.ids = []; } };
  const CFG_PADRAO = () => ({ grupo: 'Futebol', cats: CATS('Futebol'), impostores: 1, rodadas: 2, reacaoSeg: 10, vezSeg: 60, teto: 3, treino: false });

  // ---------- tema (por celular) ----------
  let tema = ls.get('tema', 'dark');
  function aplicarTema() { document.documentElement.setAttribute('data-theme', tema); ls.set('tema', tema); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = tema === 'dark' ? '#000000' : '#f5f5f7'; }
  aplicarTema();
  const btnTema = () => `<button class="link" data-tema>${tema === 'dark' ? 'Claro' : 'Escuro'}</button>`;

  // ---------- estado local ----------
  let sala = null, souHost = false, estado = null, presentes = [], carta = null, cartaAberta = false;
  let meuVoto = null, escolha = null, minhaReacao = null, telaLocal = null, menuAberto = null, animKey = null, confeteKey = null, ultimaFase = null;
  let H = null, tPrazo = null;

  // ---------- util ----------
  const nomeDe = id => { const j = ((estado && estado.jogadores) || []).find(j => j.id === id) || presentes.find(p => p.id === id) || ((H && H.jogadores) || []).find(j => j.id === id); return j ? j.nome : '?'; };
  const ini = n => String(n).trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  const av = (id, cls) => `<span class="av ${cls || ''} ${sala && id === sala.id ? 'eu' : ''}" aria-hidden="true">${esc(ini(nomeDe(id)))}</span>`;
  const voce = id => sala && id === sala.id ? 'Você' : nomeDe(id);
  const participo = () => !!(estado && estado.jogadores.some(j => j.id === sala.id));
  const vivo = id => !!(estado && estado.vivos.includes(id || sala.id));
  const topbar = (esq, t, dir) => `<div class="topbar"><span class="l">${esq || ''}</span><span class="t">${t || ''}</span><span class="r">${dir || ''}</span></div>`;
  const lvl = n => `<span class="lvl">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const tagRodada = () => `<span class="tag">Rodada ${estado.rodada}${estado.votacaoN === 0 ? ' de ' + estado.rodadasAlvo : ''}</span>`;
  const btnCarta = () => participo() ? `<button class="link" id="verCarta">Minha carta</button>` : '';
  const resumoRegras = r => `${r.grupo} · ${r.rodadas} rodada${r.rodadas > 1 ? 's' : ''} de palavras · reação ${r.reacaoSeg} s · vez ${r.vezSeg ? r.vezSeg + ' s' : 'sem tempo'} · impostor vence com ${r.teto} votações`;
  const normCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const render = html => { T.limpar(); app.innerHTML = html; ligarComuns(); };
  function ligarComuns() {
    app.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => { tema = tema === 'dark' ? 'light' : 'dark'; aplicarTema(); redesenhar(); });
    const vc = document.getElementById('verCarta'); if (vc) vc.onclick = abrirCartaSheet;
  }
  const redesenhar = () => { if (!sala) telaEntrada(); else { animKey = null; desenhar(); } };

  function ring(size) { size = size || 76; const r = size / 2 - 4, c = (2 * Math.PI * r).toFixed(1); return `<div class="ring" id="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle class="trk" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="prg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="0"/></svg><span class="num" id="ringTxt"></span></div>`; }
  function contarRing() {
    const ring = document.getElementById('ring'); if (!ring || !estado.prazo) return;
    const prg = ring.querySelector('.prg'), txt = document.getElementById('ringTxt'), c = +prg.getAttribute('stroke-dasharray'), dur = estado.prazoDur || 1;
    const tick = () => { const rest = Math.max(0, estado.prazo - Date.now()); prg.style.strokeDashoffset = (c * (1 - Math.min(1, rest / dur))).toFixed(1); txt.textContent = Math.ceil(rest / 1000); ring.classList.toggle('pouco', rest <= 3000); };
    tick(); T.int(tick, 100);
  }
  function contarBarra(idTxt, idBar) {
    const txt = document.getElementById(idTxt), bar = document.getElementById(idBar); if (!estado.prazo) return;
    const dur = estado.prazoDur || 1;
    const tick = () => { const rest = Math.max(0, estado.prazo - Date.now()); if (txt) txt.textContent = Math.ceil(rest / 1000); if (bar) bar.style.width = (Math.min(1, rest / dur) * 100) + '%'; };
    tick(); T.int(tick, 250);
  }
  function htmlQR(texto) { try { const qr = window.qrcode(0, 'M'); qr.addData(texto); qr.make(); return `<div class="qr">${qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true })}</div>`; } catch (e) { return ''; } }
  function confete() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'); c.className = 'confete'; document.body.appendChild(c);
    const ctx = c.getContext('2d'); const W = c.width = innerWidth, H2 = c.height = innerHeight;
    const cs = getComputedStyle(document.documentElement); const cores = [cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--ink').trim(), cs.getPropertyValue('--muted2').trim()];
    const ps = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H2 * .5, v: 2 + Math.random() * 3, r: Math.random() * Math.PI, s: 4 + Math.random() * 5, c: cores[Math.floor(Math.random() * 3)], w: Math.random() * 2 - 1 }));
    const t0 = Date.now();
    const tick = () => { ctx.clearRect(0, 0, W, H2); ps.forEach(p => { p.y += p.v; p.x += Math.sin((p.y + p.r * 50) / 30) * .8; p.r += .05 * p.w; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }); if (Date.now() - t0 < 3200) requestAnimationFrame(tick); else c.remove(); };
    tick();
  }

  // ======================================================================
  // ENTRADA
  // ======================================================================
  function telaEntrada() {
    const params = new URLSearchParams(location.search), codigoUrl = normCodigo(params.get('sala'));
    const nome = ls.get('meuNome', '');
    render(`
      <div class="tela">
        ${topbar('<a class="link" href="../index.html">‹ Jogos</a>', '', btnTema())}
        <div class="stack" style="gap:6px"><span class="eyebrow">Res Assiny</span><h1 class="hero">Impostor</h1><p class="lead">Todos sabem a palavra, menos um. Cada um joga no seu celular.</p></div>
        <div class="card">
          <span class="lbl">Seu nome</span>
          <input class="field" id="meuNome" maxlength="20" autocomplete="off" placeholder="Como te chamam" value="${esc(nome)}">
          <div class="chips" id="cadBox"></div>
        </div>
        ${codigoUrl ? `
          <div class="card" style="align-items:center;text-align:center;gap:6px"><span class="eyebrow">Entrando na sala</span><div class="codigo num">${codigoUrl}</div></div>
          <button class="btn" id="entrarUrl">Entrar na sala</button>
          <a class="btn ghost" href="${location.pathname}">Criar outra sala</a>
        ` : `
          <button class="btn" id="criar">Criar sala</button>
          <div class="card">
            <span class="lbl">Entrar numa sala</span>
            <div class="row"><input class="field code grow" id="codigo" maxlength="4" placeholder="CÓDIGO" autocomplete="off" autocapitalize="characters"><button class="btn" id="entrar" style="width:auto;padding-inline:20px">Entrar</button></div>
            <p class="fine">Peça o código de 4 letras pro anfitrião ou aponte a câmera pro QR dele.</p>
          </div>
        `}
        <div class="card flat"><button class="linha link" id="verRanking" style="width:100%;color:var(--ink)"><span class="grow" style="text-align:left;font-weight:600">Ranking</span><span class="cap">% de vitórias e pontos</span><span class="accent">›</span></button></div>
      </div>`);
    const chips = () => { const box = document.getElementById('cadBox'); if (!box) return; const l = Ranking.cadastrados(); box.innerHTML = l.map(n => `<button type="button" class="chip" data-eu="${esc(n)}">${esc(n)}</button>`).join(''); box.querySelectorAll('[data-eu]').forEach(b => b.onclick = () => { document.getElementById('meuNome').value = b.dataset.eu; box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); }); };
    chips(); Ranking.atualizar().then(chips);
    const pegarNome = () => { let n = document.getElementById('meuNome').value.trim(); if (!n) { toast('Coloque seu nome.'); document.getElementById('meuNome').focus(); return null; } n = Ranking.canonico(n); ls.set('meuNome', n); return n; };
    const eu = document.getElementById('entrarUrl'); if (eu) eu.onclick = () => { const n = pegarNome(); if (n) entrarNaSala(n, codigoUrl, false); };
    const e = document.getElementById('entrar'); if (e) e.onclick = () => { const n = pegarNome(); if (!n) return; const c = normCodigo(document.getElementById('codigo').value); if (c.length !== 4) { toast('O código tem 4 letras.'); return; } entrarNaSala(n, c, false); };
    const cr = document.getElementById('criar'); if (cr) cr.onclick = () => { const n = pegarNome(); if (n) entrarNaSala(n, Sala.gerarCodigo(), true); };
    const cod = document.getElementById('codigo'); if (cod) cod.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); e.click(); } };
    const nm = document.getElementById('meuNome'); nm.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); (eu || cr).click(); } };
    document.getElementById('verRanking').onclick = () => { telaLocal = 'ranking'; telaRanking(); };
  }

  function entrarNaSala(nome, codigo, criar) {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    const iniciarH = () => { H = Sala.carregarHost(JOGO, codigo) || { cfg: CFG_PADRAO(), fase: 'lobby', jogadores: [], placar: {}, usadas: [], partida: 0 }; if (!H.cfg) H.cfg = CFG_PADRAO(); if (!H.cfg.cats || !H.cfg.cats.length) H.cfg.cats = CATS(H.cfg.grupo); };
    if (souHost) iniciarH();
    render(`<div class="tela centro"><span class="eyebrow">Sala ${esc(codigo)}</span><p class="lead">Conectando…</p></div>`);
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => {
        if (!estado || e.partida !== estado.partida) { cartaAberta = false; meuVoto = null; escolha = null; minhaReacao = null; animKey = null; if (estado) carta = null; }
        if (estado && e.votacaoN !== estado.votacaoN) { meuVoto = null; escolha = null; }
        if (estado && e.palavraAtual !== estado.palavraAtual) minhaReacao = null;
        if (e.fase === 'lobby') { carta = null; cartaAberta = false; }
        estado = e; desenhar();
      },
      onPrivado: d => { carta = d; desenhar(); },
      onAcao: acaoHost, snapshot: () => H,
      onVirarHost: h => { if (h) Sala.salvarHost(JOGO, codigo, h); souHost = true; iniciarH(); toast('Agora você é o anfitrião da sala.'); publicar(); reenviarCartas(); },
      onDeixarHost: () => { souHost = false; clearTimeout(tPrazo); const b = document.getElementById('barraAusentes'); if (b) b.remove(); if (telaLocal === 'regras') telaLocal = null; desenhar(); },
      onPresenca: lista => { presentes = lista; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) { publicar(); reenviarCartas(); } else if (!estado) desenhar(); } if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') toast('Problema de conexão. Tentando de novo…'); }
    });
  }

  // ======================================================================
  // ANFITRIÃO: regras do jogo
  // ======================================================================
  function publico() {
    return {
      fase: H.fase, partida: H.partida, cfg: H.cfg, jogadores: H.jogadores || [], placar: H.placar || {},
      vivos: H.vivos || [], eliminados: H.eliminados || [], ordem: H.ordem || [],
      rodada: H.rodada || 0, rodadasAlvo: H.rodadasAlvo || H.cfg.rodadas, falante: H.falante || null,
      palavras: (H.palavras || []).map(p => ({ rodada: p.rodada, de: p.de, texto: p.texto, r: p.r })),
      palavraAtual: H.palavraAtual == null ? null : H.palavraAtual,
      votacaoN: H.votacaoN || 0, votaram: Object.fromEntries(Object.keys(H.votos || {}).map(k => [k, true])),
      viram: H.viram || {}, apuracao: H.apuracao || null, segue: H.segue || null, fim: H.fase === 'fim' ? H.fim : null,
      sobrevividas: H.sobrevividas || 0, nivelDica: Math.min(3, 1 + (H.sobrevividas || 0)),
      prazo: H.prazo || null, prazoDur: H.prazoDur || 0, prazoKey: H.prazoKey || null
    };
  }
  function prazo(key, ms) { if (!ms) { H.prazo = null; H.prazoKey = null; H.prazoDur = 0; return; } H.prazo = Date.now() + ms; H.prazoKey = key; H.prazoDur = ms; }
  function armar() { clearTimeout(tPrazo); if (!souHost || !H || !H.prazo) return; const k = H.prazoKey; tPrazo = setTimeout(() => { if (souHost && H && H.prazo && H.prazoKey === k) { H.prazo = null; expirar(); } }, Math.max(0, H.prazo - Date.now()) + 250); }
  function expirar() {
    const f = H.fase;
    if (f === 'vez') { toast('Tempo esgotado: ' + nomeDe(H.falante) + ' perdeu a vez.'); proximoFalante(); }
    else if (f === 'reacao') proximoFalante();
    else if (f === 'votacao') apurar();
    else if (f === 'apuracao') irSegue();
    else if (f === 'segue') novaRodadaPalavras();
    else if (f === 'fim') voltarLobby();
  }
  function publicar() {
    if (!souHost || !H || !sala) return;
    Sala.salvarHost(JOGO, sala.codigo, H);
    sala.publicar(publico());
    armar();
    Sala.barraAusentes(['cartas', 'vez', 'reacao', 'votacao'].includes(H.fase) ? H.vivos || [] : [], presentes, nomeDe, tirar);
  }
  function reenviarCartas() { if (H && H.cartas && sala) Object.entries(H.cartas).forEach(([id, c]) => sala.privado(id, c)); }

  function acaoHost(msg) {
    if (!H || !msg) return;
    const de = msg.de, d = msg.dados || {};
    if (msg.tipo === 'vi' && H.fase === 'cartas') { H.viram[de] = true; publicar(); }
    else if (msg.tipo === 'palavra' && H.fase === 'vez' && de === H.falante) { const t = String(d.texto || '').trim().slice(0, 30); if (t) receberPalavra(de, t); }
    else if (msg.tipo === 'reacao' && H.fase === 'reacao') {
      const p = H.palavras[H.palavraAtual], i = +d.i;
      if (!p || p.de === de || !H.vivos.includes(de) || d.idx !== H.palavraAtual || ![0, 1, 2].includes(i)) return;
      p.reacoes[de] = i; p.r = [0, 0, 0]; Object.values(p.reacoes).forEach(k => p.r[k]++); publicar();
    }
    else if (msg.tipo === 'voto' && H.fase === 'votacao' && H.vivos.includes(de) && H.vivos.includes(d.em) && d.em !== de) {
      H.votos[de] = d.em;
      if (H.vivos.every(v => H.votos[v])) apurar(); else publicar();
    }
  }

  function sortearPalavra() {
    const cats = (H.cfg.cats || []).filter(c => CATS(H.cfg.grupo).includes(c));
    const doTema = BANCO.filter(q => q.g === H.cfg.grupo && (!cats.length || cats.includes(q.c)));
    let pool = doTema.filter(q => !(H.usadas || []).includes(q.p));
    if (!pool.length) { H.usadas = []; pool = doTema; }
    const q = pool[Math.floor(Math.random() * pool.length)];
    H.usadas = (H.usadas || []).concat(q.p);
    return q;
  }
  function iniciar() {
    const lista = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (lista.length < 3) { toast('Precisa de pelo menos 3 pessoas na sala.'); return; }
    const ids = lista.map(j => j.id);
    H.jogadores = lista; lista.forEach(j => { if (H.placar[j.id] === undefined) H.placar[j.id] = 0; });
    H.partida = (H.partida || 0) + 1;
    H.palavra = sortearPalavra();
    H.impostores = C.shuffle(ids).slice(0, 1);
    H.vivos = ids.slice(); H.eliminados = [];
    const ini = Math.floor(Math.random() * ids.length); H.ordem = ids.slice(ini).concat(ids.slice(0, ini));
    H.rodada = 0; H.rodadasAlvo = H.cfg.rodadas; H.falante = null; H.palavras = []; H.palavraAtual = null;
    H.votacaoN = 0; H.votos = {}; H.viram = {}; H.apuracao = null; H.segue = null; H.fim = null; H.sobrevividas = 0; H.proximo = null; H.rkId = null;
    const q = H.palavra; H.cartas = {};
    lista.forEach(j => { H.cartas[j.id] = H.impostores.includes(j.id) ? { tipo: 'impostor', dicas: q.d, nivel: 1, c: q.c, partida: H.partida } : { tipo: 'normal', palavra: q.p, partida: H.partida }; });
    sala.limparPrivados();
    H.fase = 'cartas'; prazo(null);
    publicar(); reenviarCartas();
  }
  const primeiroVivo = () => H.ordem.find(id => H.vivos.includes(id));
  const depoisDe = id => { const i = H.ordem.indexOf(id); for (let k = i + 1; k < H.ordem.length; k++) if (H.vivos.includes(H.ordem[k])) return H.ordem[k]; return null; };
  const prazoVez = () => prazo('vez-' + H.partida + '-' + H.rodada + '-' + H.falante, H.cfg.vezSeg ? H.cfg.vezSeg * 1000 : 0);
  function irPalavras() { H.rodada = 1; H.falante = primeiroVivo(); H.fase = 'vez'; prazoVez(); publicar(); }
  function receberPalavra(de, texto) {
    H.palavras.push({ rodada: H.rodada, de, texto, reacoes: {}, r: [0, 0, 0] });
    H.palavraAtual = H.palavras.length - 1;
    H.fase = 'reacao'; prazo('reacao-' + H.partida + '-' + H.palavraAtual, (H.cfg.reacaoSeg || 10) * 1000);
    publicar();
  }
  function proximoFalante() {
    const prox = depoisDe(H.falante);
    if (prox) { H.falante = prox; H.fase = 'vez'; prazoVez(); }
    else if (H.rodada < H.rodadasAlvo) { H.rodada++; H.falante = primeiroVivo(); H.fase = 'vez'; prazoVez(); }
    else { abrirVotacao(); return; }
    publicar();
  }
  function pular() { if (H.fase !== 'vez') return; toast(nomeDe(H.falante) + ' pulou a vez.'); proximoFalante(); }
  function abrirVotacao() {
    H.votacaoN = (H.votacaoN || 0) + 1; H.votos = {}; H.fase = 'votacao';
    prazo('vot-' + H.partida + '-' + H.votacaoN, H.cfg.vezSeg ? Math.max(60, H.cfg.vezSeg) * 1000 : 0);
    publicar();
  }
  const durApuracao = cont => { const ns = Object.values(cont); return 700 + ns.reduce((s, n) => s + 650 + 230 * n, 0) + (ns.length > 1 ? 1500 : 0) + 300; };
  function apurar() {
    if (H.fase !== 'votacao') return;
    const cont = {}; H.vivos.forEach(id => cont[id] = 0); Object.values(H.votos).forEach(v => { if (cont[v] !== undefined) cont[v]++; });
    const max = Math.max(0, ...Object.values(cont)), top = Object.keys(cont).filter(k => cont[k] === max && max > 0);
    const id = top.length === 1 ? top[0] : null;
    const tipo = !id ? 'empate' : H.impostores.includes(id) ? 'impostor' : 'eliminado';
    if (tipo === 'eliminado') { H.vivos = H.vivos.filter(v => v !== id); H.eliminados.push(id); }
    let fim = null;
    if (tipo === 'impostor') fim = ['inocentes', 'Pegaram o impostor'];
    else {
      H.sobrevividas = (H.sobrevividas || 0) + 1;
      const imps = H.impostores.filter(i => H.vivos.includes(i)).length, inoc = H.vivos.length - imps;
      if (imps >= inoc) fim = ['impostor', 'O impostor igualou os inocentes'];
      else if (H.sobrevividas >= H.cfg.teto) fim = ['impostor', 'Sobreviveu a ' + H.cfg.teto + ' votações'];
      else H.impostores.forEach(i => { const c = H.cartas[i]; if (c) { c.nivel = Math.min(3, 1 + H.sobrevividas); sala.privado(i, c); } });
    }
    H.apuracao = { cont, total: Object.keys(H.votos).length, tipo, id, n: H.votacaoN, fimDepois: !!fim };
    H.proximo = fim;
    H.fase = 'apuracao'; prazo('apur-' + H.partida + '-' + H.votacaoN, durApuracao(cont) + 4500);
    publicar();
  }
  function irSegue() {
    if (H.proximo) { const f = H.proximo; H.proximo = null; return fim(f[0], f[1]); }
    H.segue = { eliminado: H.apuracao ? H.apuracao.id : null, empate: !!(H.apuracao && H.apuracao.tipo === 'empate'), n: H.votacaoN };
    H.fase = 'segue'; prazo('segue-' + H.partida + '-' + H.votacaoN, 7000); publicar();
  }
  function novaRodadaPalavras() { H.rodada++; H.rodadasAlvo = H.rodada; H.falante = primeiroVivo(); H.fase = 'vez'; prazoVez(); publicar(); }
  function fim(vencedor, motivo) {
    const q = H.palavra, ino = vencedor === 'inocentes';
    H.jogadores.forEach(j => { if (H.placar[j.id] === undefined) H.placar[j.id] = 0; });
    const ganhou = ino ? H.jogadores.filter(j => !H.impostores.includes(j.id)).map(j => j.id) : H.impostores.slice();
    ganhou.forEach(id => { H.placar[id] += ino ? 1 : 2; });
    H.fim = { vencedor, motivo, palavra: q.p, cat: q.c, dicas: q.d, impostores: H.impostores.slice(), ganhou, nivel: Math.min(3, 1 + (H.sobrevividas || 0)) };
    H.fase = 'fim'; H.segue = null; prazo('fim-' + H.partida, 12000);
    if (!H.cfg.treino && window.Ranking) Ranking.registrar(H, H.jogadores.map(j => j.nome), ganhou.map(nomeDe));
    publicar();
  }
  function voltarLobby() { H.fase = 'lobby'; H.cartas = null; H.fim = null; H.apuracao = null; H.segue = null; H.proximo = null; prazo(null); sala.limparPrivados(); publicar(); }
  // quem saiu da sala sai da partida
  function tirar(xs) {
    H.vivos = H.vivos.filter(v => !xs.includes(v));
    xs.forEach(x => { if (!H.eliminados.includes(x)) H.eliminados.push(x); delete H.votos[x]; Object.keys(H.votos).forEach(k => { if (H.votos[k] === x) delete H.votos[k]; }); });
    if (H.fase === 'fim' || H.fase === 'lobby') return publicar();
    if (!H.impostores.some(i => H.vivos.includes(i))) return fim('inocentes', 'O impostor saiu da sala');
    const imps = H.impostores.filter(i => H.vivos.includes(i)).length, inoc = H.vivos.length - imps;
    if (imps >= inoc) return fim('impostor', 'Sobrou gente de menos: o impostor igualou os inocentes');
    if (H.fase === 'cartas') return publicar();
    if ((H.fase === 'vez' || H.fase === 'reacao') && xs.includes(H.falante)) { H.fase = 'vez'; return proximoFalante(); }
    if (H.fase === 'votacao' && H.vivos.every(v => H.votos[v])) return apurar();
    publicar();
  }

  // ======================================================================
  // TELAS
  // ======================================================================
  function desenhar() {
    if (telaLocal === 'ranking') return telaRanking();
    if (telaLocal === 'regras' && souHost && estado && estado.fase === 'lobby') return telaRegras();
    telaLocal = null;
    if (!estado) return render(`<div class="tela">${topbar('', 'Sala ' + esc(sala.codigo), btnTema())}<div class="tela centro" style="min-height:0;flex:1;gap:8px"><p class="lead">Esperando o anfitrião…</p><p class="fine">Se ninguém aparecer, confira o código da sala.</p><a class="btn ghost" href="${location.pathname}">Sair</a></div></div>`);
    const f = estado.fase;
    if (f === 'apuracao') { const k = estado.partida + '-' + estado.apuracao.n; if (animKey === k && document.getElementById('apLista')) return; animKey = k; }
    const mudou = f !== ultimaFase; ultimaFase = f;
    const antes = document.getElementById('pista'); const valor = antes ? antes.value : null, foco = antes && document.activeElement === antes;
    ({ lobby: telaLobby, cartas: telaCartas, vez: telaVez, reacao: telaReacao, votacao: telaVotacao, apuracao: telaApuracao, segue: telaSegue, fim: telaFim })[f]();
    const depois = document.getElementById('pista'); if (depois && valor) depois.value = valor; if (depois && foco) depois.focus();
    if (mudou) window.scrollTo(0, 0);
  }

  function telaLobby() {
    const cfg = estado.cfg, host = presentes.find(p => p.host);
    const temPlacar = Object.values(estado.placar || {}).some(v => v > 0);
    render(`
      <div class="tela">
        ${topbar(`<button class="link" id="sair">Sair</button>`, `Sala ${esc(sala.codigo)}`, btnTema())}
        <div class="card" style="align-items:center;text-align:center;gap:10px">
          <span class="eyebrow">Código da sala</span>
          <div class="codigo num">${esc(sala.codigo)}</div>
          ${htmlQR(Sala.linkSala(sala.codigo))}
          <p class="fine">Os amigos entram no Impostor v2 com o código ou apontam a câmera.</p>
          <button class="btn sm" id="copiarLink">Copiar link da sala</button>
        </div>
        <div class="card flat">
          <div class="linha" style="padding-top:14px"><span class="lbl grow">Na sala · ${presentes.length}</span>${souHost && presentes.length > 1 ? '<span class="fine">⋯ promove ou remove</span>' : ''}</div>
          ${presentes.map(p => `<div class="stack" style="gap:0"><div class="linha">${av(p.id)}<span class="nome grow">${esc(p.nome)}${p.id === sala.id ? ' <span class="cap">(você)</span>' : ''}</span>${p.host ? '<span class="tag accent">anfitrião</span>' : ''}${souHost && p.id !== sala.id ? `<button class="btn sm" data-menu="${esc(p.id)}" aria-label="Opções de ${esc(p.nome)}">⋯</button>` : ''}</div>${souHost && menuAberto === p.id ? `<div class="menu"><button data-promover="${esc(p.id)}">Promover a anfitrião</button><button class="danger" data-remover="${esc(p.id)}">Remover da sala</button></div>` : ''}</div>`).join('')}
        </div>
        ${temPlacar ? `<div class="card flat"><div class="linha" style="padding-top:14px"><span class="lbl grow">Placar da noite</span><span class="fine">inocente +1 · impostor +2</span></div>${tabelaPlacar()}</div>` : ''}
        <div class="card">
          <div class="row"><span class="lbl grow">Regras da partida</span>${souHost ? '<button class="link" id="regras">Editar</button>' : ''}</div>
          <p class="cap">${resumoRegras(cfg)}</p>
          <div class="chips">${(cfg.cats || []).map(c => `<span class="chip ok">${esc(c)}</span>`).join('')}${cfg.treino ? '<span class="chip">Treino · não conta no ranking</span>' : ''}</div>
        </div>
        ${souHost ? `<button class="btn space" id="comecar" ${presentes.length >= 3 ? '' : 'disabled'}>Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>${presentes.length < 3 ? '<p class="fine center">Mínimo de 3 pessoas.</p>' : ''}`
                 : `<div class="card space" style="align-items:center;text-align:center"><p class="lead">Aguardando ${esc(host ? host.nome : 'o anfitrião')} começar</p><p class="fine">Você entra na partida assim que ele apertar começar.</p></div>`}
      </div>`);
    document.getElementById('sair').onclick = () => { sala.sair(); location.href = location.pathname; };
    document.getElementById('copiarLink').onclick = async () => { try { await navigator.clipboard.writeText(Sala.linkSala(sala.codigo)); toast('Link copiado'); } catch (e) { toast(Sala.linkSala(sala.codigo)); } };
    if (!souHost) return;
    app.querySelectorAll('[data-menu]').forEach(b => b.onclick = () => { menuAberto = menuAberto === b.dataset.menu ? null : b.dataset.menu; desenhar(); });
    app.querySelectorAll('[data-promover]').forEach(b => b.onclick = () => { const id = b.dataset.promover; menuAberto = null; toast(nomeDe(id) + ' agora é o anfitrião.'); sala.transferir(id); });
    app.querySelectorAll('[data-remover]').forEach(b => b.onclick = () => { const id = b.dataset.remover; menuAberto = null; toast(nomeDe(id) + ' removido da sala.'); sala.expulsar(id); });
    document.getElementById('regras').onclick = () => { telaLocal = 'regras'; telaRegras(); };
    document.getElementById('comecar').onclick = iniciar;
  }

  function telaRegras() {
    const r = H.cfg, seg = (k, vals, fmt) => `<div class="seg" data-regra="${k}">${vals.map(v => `<button data-v="${v}" class="${r[k] === v ? 'on' : ''}">${fmt ? fmt(v) : v}</button>`).join('')}</div>`;
    render(`
      <div class="tela">
        ${topbar('<button class="link" id="pronto">‹ Lobby</button>', 'Regras', '<button class="link" id="pronto2">Pronto</button>')}
        <div class="card">
          <span class="lbl">Tema</span>
          ${seg('grupo', ['Futebol', 'Geral'])}
          <span class="lbl" style="margin-top:6px">Categorias</span>
          <div class="chips">${CATS(r.grupo).map(c => `<button class="chip ${r.cats.includes(c) ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        </div>
        <div class="card">
          <span class="lbl">Impostores</span>
          <div class="seg"><button class="on">1</button><button disabled>2 · em breve</button><button disabled>3 · em breve</button></div>
          <span class="lbl" style="margin-top:6px">Rodadas de palavras antes da primeira votação</span>
          ${seg('rodadas', [1, 2, 3])}
        </div>
        <div class="card">
          <span class="lbl">Tempo para reagir a cada palavra</span>
          ${seg('reacaoSeg', [5, 10, 15, 20], v => v + ' s')}
          <span class="lbl" style="margin-top:6px">Tempo da vez</span>
          ${seg('vezSeg', [30, 60, 90, 0], v => v ? v + ' s' : 'Sem tempo')}
          <p class="fine">Sem tempo, o anfitrião pode pular quem travou.</p>
        </div>
        <div class="card">
          <span class="lbl">Impostor vence se sobreviver a</span>
          ${seg('teto', [2, 3, 4, 5], v => v + ' votações')}
          <p class="fine">Cada votação que ele sobrevive libera uma dica melhor. Também vence se os inocentes vivos ficarem em igual número.</p>
        </div>
        <div class="card">
          <span class="lbl">Ranking</span>
          ${seg('treino', [false, true], v => v ? 'Treino, não conta' : 'Conta no ranking')}
        </div>
      </div>`);
    const voltar = () => { telaLocal = null; desenhar(); };
    document.getElementById('pronto').onclick = voltar; document.getElementById('pronto2').onclick = voltar;
    app.querySelectorAll('[data-regra] button').forEach(b => b.onclick = () => {
      const k = b.closest('[data-regra]').dataset.regra, v = b.dataset.v;
      H.cfg[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
      if (k === 'grupo') H.cfg.cats = CATS(v);
      publicar(); telaRegras();
    });
    app.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
      const c = b.dataset.cat, at = H.cfg.cats;
      if (at.includes(c)) { if (at.length === 1) return toast('Deixe pelo menos uma categoria.'); H.cfg.cats = at.filter(x => x !== c); } else H.cfg.cats = [...at, c];
      publicar(); telaRegras();
    });
  }

  // ---------- carta ----------
  function cartaConteudo() {
    if (!carta) return '<p class="cap">Recebendo sua carta…</p>';
    if (carta.tipo === 'impostor') {
      const nivel = Math.min(3, carta.nivel || 1);
      return `<div class="stack" style="gap:6px;align-items:center"><span class="eyebrow danger">Você é o impostor</span><div class="palavra">Blefe.</div><p class="cap">Ninguém sabe. Fale palavras que pareçam combinar.</p></div>
        <div class="card" style="width:100%;text-align:left;margin-top:6px"><div class="row"><span class="lbl grow">${nivel > 1 ? 'Suas dicas' : 'Sua dica'}</span>${lvl(nivel)}</div>
        ${carta.dicas.slice(0, nivel).map((d, i) => `<div class="stack" style="gap:0"><span class="fine">Nível ${i + 1}</span><strong style="font-size:${i === nivel - 1 ? 21 : 17}px">${esc(d)}</strong></div>`).join('')}
        <span class="cap">${esc(carta.c)}</span><p class="fine">Dicas melhores aparecem a cada votação que você sobreviver.</p></div>`;
    }
    return `<div class="stack" style="gap:6px;align-items:center"><span class="eyebrow">A palavra é</span><div class="palavra">${esc(carta.palavra)}</div><p class="cap">Dê pistas sem entregar. Um de vocês não sabe.</p></div>`;
  }
  function cartaCard() {
    return `<div class="tile carta" id="carta" role="button" tabindex="0" aria-label="Toque para ver sua carta">${cartaAberta ? cartaConteudo() : `<div class="capa"><span class="olho">👁</span><strong>Toque para ver</strong><span class="cap">Não deixe ninguém olhar</span></div>`}</div>`;
  }
  function ligarCarta() {
    const c = document.getElementById('carta'); if (!c) return;
    c.onclick = () => { cartaAberta = !cartaAberta; if (cartaAberta && estado.fase === 'cartas') sala.enviar('vi'); desenhar(); };
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } };
  }
  function abrirCartaSheet() {
    let s = document.getElementById('cartaSheet');
    if (!s) { s = document.createElement('div'); s.id = 'cartaSheet'; s.className = 'sheet'; document.body.appendChild(s); }
    s.innerHTML = `<div class="panel"><div class="grab"></div><div class="tile" style="align-items:center;text-align:center">${cartaConteudo()}</div><button class="btn sec" id="fecharCarta">Esconder</button></div>`;
    s.classList.add('on');
    const fechar = () => s.classList.remove('on');
    s.onclick = e => { if (e.target === s) fechar(); };
    document.getElementById('fecharCarta').onclick = fechar;
  }
  const avisoEspectador = () => participo() ? '' : '<div class="card center"><p class="lead">Você está assistindo esta partida.</p><p class="fine">Entra na próxima.</p></div>';

  function telaCartas() {
    const faltam = estado.jogadores.filter(j => !estado.viram[j.id]);
    render(`
      <div class="tela">
        ${topbar(`<span class="tag">Partida ${estado.partida}</span>`, 'Sua carta', `<span class="fine num">${estado.jogadores.length - faltam.length} de ${estado.jogadores.length} viram</span>`)}
        ${participo() ? cartaCard() + '<p class="cap center">Toque de novo para esconder.</p>' : avisoEspectador()}
        <div class="chips" style="justify-content:center">${estado.jogadores.map(j => `<span class="chip ${estado.viram[j.id] ? 'on' : ''}">${estado.viram[j.id] ? '✓' : '…'} ${esc(voce(j.id))}</span>`).join('')}</div>
        ${souHost ? `<button class="btn space ${faltam.length ? 'sec' : ''}" id="irPalavras">${faltam.length ? `Começar as palavras (${faltam.length} ainda não viu)` : 'Todos viram. Começar as palavras'}</button>` : '<p class="cap center space">O anfitrião começa as palavras quando todos virem.</p>'}
      </div>`);
    ligarCarta();
    if (souHost) document.getElementById('irPalavras').onclick = irPalavras;
  }

  // ---------- palavras ----------
  function htmlRodada(destacar) {
    const ps = estado.palavras.filter(p => p.rodada === estado.rodada);
    return `<div class="card flat"><div class="linha" style="padding-top:14px"><span class="lbl grow">Rodada ${estado.rodada}</span></div>${estado.ordem.map(id => {
      if (!vivo(id)) return `<div class="linha">${av(id, 'sm fora')}<span class="nome grow fora">${esc(voce(id))}</span><span class="tag">fora</span></div>`;
      const p = ps.find(x => x.de === id);
      const st = p ? `<strong>${esc(p.texto)}</strong><span class="fine num">${p.r[0]} 👍 ${p.r[1]} 👎</span>` : id === destacar ? '<span class="tag accent">falando</span>' : '<span class="fine">aguardando</span>';
      return `<div class="linha">${av(id, 'sm')}<span class="nome grow">${esc(voce(id))}</span>${st}</div>`;
    }).join('')}</div>`;
  }
  function htmlHistorico() {
    const antigas = estado.palavras.filter(p => p.rodada < estado.rodada);
    if (!antigas.length) return '';
    return `<details class="card" style="gap:8px"><summary class="lbl" style="cursor:pointer">Rodadas anteriores</summary><table class="hist">${antigas.map(p => `<tr><td class="de">R${p.rodada} · ${esc(voce(p.de))}</td><td><strong>${esc(p.texto)}</strong></td><td class="r">${p.r[0]} 👍 ${p.r[1]} 👎</td></tr>`).join('')}</table></details>`;
  }
  function telaVez() {
    const f = estado.falante, minha = f === sala.id;
    render(`
      <div class="tela">
        ${topbar(tagRodada(), 'Palavras', btnCarta())}
        ${avisoEspectador()}
        <div class="tela centro" style="min-height:0;gap:12px;padding-block:14px">
          ${minha ? `<span class="eyebrow accent">Sua vez</span><h1 class="hero">Fale uma palavra</h1><p class="lead">Diga em voz alta e anote aqui. A rodada só segue depois que você enviar.</p>`
                  : `<span class="eyebrow">Agora é a vez de</span>${av(f, 'xl')}<h1 class="hero">${esc(nomeDe(f))}</h1><p class="lead">Fala a palavra em voz alta e anota no celular.</p>`}
          ${estado.prazo ? ring() : '<span class="tag">Sem tempo</span>'}
          ${souHost && !minha ? `<button class="btn sm" id="pular">Pular ${esc(nomeDe(f))}</button>` : ''}
        </div>
        ${minha ? `<form class="card" id="fPalavra" style="gap:10px"><div class="row"><input class="field grow" id="pista" maxlength="30" autocomplete="off" placeholder="Sua palavra" enterkeyhint="send"><button class="btn" type="submit" style="width:auto;padding-inline:22px">Enviar</button></div><p class="fine">Até 30 caracteres. Depois de enviar não dá pra editar.</p></form>` : ''}
        ${htmlRodada(f)}
        ${htmlHistorico()}
      </div>`);
    contarRing();
    if (minha) { const fp = document.getElementById('fPalavra'), i = document.getElementById('pista'); i.focus(); fp.onsubmit = e => { e.preventDefault(); const t = i.value.trim(); if (!t) return toast('Digite a palavra que você falou.'); i.value = ''; sala.enviar('palavra', { texto: t }); }; }
    if (souHost && !minha) document.getElementById('pular').onclick = pular;
  }
  function telaReacao() {
    const p = estado.palavras[estado.palavraAtual]; if (!p) return telaVez();
    const minha = p.de === sala.id, posso = vivo() && !minha;
    const btn = (i, face, rot) => `<button class="emoji ${minhaReacao === i ? 'on' : ''}" data-reacao="${i}" ${posso ? '' : 'disabled'} aria-label="${rot}"><span class="face">${face}</span><span class="n">${p.r[i]}</span></button>`;
    render(`
      <div class="tela">
        ${topbar(tagRodada(), 'Palavra', btnCarta())}
        <div class="tile" style="align-items:center;text-align:center;gap:14px;padding-block:34px">
          <div class="row" style="justify-content:center">${av(p.de, 'sm')}<span class="cap">${esc(voce(p.de))} disse</span></div>
          <div class="palavra">${esc(p.texto)}</div>
          ${ring(64)}
        </div>
        <div class="stack" style="gap:10px;text-align:center">
          <span class="eyebrow">${minha ? 'Os outros estão reagindo' : posso ? 'O que você achou?' : 'Reações'}</span>
          <div class="emojis">${btn(0, '👍', 'Curti')}${btn(1, '👎', 'Suspeito')}${btn(2, '😐', 'Tanto faz')}</div>
          <p class="fine">Só a contagem aparece. Ninguém vê quem reagiu.</p>
        </div>
        ${htmlRodada(null)}
      </div>`);
    contarRing();
    app.querySelectorAll('[data-reacao]').forEach(b => b.onclick = () => { const i = +b.dataset.reacao; if (minhaReacao === i) return; minhaReacao = i; app.querySelectorAll('.emoji').forEach(x => x.classList.toggle('on', +x.dataset.reacao === i)); sala.enviar('reacao', { i, idx: estado.palavraAtual }); });
  }

  // ---------- votação ----------
  const ultimaPalavra = id => { const ps = estado.palavras.filter(p => p.de === id); return ps.length ? ps[ps.length - 1] : null; };
  function telaVotacao() {
    const vs = estado.vivos, ops = vs.filter(id => id !== sala.id), jaVotei = !!(estado.votaram[sala.id] || meuVoto);
    render(`
      <div class="tela">
        ${topbar(`<span class="tag">Votação ${estado.votacaoN}</span>`, 'Quem é o impostor?', btnCarta())}
        <p class="lead">Voto secreto. Ninguém vê nada até todos votarem. Empate: ninguém sai.</p>
        ${!vivo() ? (participo() ? '<div class="card center"><p class="lead">Você está fora desta votação.</p></div>' : avisoEspectador())
          : jaVotei ? `<div class="card" style="align-items:center;text-align:center;gap:6px"><span class="eyebrow">Seu voto</span>${av(meuVoto || escolha || ops[0], 'lg')}<h2>${esc(nomeDe(meuVoto || escolha || ops[0]))}</h2><p class="cap">Registrado. Aguardando os outros.</p></div>`
          : `<div class="stack">${ops.map(id => { const w = ultimaPalavra(id); return `<button class="voto ${escolha === id ? 'on' : ''}" data-voto="${esc(id)}">${av(id)}<span class="stack grow" style="gap:0"><span class="nome">${esc(nomeDe(id))}</span><span class="fine">${w ? esc(w.texto) + ' · ' + w.r[0] + ' 👍 ' + w.r[1] + ' 👎' : 'ainda sem palavra'}</span></span><span class="rad"></span></button>`; }).join('')}</div>`}
        <div class="chips" style="justify-content:center">${vs.map(id => `<span class="chip ${estado.votaram[id] ? 'on' : ''}">${estado.votaram[id] ? '✓' : '…'} ${esc(voce(id))}</span>`).join('')}</div>
        ${estado.prazo ? `<p class="cap center">Tempo para votar: <strong class="num" id="votSeg"></strong> s</p>` : ''}
        ${vivo() && !jaVotei ? `<button class="btn space" id="confirmar" ${escolha ? '' : 'disabled'}>${escolha ? 'Confirmar voto em ' + esc(nomeDe(escolha)) : 'Escolha alguém'}</button>` : ''}
        ${souHost ? `<button class="btn ghost ${vivo() && !jaVotei ? '' : 'space'}" id="encerrar">Encerrar com os votos de agora</button>` : ''}
        ${htmlHistoricoCompleto()}
      </div>`);
    if (estado.prazo) contarBarra('votSeg', null);
    app.querySelectorAll('[data-voto]').forEach(b => b.onclick = () => { escolha = b.dataset.voto; app.querySelectorAll('.voto').forEach(x => x.classList.toggle('on', x.dataset.voto === escolha)); const c = document.getElementById('confirmar'); if (c) { c.disabled = false; c.textContent = 'Confirmar voto em ' + nomeDe(escolha); } });
    const cf = document.getElementById('confirmar'); if (cf) cf.onclick = () => { if (!escolha) return; meuVoto = escolha; sala.enviar('voto', { em: meuVoto }); estado.votaram[sala.id] = true; desenhar(); };
    const en = document.getElementById('encerrar'); if (en) en.onclick = () => { if (!Object.keys(H.votos).length) return toast('Ninguém votou ainda.'); apurar(); };
  }
  function htmlHistoricoCompleto() {
    if (!estado.palavras.length) return '';
    return `<details class="card" style="gap:8px"><summary class="lbl" style="cursor:pointer">Todas as palavras ditas</summary><table class="hist">${estado.palavras.map(p => `<tr><td class="de">R${p.rodada} · ${esc(voce(p.de))}</td><td><strong>${esc(p.texto)}</strong></td><td class="r">${p.r[0]} 👍 ${p.r[1]} 👎</td></tr>`).join('')}</table></details>`;
  }

  // ---------- apuração (revela nome por nome, só a contagem) ----------
  function telaApuracao() {
    const a = estado.apuracao, ids = estado.ordem.filter(id => a.cont[id] !== undefined);
    const j = a.id, pegou = a.tipo === 'impostor';
    const veredito = pegou ? `<span class="eyebrow accent">Pegaram o impostor</span><h1>${esc(nomeDe(j))} era o impostor</h1><p class="lead">Inocentes venceram. Resultado em <span class="num" id="apSeg"></span> s.</p>`
      : a.tipo === 'empate' ? `<span class="eyebrow">Empate</span><h1>Ninguém sai</h1><p class="lead">${a.fimDepois ? 'Resultado' : 'Mais uma rodada de palavras'} em <span class="num" id="apSeg"></span> s.</p>`
      : `<span class="eyebrow danger">Eliminad${j === sala.id ? 'o' : 'o'}</span><h1>${esc(voce(j))} era inocente</h1><p class="lead">${j === sala.id ? 'Você sai do jogo, mas continua vendo.' : 'Sai do jogo.'} ${a.fimDepois ? 'Resultado' : 'O impostor segue'} em <span class="num" id="apSeg"></span> s.</p>`;
    render(`
      <div class="tela">
        ${topbar(`<span class="tag">Votação ${a.n}</span>`, 'Apuração', '')}
        <p class="lead" id="apTxt">Contando ${a.total} votos…</p>
        <div class="stack" id="apLista">${ids.map(id => `<div class="apRow" data-id="${esc(id)}" data-n="${a.cont[id]}">${av(id, 'sm')}<span class="nome grow" style="font-weight:600">${esc(voce(id))}</span><span class="bar"><i class="fill"></i></span><span class="n num">?</span></div>`).join('')}</div>
        <p class="fine center">Só a quantidade de votos aparece. Ninguém vê quem votou em quem.</p>
        <div class="veredito stack space" id="veredito" style="gap:8px;text-align:center">${veredito}<div class="prog"><i id="apBar"></i></div></div>
      </div>`);
    const rows = [...app.querySelectorAll('.apRow')], txt = document.getElementById('apTxt');
    const total = rows.reduce((s, r) => s + (+r.dataset.n), 0) || 1;
    const ordem = rows.slice().sort((x, y) => (+x.dataset.n - +y.dataset.n) || (rows.indexOf(x) - rows.indexOf(y)));
    const max = Math.max(...rows.map(r => +r.dataset.n)), tops = max > 0 ? rows.filter(r => +r.dataset.n === max) : [];
    let t = 700;
    ordem.forEach((r, i) => {
      const n = +r.dataset.n, ultimo = i === ordem.length - 1;
      if (ultimo && ordem.length > 1) { T.set(() => { if (txt) txt.textContent = 'Falta um…'; r.classList.add('tensao'); }, t); t += 1500; }
      T.set(() => {
        r.classList.remove('tensao'); r.classList.add('on'); if (!n) r.classList.add('zero');
        const el = r.querySelector('.n'); el.textContent = '0'; r.querySelector('.fill').style.width = (n / total * 100) + '%';
        for (let k = 1; k <= n; k++) T.set(() => { el.textContent = k; }, 230 * k);
      }, t);
      t += 650 + 230 * n;
    });
    T.set(() => {
      tops.forEach(r => r.classList.add('lead', pegou ? 'bom' : 'x'));
      if (txt) txt.textContent = a.tipo === 'empate' ? 'Empate: ninguém sai desta vez.' : `${nomeDe(j)} foi quem recebeu mais votos.`;
      const v = document.getElementById('veredito'); if (v) v.classList.add('on');
      if (pegou) confete();
      contarBarra('apSeg', 'apBar');
    }, t + 300);
  }

  function telaSegue() {
    const s = estado.segue || {}, elim = s.eliminado, imp = carta && carta.tipo === 'impostor', nivel = estado.nivelDica;
    render(`
      <div class="tela">
        ${topbar(`<span class="tag">Votação ${s.n || estado.votacaoN}</span>`, 'Resultado', btnCarta())}
        <div class="tile" style="align-items:center;text-align:center;gap:12px;padding-block:36px">
          ${elim ? av(elim, 'lg fora') : ''}
          <span class="eyebrow" style="color:var(--danger)">${s.empate ? 'Empate na votação' : esc(voce(elim)) + ' era inocente'}</span>
          <h1 class="hero">Um impostor ainda está entre nós</h1>
          <p class="lead">${s.empate ? 'Ninguém saiu. ' : ''}Mais uma rodada de palavras e nova votação. Sobraram ${estado.vivos.length} de vocês.</p>
        </div>
        ${imp ? `<div class="card"><div class="row"><span class="lbl grow">Nova dica desbloqueada</span>${lvl(nivel)}</div><strong style="font-size:21px">${esc(carta.dicas[nivel - 1])}</strong><p class="fine">Você sobreviveu a ${estado.sobrevividas} de ${estado.cfg.teto} votações. Sobreviva a todas e vence.</p></div>`
              : `<div class="card"><div class="row"><span class="lbl grow">Impostor</span><span class="tag danger">${estado.sobrevividas} de ${estado.cfg.teto} votações sobrevividas</span></div><p class="cap">Ele acabou de ganhar uma dica melhor. Fica mais difícil a cada votação.</p></div>`}
        <div class="card flat">${estado.jogadores.map(j => `<div class="linha">${av(j.id, 'sm ' + (vivo(j.id) ? '' : 'fora'))}<span class="nome grow ${vivo(j.id) ? '' : 'fora'}">${esc(voce(j.id))}</span>${vivo(j.id) ? '' : '<span class="tag">eliminado</span>'}</div>`).join('')}</div>
        <div class="stack space" style="gap:8px;text-align:center"><p class="cap">Rodada ${estado.rodada + 1} começa em <strong class="num" id="segSeg"></strong> s</p><div class="prog"><i id="segBar"></i></div></div>
      </div>`);
    contarBarra('segSeg', 'segBar');
  }

  function tabelaPlacar(destaque) {
    const rank = Object.entries(estado.placar || {}).map(([id, p]) => [id, p]).sort((a, b) => b[1] - a[1]);
    return rank.map(([id, p], i) => `<div class="linha"><span class="fine num" style="width:20px">${i + 1}</span>${av(id, 'sm')}<span class="nome grow">${esc(voce(id))}</span>${destaque && destaque.includes(id) ? `<span class="tag accent">+${estado.fim && estado.fim.vencedor === 'impostor' ? 2 : 1}</span>` : ''}<strong class="num" style="width:40px;text-align:right">${p}</strong></div>`).join('');
  }
  function telaFim() {
    const f = estado.fim, ino = f.vencedor === 'inocentes', imp = f.impostores[0];
    const key = 'fim-' + estado.partida; if (ino && confeteKey !== key) { confeteKey = key; confete(); }
    render(`
      <div class="tela">
        ${topbar(`<span class="tag">Partida ${estado.partida}</span>`, 'Fim', '')}
        <div class="tile" style="align-items:center;text-align:center;gap:12px;padding-block:40px">
          <span class="eyebrow" style="color:${ino ? 'var(--accent)' : 'var(--danger)'}">${esc(f.motivo)}</span>
          <h1 class="hero">${ino ? 'Inocentes venceram' : 'O impostor venceu'}</h1>
          <div class="row" style="justify-content:center;gap:10px;margin-top:6px">${av(imp, 'lg')}<span class="stack" style="gap:0;text-align:left"><span class="cap">O impostor era</span><strong style="font-size:21px">${esc(voce(imp))}</strong></span></div>
        </div>
        <div class="card" style="align-items:center;text-align:center;gap:4px">
          <span class="eyebrow">A palavra era</span>
          <div class="palavra" style="font-size:34px">${esc(f.palavra)}</div>
          <span class="cap">${esc(f.cat)} · dica do impostor: ${f.dicas.slice(0, f.nivel).map(esc).join(' › ')}</span>
        </div>
        <div class="card flat"><div class="linha" style="padding-top:14px"><span class="lbl grow">Placar da noite</span><span class="fine">inocente +1 · impostor +2</span></div>${tabelaPlacar(f.ganhou)}</div>
        ${htmlHistoricoCompleto()}
        <div class="stack space" style="gap:8px;text-align:center"><p class="cap">Voltando ao lobby em <strong class="num" id="fimSeg"></strong> s</p><div class="prog"><i id="fimBar"></i></div>${souHost ? '<button class="btn ghost" id="agora">Voltar agora</button>' : ''}</div>
      </div>`);
    contarBarra('fimSeg', 'fimBar');
    if (souHost) document.getElementById('agora').onclick = voltarLobby;
  }

  // ---------- ranking ----------
  function telaRanking() {
    render(`
      <div class="tela">
        ${topbar('<button class="link" id="voltarRk">‹ Voltar</button>', 'Ranking', btnTema())}
        <div class="card" id="rkBox"><p class="cap">Carregando…</p></div>
      </div>`);
    document.getElementById('voltarRk').onclick = () => { telaLocal = null; redesenhar(); };
    Ranking.partidas().then(ps => {
      const rows = Ranking.calcular(ps), box = document.getElementById('rkBox'); if (!box) return;
      box.innerHTML = rows.length ? `<table class="rk"><thead><tr><th>Jogador</th><th>Jogos</th><th>Vitórias</th><th>Pts</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td><span class="row" style="gap:10px"><span class="pos num">${i + 1}</span><span class="av sm">${esc(ini(r.nome))}</span><span class="nome">${esc(r.nome)}</span></span></td><td>${r.j}</td><td><strong>${Math.round(r.pct * 100)}%</strong> <span class="fine">${r.v}</span></td><td>${r.pts}</td></tr>`).join('')}</tbody></table><p class="fine">Impostor v1 e v2 somados. Partidas de treino não contam.</p>` : '<p class="cap">Nenhuma partida registrada ainda.</p>';
    }).catch(() => { const box = document.getElementById('rkBox'); if (box) box.innerHTML = '<p class="cap">Não deu pra carregar o ranking agora.</p>'; });
  }

  // ---------- início ----------
  const paramsIni = new URLSearchParams(location.search);
  if (paramsIni.get('sala') && ls.get('meuNome', '') && Sala.souHostDe(JOGO) === normCodigo(paramsIni.get('sala'))) entrarNaSala(ls.get('meuNome', ''), normCodigo(paramsIni.get('sala')), false);
  else telaEntrada();
})();
