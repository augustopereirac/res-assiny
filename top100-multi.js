// Top 100 / Top 10 — vários celulares. O anfitrião controla; cada um chuta no próprio celular na sua vez.
// Estilos: pontos, reverso e duvido (mesmas regras do modo um celular).
(function () {
  const C = window.Comum;
  const { esc, toast } = C;
  const app = document.getElementById('app');
  const LISTAS = window.LISTAS_TOP100 || [];
  const JOGO = 'top100';
  const TAMANHOS = [10, 20, 30, 50, 100];
  const MAX_RODADAS_POR_PONTOS = 40;
  const maxPos = l => Math.max(...l.itens.map(i => i.pos));
  const render = html => { app.innerHTML = html; };

  let sala = null, souHost = false, estado = null, presentes = [];
  let H = null, M = null; // H = estado do anfitrião (salvo); M = matchers (recriados)

  const url = new URLSearchParams(location.search);
  Sala.telaEntrada(app, 'Top 100', 'top100.html', (nome, codigo, criar) => {
    souHost = criar || Sala.souHostDe(JOGO) === codigo;
    history.replaceState(null, '', '?sala=' + codigo);
    if (souHost) {
      H = Sala.carregarHost(JOGO, codigo) || {
        cfg: { lista: 'sortear', estilo: url.get('estilo') || 'pontos', tamanho: +(url.get('n') || 100), modo: 'rodadas', rodadas: 10, alvoMult: 3 },
        fase: 'lobby', partida: 0
      };
      if (H.listaId) prepararMatchers();
    }
    render('<div class="pass"><div class="emoji">📡</div><p class="muted">Conectando…</p></div>');
    sala = Sala.conectar({
      jogo: JOGO, codigo, nome, host: souHost,
      onEstado: e => { estado = e; desenhar(); },
      onPrivado: d => { if (d && d.aviso) toast(d.aviso); },
      onAcao: souHost ? acaoHost : null,
      onPresenca: lista => { presentes = lista; if (souHost) publicar(); else desenhar(); },
      onStatus: st => { if (st === 'SUBSCRIBED') { if (souHost) publicar(); else if (!estado) desenhar(); } if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') toast('Problema de conexão. Tentando de novo…'); }
    });
  });

  // ---------- anfitrião ----------
  const lista = () => LISTAS.find(l => l.id === H.listaId);
  function prepararMatchers() {
    const l = lista();
    M = { itens: l.itens.filter(i => i.pos <= H.N), completo: C.criarMatcher(l.itens) };
    M.match = C.criarMatcher(M.itens);
  }
  const nomeId = id => (H.jogadores || []).find(j => j.id === id)?.nome || '?';
  const pub = it => it ? { pos: it.pos, nome: it.nome, info: it.info || '' } : null;
  const penal = () => H.N + 1;

  function publico() {
    const l = H.listaId ? lista() : null;
    const final = H.fase === 'final';
    return {
      fase: H.fase, partida: H.partida, cfg: H.cfg, jogadores: H.jogadores || [],
      lista: l ? { titulo: l.titulo, tema: l.tema, referencia: l.referencia, max: maxPos(l) } : null, N: H.N,
      rodada: H.rodada, ordem: H.ordem || [], vez: H.vez, placar: H.placar || {}, vivos: H.vivos || [], folgas: H.folgas || {},
      chutes: (H.chutes || []).map(c => ({ jogador: c.jogador, texto: c.texto, pontos: c.pontos, status: c.status, passou: c.passou,
        item: c.status === 'passou' && !final ? null : pub(c.idx != null ? M.itens[c.idx] : null),
        foraPos: c.status === 'passou' && !final ? null : c.foraPos })),
      pendente: H.pendente ? { jogador: H.pendente.jogador, texto: H.pendente.texto, passes: H.pendente.passes } : null,
      msg: H.msg || null, log: H.log || [],
      itensFinal: final ? M.itens.map(pub) : null,
      acabouLista: H.acabouLista || false
    };
  }
  function publicar() { Sala.salvarHost(JOGO, sala.codigo, H); sala.publicar(publico()); }

  function iniciar() {
    const js = presentes.map(p => ({ id: p.id, nome: p.nome }));
    if (js.length < 2) { toast('Precisa de pelo menos 2 pessoas na sala.'); return; }
    const cabem = LISTAS.filter(l => maxPos(l) >= H.cfg.tamanho);
    const l = H.cfg.lista === 'sortear' ? (cabem.length ? cabem : LISTAS)[Math.floor(Math.random() * (cabem.length || LISTAS.length))] : LISTAS.find(x => x.id === H.cfg.lista);
    H.listaId = l.id; H.N = Math.min(H.cfg.tamanho, maxPos(l));
    prepararMatchers();
    H.partida++; H.jogadores = js; H.rodada = 1; H.offset = (H.offset || 0);
    H.placar = Object.fromEntries(js.map(j => [j.id, 0]));
    H.vivos = js.map(j => j.id); H.folgas = Object.fromEntries(js.map(j => [j.id, 0]));
    H.chutes = []; H.usados = []; H.log = []; H.msg = null; H.pendente = null; H.acabouLista = false;
    ordenar(); H.vez = 0;
    H.fase = 'apresentacao';
    publicar();
  }
  function ordenar() {
    const ids = H.jogadores.map(j => j.id), n = ids.length;
    const ini = ((H.offset || 0) + H.rodada - 1) % n;
    H.ordem = ids.slice(ini).concat(ids.slice(0, ini));
  }
  function comecar() { H.fase = 'jogo'; if (H.cfg.estilo === 'duvido') pularMortosEFolgas(); publicar(); }

  function identificar(texto) {
    const r = M.match(texto);
    const livre = it => !H.usados.includes(M.itens.indexOf(it));
    if (r && r.ambiguos) {
      const livres = r.ambiguos.filter(livre);
      const mesmo = livres.length > 1 && livres.every(it => C.norm(it.nome) === C.norm(livres[0].nome));
      if (livres.length === 1 || mesmo) return { idx: M.itens.indexOf(livres[0]) };
      return { erro: livres.length ? 'Mais de um item bate com isso: seja mais específico.' : 'Esse já foi falado.' };
    }
    if (r && r.item) { const idx = M.itens.indexOf(r.item); return H.usados.includes(idx) ? { erro: `${r.item.nome} já foi falado.` } : { idx }; }
    if (H.chutes.some(c => c.idx == null && C.norm(c.texto) === C.norm(texto))) return { erro: 'Esse já foi falado.' };
    const rf = H.N < maxPos(lista()) ? M.completo(texto) : null;
    return { idx: null, foraPos: rf && rf.item ? rf.item.pos : null };
  }

  function acaoHost(msg) {
    const atual = H.ordem && H.ordem[H.vez];
    if (msg.tipo === 'chute' && H.fase === 'jogo' && msg.de === atual && !H.pendente) {
      const texto = String(msg.dados.texto || '').trim().slice(0, 60); if (!texto) return;
      const id = identificar(texto);
      if (id.erro) { sala.privado(msg.de, { aviso: id.erro, t: Date.now() }); return; }
      if (H.cfg.estilo === 'duvido') { H.pendente = { jogador: msg.de, texto, idx: id.idx, foraPos: id.foraPos, passes: [] }; H.msg = null; publicar(); return; }
      const pontos = id.idx != null ? M.itens[id.idx].pos : (H.cfg.estilo === 'reverso' ? penal() : 0);
      if (id.idx != null) H.usados.push(id.idx);
      registrar({ jogador: msg.de, texto, idx: id.idx, foraPos: id.foraPos, pontos, status: 'chute' });
    }
    if (msg.tipo === 'passar' && H.fase === 'jogo' && msg.de === atual && H.cfg.estilo !== 'duvido') {
      registrar({ jogador: msg.de, texto: '', idx: null, pontos: H.cfg.estilo === 'reverso' ? penal() : 0, status: 'chute', passou: true });
    }
    if (H.pendente && H.fase === 'jogo' && msg.de !== H.pendente.jogador && H.vivos.includes(msg.de)) {
      if (msg.tipo === 'duvido') resolverDuvida(msg.de);
      if (msg.tipo === 'passa' && !H.pendente.passes.includes(msg.de)) {
        H.pendente.passes.push(msg.de);
        const outros = H.vivos.filter(v => v !== H.pendente.jogador);
        if (outros.every(o => H.pendente.passes.includes(o))) aceitarSemDuvida(); else publicar();
      }
    }
  }

  function registrar(c) {
    c.rodada = H.rodada; H.chutes.push(c); H.placar[c.jogador] += c.pontos;
    H.msg = { tipo: c.idx != null ? 'exact' : 'bust', html: `${esc(nomeId(c.jogador))}: ${c.idx != null ? `#${M.itens[c.idx].pos} · ${esc(M.itens[c.idx].nome)}${M.itens[c.idx].info ? ' · ' + esc(M.itens[c.idx].info) : ''}` : c.passou ? 'passou a vez' : c.foraPos ? `“${esc(c.texto)}” é o #${c.foraPos}, fora do Top ${H.N}` : `“${esc(c.texto)}” não está na lista`} <strong>(${c.pontos ? '+' + c.pontos : '0'})</strong>` };
    H.vez++;
    if (H.usados.length >= M.itens.length) { H.acabouLista = true; H.fase = 'final'; return publicar(); }
    if (H.vez < H.ordem.length) return publicar();
    const meta = H.cfg.estilo === 'pontos' && H.cfg.modo === 'pontos' && Object.values(H.placar).some(p => p >= H.cfg.alvoMult * H.cfg.tamanho);
    const total = H.cfg.estilo === 'pontos' && H.cfg.modo === 'pontos' ? MAX_RODADAS_POR_PONTOS : H.cfg.rodadas;
    H.fase = (meta || H.rodada >= total) ? 'final' : 'fimRodada';
    publicar();
  }
  function proximaRodada() { H.rodada++; H.vez = 0; H.msg = null; ordenar(); H.fase = 'jogo'; publicar(); }

  // --- duvido ---
  function avancarPonteiro() { do { H.vez = (H.vez + 1) % H.ordem.length; } while (!H.vivos.includes(H.ordem[H.vez])); }
  function pularMortosEFolgas() {
    const avisos = [];
    for (let i = 0; i < 50; i++) {
      if (H.vivos.length <= 1) break;
      const a = H.ordem[H.vez];
      if (!H.vivos.includes(a)) { avancarPonteiro(); continue; }
      if (H.folgas[a] > 0) { H.folgas[a]--; avisos.push(`🛡️ ${esc(nomeId(a))} usou a folga.`); avancarPonteiro(); continue; }
      break;
    }
    if (avisos.length) H.msg = { tipo: 'under', html: (H.msg ? H.msg.html + '<br>' : '') + avisos.join('<br>') };
  }
  function checarFimDuvido() {
    if (H.vivos.length <= 1) { H.fase = 'final'; return true; }
    if (H.usados.length >= M.itens.length) { H.acabouLista = true; H.fase = 'final'; return true; }
    return false;
  }
  function aceitarSemDuvida() {
    const p = H.pendente; H.pendente = null;
    if (p.idx != null) H.usados.push(p.idx);
    H.chutes.push({ jogador: p.jogador, texto: p.texto, idx: p.idx, foraPos: p.foraPos, pontos: 0, status: 'passou' });
    H.msg = { tipo: 'under', html: `${esc(nomeId(p.jogador))}: <strong>${esc(p.texto)}</strong> passou sem dúvida.` };
    avancarPonteiro();
    if (!checarFimDuvido()) pularMortosEFolgas();
    publicar();
  }
  function resolverDuvida(quem) {
    const p = H.pendente; H.pendente = null;
    const falou = nomeId(p.jogador), duv = nomeId(quem);
    if (p.idx != null) {
      const it = M.itens[p.idx]; H.usados.push(p.idx);
      H.chutes.push({ jogador: p.jogador, texto: p.texto, idx: p.idx, pontos: 0, status: 'duvidado-certo' });
      H.vivos = H.vivos.filter(v => v !== quem); H.folgas[p.jogador]++;
      H.log.push(`${duv} duvidou de ${it.nome} (#${it.pos}, falado por ${falou}) e saiu.`);
      H.msg = { tipo: 'exact', html: `✅ <strong>${esc(it.nome)}</strong> está no Top ${H.N} (#${it.pos}). ${esc(duv)} duvidou errado e saiu. ${esc(falou)} ganha folga 🛡️.` };
    } else {
      H.chutes.push({ jogador: p.jogador, texto: p.texto, idx: null, foraPos: p.foraPos, pontos: 0, status: 'duvidado-errado' });
      H.vivos = H.vivos.filter(v => v !== p.jogador); H.folgas[quem]++;
      H.log.push(`${falou} falou “${p.texto}”, ${duv} duvidou e ${falou} saiu.`);
      H.msg = { tipo: 'bust', html: `❌ <strong>${esc(p.texto)}</strong> não está no Top ${H.N}${p.foraPos ? ` (é o #${p.foraPos})` : ''}. ${esc(falou)} saiu. ${esc(duv)} ganha folga 🛡️.` };
    }
    avancarPonteiro();
    if (!checarFimDuvido()) pularMortosEFolgas();
    publicar();
  }
  function voltarLobby() { H.fase = 'lobby'; H.offset = (H.offset || 0) + 1; publicar(); }

  // ---------- telas ----------
  const topo = extra => `<div class="topbar"><span class="pill">Sala ${esc(sala.codigo)}${extra ? ' · ' + extra : ''}</span><a class="link-back" href="top100.html">Sair</a></div>`;
  const nomeDe = id => (estado.jogadores || []).find(j => j.id === id)?.nome || presentes.find(j => j.id === id)?.nome || '?';
  const faixa = m => m ? `<div class="result ${m.tipo}" style="margin-bottom:14px"><span class="who">${m.html}</span></div>` : '';
  const nomeEstilo = e => e === 'duvido' ? '✋ Duvido' : e === 'reverso' ? '🔄 Reverso' : '💯 Pontos';

  function desenhar() {
    const antes = document.getElementById('chute');
    const valor = antes ? antes.value : null, foco = antes && document.activeElement === antes;
    desenhar0();
    const depois = document.getElementById('chute');
    if (depois && valor) depois.value = valor;
    if (depois && foco) depois.focus();
  }
  function desenhar0() {
    if (!estado) return render(`${topo()}<div class="pass"><div class="emoji">⏳</div><p class="muted">Esperando o anfitrião…</p></div>`);
    ({ lobby: telaLobby, apresentacao: telaApresentacao, jogo: telaJogo, fimRodada: telaFimRodada, final: telaFinal })[estado.fase]();
  }

  function telaLobby() {
    const cfg = estado.cfg;
    const opt = (key, val, label, desc) => `<button class="list-opt ${cfg[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}"><strong>${label}</strong>${desc ? `<span class="muted small">${desc}</span>` : ''}</button>`;
    const temas = [...new Set(LISTAS.map(l => l.tema))];
    render(`
      ${topo('Top ' + cfg.tamanho)}
      ${Sala.htmlCodigo(sala.codigo)}
      ${Sala.htmlJogadores(presentes, sala.id)}
      ${souHost ? `
        <div class="card"><span class="label">Tamanho</span>
          <div class="chips">${TAMANHOS.map(n => `<button class="chip ${cfg.tamanho === n ? 'on' : ''}" data-tam="${n}">Top ${n}</button>`).join('')}</div></div>
        <div class="card"><span class="label">Estilo</span>
          ${opt('estilo', 'pontos', '💯 Pontos', 'Pontos = posição. Mais pontos vence.')}
          ${opt('estilo', 'reverso', '🔄 Reverso', `Menos pontos vence. Fora da lista ou passar vale ${cfg.tamanho + 1}.`)}
          ${opt('estilo', 'duvido', '✋ Duvido', 'Sem pontos. Os outros podem duvidar no próprio celular. Último em pé vence.')}
        </div>
        ${cfg.estilo === 'duvido' ? '' : `<div class="card"><span class="label">Como termina</span>
          ${cfg.estilo === 'pontos' ? `<div class="chips" style="margin-bottom:12px"><button class="chip ${cfg.modo === 'rodadas' ? 'on' : ''}" data-modo="rodadas">Em X rodadas</button><button class="chip ${cfg.modo === 'pontos' ? 'on' : ''}" data-modo="pontos">Primeiro a X pontos</button></div>` : ''}
          <div class="chips">${cfg.estilo === 'pontos' && cfg.modo === 'pontos'
            ? [2, 3, 4, 5].map(m => `<button class="chip ${cfg.alvoMult === m ? 'on' : ''}" data-alvo="${m}">${m * cfg.tamanho} pts</button>`).join('')
            : [3, 5, 10, 15, 20].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n} rodadas</button>`).join('')}</div></div>`}
        <div class="card"><span class="label">Lista</span>
          <button class="list-opt ${cfg.lista === 'sortear' ? 'on' : ''}" data-lista="sortear"><strong>🎲 Sortear uma lista</strong></button>
          ${temas.map(t => `<div class="muted small" style="margin:12px 0 6px;font-weight:700">${esc(t)}</div>${LISTAS.filter(l => l.tema === t).map(l => `<button class="list-opt ${cfg.lista === l.id ? 'on' : ''}" data-lista="${esc(l.id)}" ${maxPos(l) < cfg.tamanho ? 'style="opacity:.55"' : ''}><strong>${esc(l.titulo)}</strong><span class="muted small">${maxPos(l) < cfg.tamanho ? `Só tem Top ${maxPos(l)} · ` : ''}${esc(l.referencia)}</span></button>`).join('')}`).join('')}
        </div>
        <button class="btn" id="comecar" ${presentes.length >= 2 ? '' : 'disabled'}>Começar com ${C.plural(presentes.length, 'jogador', 'jogadores')}</button>
      ` : `<p class="muted center">Top ${cfg.tamanho} · ${nomeEstilo(cfg.estilo)}. O anfitrião vai começar.</p>`}
    `);
    Sala.ligarCodigo(sala.codigo);
    if (!souHost) return;
    const set = (k, v) => { H.cfg[k] = v; publicar(); };
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => set(b.dataset.k, b.dataset.v));
    app.querySelectorAll('[data-tam]').forEach(b => b.onclick = () => set('tamanho', +b.dataset.tam));
    app.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => set('modo', b.dataset.modo));
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => set('rodadas', +b.dataset.rod));
    app.querySelectorAll('[data-alvo]').forEach(b => b.onclick = () => set('alvoMult', +b.dataset.alvo));
    app.querySelectorAll('[data-lista]').forEach(b => b.onclick = () => set('lista', b.dataset.lista));
    document.getElementById('comecar').onclick = iniciar;
  }

  function cartaoLista() {
    const l = estado.lista;
    return `<div class="card"><span class="pill theme">${esc(l.tema)} · Top ${estado.N} · ${nomeEstilo(estado.cfg.estilo)}</span>
      <div class="question" style="font-size:1.3rem">${esc(l.titulo)}</div>
      <div class="fact" style="margin-top:10px">ℹ️ ${esc(l.referencia)}${estado.N < l.max ? ` · valem só as posições 1 a ${estado.N}` : ''}</div></div>`;
  }

  function telaApresentacao() {
    render(`${topo(`Top ${estado.N}`)}${cartaoLista()}
      <p class="muted small center">Ordem: ${estado.ordem.map(id => esc(nomeDe(id))).join(' → ')}</p>
      ${souHost ? `<button class="btn" id="ir">Começar</button>${estado.cfg.lista === 'sortear' ? '<button class="btn ghost" id="outra">🎲 Sortear outra lista</button>' : ''}` : '<p class="muted center">Aguardando o anfitrião…</p>'}`);
    if (souHost) { document.getElementById('ir').onclick = comecar; const o = document.getElementById('outra'); if (o) o.onclick = () => { H.partida--; iniciar(); }; }
  }

  function placarHtml() {
    const rank = estado.jogadores.map(j => [j.id, estado.placar[j.id] || 0]).sort((a, b) => estado.cfg.estilo === 'reverso' ? a[1] - b[1] : b[1] - a[1]);
    return `<table class="score">${rank.map(([id, p]) => `<tr><td>${esc(nomeDe(id))}${id === sala.id ? ' <span class="muted small">(você)</span>' : ''}</td><td>${C.plural(p, 'pt')}</td></tr>`).join('')}</table>`;
  }
  function chipsVivos() {
    return `<div class="chips" style="justify-content:center;margin:10px 0">${estado.ordem.map(id => `<span class="chip ${estado.vivos.includes(id) ? (id === estado.ordem[estado.vez] ? 'on' : '') : 'out'}">${estado.vivos.includes(id) ? '' : '❌ '}${esc(nomeDe(id))}${estado.folgas[id] ? ' 🛡️' : ''}</span>`).join('')}</div>`;
  }
  function jaFalados() {
    if (!estado.chutes.length) return '';
    return `<div class="card"><span class="label">Já falados</span><div class="said">${estado.chutes.slice().reverse().map(c => c.status === 'passou' && !c.item && estado.fase !== 'final'
      ? `<span class="said-item">${esc(c.texto)}<span class="by">${esc(nomeDe(c.jogador))}</span></span>`
      : `<span class="said-item ${c.item ? 'ok' : 'miss'}">${c.item ? '#' + c.item.pos + ' ' + esc(c.item.nome) : esc(c.texto || 'passou')}<span class="by">${esc(nomeDe(c.jogador))}</span></span>`).join('')}</div></div>`;
  }

  function telaJogo() {
    const duvido = estado.cfg.estilo === 'duvido';
    const atual = estado.ordem[estado.vez];
    const minhaVez = atual === sala.id;
    const pend = estado.pendente;
    let acao = '';
    if (duvido && pend) {
      const eu = pend.jogador === sala.id, vivoEu = estado.vivos.includes(sala.id), passei = pend.passes.includes(sala.id);
      acao = `<div class="pass" style="padding:14px 0"><p class="muted">${esc(nomeDe(pend.jogador))} disse</p><div class="big-name" style="font-size:2rem">${esc(pend.texto)}</div>
        ${eu ? '<p class="muted">Esperando os outros decidirem se duvidam…</p>' : !vivoEu ? '<p class="muted">Você está fora, só assistindo.</p>' : passei ? '<p class="muted">Você deixou passar. Esperando os outros…</p>'
          : `<p class="muted">Está no Top ${estado.N}? Você duvida?</p><button class="btn duvido" id="duvido">✋ Duvido!</button><button class="btn secondary" id="passa">👍 Deixa passar</button>`}
        <div class="muted small">${pend.passes.length ? `Deixaram passar: ${pend.passes.map(id => esc(nomeDe(id))).join(', ')}` : ''}</div>
        ${souHost ? '<button class="btn ghost" id="forcar">Ninguém duvidou, seguir</button>' : ''}</div>`;
    } else if (minhaVez) {
      acao = `<div class="card"><p style="margin:0 0 10px"><strong style="font-size:1.3rem">Sua vez!</strong> ${duvido ? `Fale um item do Top ${estado.N}:` : 'Seu chute:'}</p>
        <form id="f"><input type="text" id="chute" autocomplete="off" autocapitalize="words" placeholder="Digite o nome"><button class="btn" type="submit">${duvido ? 'Falar' : 'Chutar'}</button></form>
        ${duvido ? '' : `<button class="btn ghost" id="passar">Passar a vez (${C.plural(estado.cfg.estilo === 'reverso' ? estado.N + 1 : 0, 'ponto')})</button>`}</div>`;
    } else {
      acao = `<div class="card center"><div class="muted small">Vez de</div><div class="big-name" style="font-size:1.8rem;margin:4px 0">${esc(nomeDe(atual))}</div><div class="muted small">Aguardando o chute…</div></div>`;
    }
    const cab = duvido ? `${estado.vivos.length} na disputa` : estado.cfg.estilo === 'pontos' && estado.cfg.modo === 'pontos' ? `Rodada ${estado.rodada} · meta ${estado.cfg.alvoMult * estado.cfg.tamanho}` : `Rodada ${estado.rodada}/${estado.cfg.rodadas}`;
    render(`${topo(cab)}${faixa(estado.msg)}${cartaoLista()}${duvido ? chipsVivos() : ''}${acao}
      ${duvido ? '' : `<div class="card"><span class="label">Placar${estado.cfg.estilo === 'reverso' ? ' (menos é melhor)' : ''}</span>${placarHtml()}</div>`}${jaFalados()}`);
    const f = document.getElementById('f');
    if (f) f.onsubmit = e => { e.preventDefault(); const inp = document.getElementById('chute'); const t = inp.value.trim(); if (!t) return; inp.value = ''; sala.enviar('chute', { texto: t }); };
    const ps = document.getElementById('passar'); if (ps) ps.onclick = () => sala.enviar('passar');
    const d = document.getElementById('duvido'); if (d) d.onclick = () => sala.enviar('duvido');
    const pa = document.getElementById('passa'); if (pa) pa.onclick = () => sala.enviar('passa');
    const fo = document.getElementById('forcar'); if (fo) fo.onclick = () => { if (H.pendente) aceitarSemDuvida(); };
  }

  function telaFimRodada() {
    const da = estado.chutes.filter((c, i) => i >= estado.chutes.length - estado.ordem.length);
    render(`${topo(`Rodada ${estado.rodada}`)}
      <div class="card"><span class="label">Rodada ${estado.rodada}</span>${da.map(c => `<div class="result ${c.item ? 'exact' : 'bust'}"><span class="who">${esc(nomeDe(c.jogador))}<br><span class="small muted">${c.item ? '#' + c.item.pos + ' · ' + esc(c.item.nome) : c.passou ? 'Passou' : c.foraPos ? `“${esc(c.texto)}” é o #${c.foraPos}` : `“${esc(c.texto)}” fora da lista`}</span></span><span class="pts">${c.pontos ? '+' + c.pontos : '0'}</span></div>`).join('')}</div>
      <div class="card"><span class="label">Placar${estado.cfg.estilo === 'reverso' ? ' (menos é melhor)' : ''}</span>${placarHtml()}</div>
      ${souHost ? '<button class="btn" id="prox">Próxima rodada</button>' : '<p class="muted center">Aguardando o anfitrião…</p>'}`);
    if (souHost) document.getElementById('prox').onclick = proximaRodada;
  }

  function telaFinal() {
    const duvido = estado.cfg.estilo === 'duvido';
    let camp, sub;
    if (duvido) { camp = estado.ordem.filter(id => estado.vivos.includes(id)).map(nomeDe); sub = camp.length > 1 ? 'Sobreviventes' : 'Último em pé'; }
    else {
      const rank = estado.jogadores.map(j => [j.nome, estado.placar[j.id] || 0]).sort((a, b) => estado.cfg.estilo === 'reverso' ? a[1] - b[1] : b[1] - a[1]);
      camp = rank.filter(r => r[1] === rank[0][1]).map(r => r[0]); sub = camp.length > 1 ? 'Empate! Campeões da vez' : 'Campeão da vez';
    }
    const quem = {}; estado.chutes.forEach(c => { if (c.item) quem[c.item.pos + '|' + c.item.nome] = nomeDe(c.jogador); });
    const blefes = estado.chutes.filter(c => c.status === 'passou' && !c.item);
    render(`
      <div class="center" style="margin-top:10px"><div class="trophy">🏆</div><p class="muted" style="margin:6px 0 0">${estado.acabouLista ? 'A lista acabou! ' : ''}${sub}</p>
        <h1 class="logo" style="font-size:2.4rem">${camp.map(esc).join(' & ')}</h1></div>
      ${duvido ? '' : `<div class="card"><span class="label">Classificação final</span>${placarHtml()}</div>`}
      ${estado.log.length ? `<div class="card"><span class="label">Eliminações</span>${estado.log.map(l => `<p class="small" style="margin:6px 0">${esc(l)}</p>`).join('')}</div>` : ''}
      ${blefes.length ? `<div class="card"><span class="label">Passaram sem ninguém duvidar, mas não estavam 🤫</span>${blefes.map(b => `<p class="small" style="margin:6px 0"><strong>${esc(nomeDe(b.jogador))}</strong>: ${esc(b.texto)}${b.foraPos ? ` (era o #${b.foraPos})` : ''}</p>`).join('')}</div>` : ''}
      <div class="card"><span class="label">O Top ${estado.N} completo</span><div class="muted small" style="margin-bottom:10px">${esc(estado.lista.titulo)} · ${esc(estado.lista.referencia)}</div>
        <ol class="full-list">${(estado.itensFinal || []).map(it => { const q = quem[it.pos + '|' + it.nome]; return `<li class="${q ? 'hit' : ''}"><span class="pos">${it.pos}</span><span class="grow">${esc(it.nome)}${it.info ? ` <span class="muted small">${esc(it.info)}</span>` : ''}</span>${q ? `<span class="tag close">${esc(q)}</span>` : ''}</li>`; }).join('')}</ol></div>
      ${souHost ? '<button class="btn" id="denovo">Nova partida na mesma sala</button>' : '<p class="muted center">O anfitrião pode começar outra partida.</p>'}
      <a class="btn ghost" href="index.html">Voltar aos jogos</a>`);
    if (souHost) document.getElementById('denovo').onclick = voltarLobby;
  }

})();
