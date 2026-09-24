// Top 100 / Top 10 — modo um celular
// Estilos:
//  - Pontos:  chute um item; se está na lista, ganha pontos = posição. Fora = 0. Mais pontos vence.
//  - Reverso: pontos = posição, mas MENOS pontos vence. Fora da lista / passar = tamanho da lista + 1.
//  - Duvido:  fala um item; os outros passam ou duvidam. O app só confere quando alguém duvida.
//             Duvidou e estava → quem duvidou sai, quem falou ganha folga. Não estava → quem falou sai, quem duvidou ganha folga.
// Tamanho: Top 10, 20, 30, 50 ou 100 (usa só os itens até essa posição).
(function () {
  const C = window.Comum;
  const { esc, store, toast } = C;
  const app = document.getElementById('app');
  const LISTAS = window.LISTAS_TOP100 || [];
  const MAX_RODADAS_POR_PONTOS = 40;
  const TAMANHOS = [10, 20, 30, 50, 100];

  const url = new URLSearchParams(location.search);
  const cfg = {
    jogadores: C.carregarJogadores(),
    lista: store.get('top100:lista', 'sortear'),
    estilo: url.get('estilo') || store.get('top100:estilo', 'pontos'), // 'pontos' | 'reverso' | 'duvido'
    tamanho: +(url.get('n') || store.get('top100:tamanho', 100)),
    modo: store.get('top100:modo', 'rodadas'), // (estilo pontos) 'rodadas' | 'pontos'
    rodadas: store.get('top100:rodadas', 10),
    alvoMult: store.get('top100:alvoMult', 3)
  };
  const salvar = () => ['lista', 'estilo', 'tamanho', 'modo', 'rodadas', 'alvoMult'].forEach(k => store.set('top100:' + k, cfg[k]));

  let jogo = null;
  const render = html => { app.innerHTML = html; window.scrollTo(0, 0); };
  const maxPos = l => Math.max(...l.itens.map(i => i.pos));
  const tamanhoEfetivo = l => Math.min(cfg.tamanho, maxPos(l));
  const alvo = () => cfg.alvoMult * cfg.tamanho;
  const nomeJogo = () => `Top ${cfg.tamanho}`;

  // ---------- configuração ----------
  function telaSetup() {
    const pode = cfg.jogadores.length >= 2;
    const temas = [...new Set(LISTAS.map(l => l.tema))];
    const cabem = LISTAS.filter(l => maxPos(l) >= cfg.tamanho);
    const opt = (key, val, label, desc) => `<button class="list-opt ${cfg[key] === val ? 'on' : ''}" data-k="${key}" data-v="${val}"><strong>${label}</strong>${desc ? `<span class="muted small">${desc}</span>` : ''}</button>`;
    render(`
      <div class="topbar"><a class="link-back" href="../">← Jogos</a></div>
      <div class="modo-toggle"><span class="on">📱 Um celular</span><a href="sala.html?estilo=${cfg.estilo}&n=${cfg.tamanho}">📲 Vários celulares</a></div>
      <div class="center" style="margin-bottom:18px">
        <div class="logo">${nomeJogo()}</div>
        <p class="muted" style="margin:4px 0 0">${cfg.estilo === 'duvido'
          ? 'Fale algo que está na lista. Ninguém duvidou, passa. Duvidaram, o app confere.'
          : cfg.estilo === 'reverso'
            ? 'Reverso: acerte os primeiros da lista. Menos pontos vence.'
            : 'Acerte algo que está na lista. Quanto mais lá embaixo, mais pontos.'}</p>
      </div>

      ${C.htmlEditorJogadores(cfg.jogadores)}

      <div class="card">
        <span class="label">Tamanho da lista</span>
        <div class="chips">
          ${TAMANHOS.map(n => `<button class="chip ${cfg.tamanho === n ? 'on' : ''}" data-tam="${n}">Top ${n}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <span class="label">Estilo de jogo</span>
        ${opt('estilo', 'pontos', '💯 Pontos', `Pontos = posição. O nº 1 vale 1, o nº ${cfg.tamanho} vale ${cfg.tamanho}. Fora da lista vale 0. Mais pontos vence.`)}
        ${opt('estilo', 'reverso', '🔄 Reverso', `Pontos = posição, mas MENOS pontos vence. Fora da lista ou passar vale ${cfg.tamanho + 1}. Cravar os primeiros é o segredo.`)}
        ${opt('estilo', 'duvido', '✋ Duvido', 'Sem pontos. Fala um item; se alguém duvidar, o app confere. Errou ou duvidou errado, está fora. Último em pé vence.')}
      </div>

      ${cfg.estilo === 'duvido' ? '' : `
      <div class="card">
        <span class="label">Como termina</span>
        ${cfg.estilo === 'pontos' ? `<div class="chips" style="margin-bottom:12px">
          <button class="chip ${cfg.modo === 'rodadas' ? 'on' : ''}" data-modo="rodadas">Em X rodadas</button>
          <button class="chip ${cfg.modo === 'pontos' ? 'on' : ''}" data-modo="pontos">Primeiro a X pontos</button>
        </div>` : ''}
        <div class="chips">
          ${cfg.estilo === 'pontos' && cfg.modo === 'pontos'
            ? [2, 3, 4, 5].map(m => `<button class="chip ${cfg.alvoMult === m ? 'on' : ''}" data-alvo="${m}">${m * cfg.tamanho} pts</button>`).join('')
            : [3, 5, 10, 15, 20].map(n => `<button class="chip ${cfg.rodadas === n ? 'on' : ''}" data-rod="${n}">${n} rodadas</button>`).join('')}
        </div>
        <p class="muted small" style="margin:12px 0 0">${cfg.estilo === 'pontos' && cfg.modo === 'pontos'
          ? 'Quando alguém passar da meta, a rodada é completada para todos terem o mesmo número de chutes.'
          : 'Se a lista acabar antes, o jogo termina ali.'}</p>
      </div>`}

      <div class="card">
        <span class="label">Lista</span>
        <button class="list-opt ${cfg.lista === 'sortear' ? 'on' : ''}" data-lista="sortear"><strong>🎲 Sortear uma lista</strong>
          <span class="muted small">${cabem.length} listas com pelo menos ${cfg.tamanho} itens</span></button>
        ${temas.map(t => {
          const ls = LISTAS.filter(l => l.tema === t);
          return `<div class="muted small" style="margin:12px 0 6px;font-weight:700">${esc(t)}</div>
          ${ls.map(l => `
            <button class="list-opt ${cfg.lista === l.id ? 'on' : ''}" data-lista="${esc(l.id)}" ${maxPos(l) < cfg.tamanho ? 'style="opacity:.55"' : ''}>
              <strong>${esc(l.titulo)}</strong>
              <span class="muted small">${maxPos(l) < cfg.tamanho ? `Só tem Top ${maxPos(l)} · ` : ''}${esc(l.referencia)}</span>
            </button>`).join('')}`;
        }).join('')}
      </div>

      <button class="btn" id="comecar" ${pode ? '' : 'disabled'}>Começar</button>
    `);
    C.ligarEditorJogadores(app, cfg.jogadores, telaSetup);
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { cfg[b.dataset.k] = b.dataset.v; salvar(); telaSetup(); });
    app.querySelectorAll('[data-tam]').forEach(b => b.onclick = () => { cfg.tamanho = +b.dataset.tam; salvar(); telaSetup(); });
    app.querySelectorAll('[data-lista]').forEach(b => b.onclick = () => { cfg.lista = b.dataset.lista; salvar(); telaSetup(); });
    app.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { cfg.modo = b.dataset.modo; salvar(); telaSetup(); });
    app.querySelectorAll('[data-rod]').forEach(b => b.onclick = () => { cfg.rodadas = +b.dataset.rod; salvar(); telaSetup(); });
    app.querySelectorAll('[data-alvo]').forEach(b => b.onclick = () => { cfg.alvoMult = +b.dataset.alvo; salvar(); telaSetup(); });
    document.getElementById('comecar').onclick = () => iniciar();
  }

  function escolherLista() {
    if (cfg.lista !== 'sortear') return LISTAS.find(l => l.id === cfg.lista) || LISTAS[0];
    const cabem = LISTAS.filter(l => maxPos(l) >= cfg.tamanho);
    const pool = cabem.length ? cabem : LISTAS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function iniciar(offset) {
    const lista = escolherLista();
    const N = tamanhoEfetivo(lista);
    const itens = lista.itens.filter(i => i.pos <= N);
    jogo = {
      lista, N, itens,
      match: C.criarMatcher(itens),
      matchCompleto: C.criarMatcher(lista.itens), // para dizer "está na lista, mas fora do Top N"
      placar: Object.fromEntries(cfg.jogadores.map(j => [j, 0])),
      chutes: [], // {jogador, texto, item|null, pontos, rodada, status}
      usados: new Set(),
      rodada: 1,
      vez: 0,
      offset: typeof offset === 'number' ? offset : 0,
      ultimo: null,
      vivos: new Set(cfg.jogadores),
      folgas: Object.fromEntries(cfg.jogadores.map(j => [j, 0])),
      log: []
    };
    ordenar();
    telaApresentacao();
  }

  function ordenar() {
    const n = cfg.jogadores.length;
    const ini = (jogo.offset + jogo.rodada - 1) % n;
    jogo.ordem = cfg.jogadores.slice(ini).concat(cfg.jogadores.slice(0, ini));
  }

  const totalRodadas = () => (cfg.estilo === 'pontos' && cfg.modo === 'pontos') ? MAX_RODADAS_POR_PONTOS : cfg.rodadas;
  const penalidade = () => jogo.N + 1;

  function cabecalho() {
    let meta;
    if (cfg.estilo === 'duvido') meta = `${jogo.vivos.size} na disputa`;
    else if (cfg.estilo === 'pontos' && cfg.modo === 'pontos') meta = `Rodada ${jogo.rodada} · meta ${alvo()} pts`;
    else meta = `Rodada ${jogo.rodada}/${cfg.rodadas}${cfg.estilo === 'reverso' ? ' · reverso' : ''}`;
    return `<div class="topbar"><span class="pill">${meta}</span><button class="link-back" id="sair">Sair</button></div>`;
  }
  function ligarSair() {
    const s = document.getElementById('sair');
    if (s) s.onclick = () => { if (confirm('Sair do jogo atual? O placar será perdido.')) { jogo = null; telaSetup(); } };
  }

  // Contexto da lista: fonte, data, critério (sem entregar respostas)
  function contexto() {
    const l = jogo.lista;
    return `<div class="fact" style="margin-top:10px">ℹ️ ${esc(l.referencia)}${jogo.N < maxPos(l) ? ` · valem só as posições 1 a ${jogo.N}` : ''}${l.nota ? ' · ' + esc(l.nota) : ''}</div>`;
  }
  function cartaoLista() {
    const l = jogo.lista;
    return `<div class="card">
      <span class="pill theme">${esc(l.tema)} · Top ${jogo.N}</span>
      <div class="question" style="font-size:1.35rem">${esc(l.titulo)}</div>
      ${contexto()}
    </div>`;
  }

  function regrasCurtas() {
    if (cfg.estilo === 'duvido') return 'Cada um fala um item. Ninguém duvidou, passa. Alguém duvidou, o app confere: errou quem falou, ele sai; acertou, quem duvidou sai. Quem ganhou o duelo fica uma rodada de folga.';
    if (cfg.estilo === 'reverso') return `Pontos = posição. Fora da lista ou passar = ${penalidade()} pontos. Menos pontos vence.`;
    return `Pontos = posição (o nº ${jogo.N} vale ${jogo.N}). Fora da lista = 0. Mais pontos vence.`;
  }

  function telaApresentacao() {
    render(`
      <div class="topbar"><span class="pill">${nomeJogo()} · ${cfg.estilo === 'duvido' ? '✋ Duvido' : cfg.estilo === 'reverso' ? '🔄 Reverso' : '💯 Pontos'}</span><button class="link-back" id="sair">Sair</button></div>
      ${cartaoLista()}
      <p class="small center">${regrasCurtas()}</p>
      <p class="muted small center">Ordem: ${jogo.ordem.map(esc).join(' → ')}</p>
      <button class="btn" id="ir">Começar</button>
      ${cfg.lista === 'sortear' ? '<button class="btn ghost" id="outra">🎲 Sortear outra lista</button>' : ''}
    `);
    ligarSair();
    document.getElementById('ir').onclick = () => cfg.estilo === 'duvido' ? proximaVezDuvido() : telaVez();
    const o = document.getElementById('outra');
    if (o) o.onclick = () => iniciar(jogo.offset);
  }

  function ranking() {
    const r = Object.entries(jogo.placar);
    return cfg.estilo === 'reverso' ? r.sort((a, b) => a[1] - b[1]) : r.sort((a, b) => b[1] - a[1]);
  }
  function miniPlacar() {
    return `<table class="score">${ranking().map(([n, p]) => `<tr><td>${esc(n)}</td><td>${C.plural(p, 'pt')}</td></tr>`).join('')}</table>`;
  }

  function listaChutes(revelarTudo) {
    if (!jogo.chutes.length) return '';
    return `<div class="card"><span class="label">Já falados</span><div class="said">
      ${jogo.chutes.slice().reverse().map(c => {
        const oculto = c.status === 'passou' && !revelarTudo;
        if (oculto) return `<span class="said-item">${esc(c.texto)}</span>`;
        return `<span class="said-item ${c.item ? 'ok' : 'miss'}">${c.item ? '#' + c.item.pos + ' ' + esc(c.item.nome) : esc(c.texto)}</span>`;
      }).join('')}
    </div></div>`;
  }

  // Identifica o item digitado. Retorna { item } | { erro } | { fora: true, itemFora? }
  function identificar(texto) {
    const r = jogo.match(texto);
    if (r && r.ambiguos) {
      const livres = r.ambiguos.filter(it => !jogo.usados.has(it));
      const mesmoNome = livres.length > 1 && livres.every(it => C.norm(it.nome) === C.norm(livres[0].nome));
      if (livres.length === 1 || mesmoNome) return { item: livres[0] };
      if (!livres.length) return { erro: 'Esse já foi falado. Tente outro.' };
      return { erro: 'Mais de um item bate com isso: seja mais específico.' };
    }
    if (r && r.item) {
      if (jogo.usados.has(r.item)) return { erro: `${r.item.nome} já foi falado. Tente outro.` };
      return { item: r.item };
    }
    if (jogo.chutes.some(c => !c.item && C.norm(c.texto) === C.norm(texto))) return { erro: 'Esse já foi falado. Tente outro.' };
    const rf = jogo.N < maxPos(jogo.lista) ? jogo.matchCompleto(texto) : null;
    return { fora: true, itemFora: rf && rf.item ? rf.item : null };
  }

  // ---------- estilos Pontos e Reverso ----------
  function classeResultado(c) {
    if (!c.item) return 'bust';
    const bom = cfg.estilo === 'reverso' ? c.item.pos <= Math.ceil(jogo.N / 5) : c.item.pos >= Math.ceil(jogo.N / 2);
    return bom ? 'exact' : 'close';
  }
  function descChute(c) {
    if (c.item) return '#' + c.item.pos + ' · ' + esc(c.item.nome) + (c.item.info ? ' · ' + esc(c.item.info) : '');
    if (c.passou) return 'Passou a vez';
    if (c.itemFora) return `“${esc(c.texto)}” é o #${c.itemFora.pos} da lista, fora do Top ${jogo.N}`;
    return `“${esc(c.texto)}” não está na lista`;
  }
  const fmtPts = p => (cfg.estilo === 'reverso' ? '+' + p : (p ? '+' + p : '0'));

  function telaVez() {
    const nome = jogo.ordem[jogo.vez];
    const u = jogo.ultimo;
    const valorPassar = cfg.estilo === 'reverso' ? penalidade() : 0;
    render(`
      ${cabecalho()}
      ${u ? `<div class="result ${classeResultado(u)}" style="margin-bottom:14px">
          <span class="who">${esc(u.jogador)}<br><span class="small muted">${descChute(u)}</span></span>
          <span class="pts">${fmtPts(u.pontos)}</span>
        </div>
        ${u.item || u.passou ? '' : '<button class="link-back small" id="desfazer" style="text-decoration:underline;margin:-6px 0 14px">Digitei errado, deixar corrigir</button>'}` : ''}
      <div class="card">
        <span class="pill theme">${esc(jogo.lista.titulo)} · Top ${jogo.N}</span>
        <p style="margin:14px 0 8px"><strong style="font-size:1.4rem">${esc(nome)}</strong>, seu chute:</p>
        <form id="f">
          <input type="text" id="chute" autocomplete="off" autocapitalize="words" placeholder="Digite o nome">
          <button class="btn" type="submit">Chutar</button>
        </form>
        <button class="btn ghost" id="passar">Passar a vez (${C.plural(valorPassar, 'ponto')})</button>
        ${contexto()}
      </div>
      <div class="card"><span class="label">Placar${cfg.estilo === 'reverso' ? ' (menos é melhor)' : ''}</span>${miniPlacar()}</div>
      ${listaChutes(true)}
    `);
    ligarSair();
    const inp = document.getElementById('chute');
    inp.focus();
    document.getElementById('f').onsubmit = e => { e.preventDefault(); chutar(inp.value); };
    document.getElementById('passar').onclick = () => registrar({ jogador: nome, texto: '', item: null, pontos: valorPassar, passou: true });
    const d = document.getElementById('desfazer');
    if (d) d.onclick = desfazer;
  }

  function chutar(texto) {
    texto = texto.trim();
    if (!texto) return;
    const nome = jogo.ordem[jogo.vez];
    const id = identificar(texto);
    if (id.erro) { toast(id.erro); return; }
    if (id.item) {
      jogo.usados.add(id.item);
      return registrar({ jogador: nome, texto, item: id.item, pontos: id.item.pos });
    }
    registrar({ jogador: nome, texto, item: null, itemFora: id.itemFora, pontos: cfg.estilo === 'reverso' ? penalidade() : 0 });
  }

  function registrar(c) {
    c.rodada = jogo.rodada;
    jogo.chutes.push(c);
    jogo.placar[c.jogador] += c.pontos;
    jogo.ultimo = c;
    avancar();
  }

  function desfazer() {
    const c = jogo.chutes.pop();
    if (!c) return;
    jogo.placar[c.jogador] -= c.pontos;
    if (jogo.vez === 0) { jogo.rodada--; ordenar(); jogo.vez = jogo.ordem.length - 1; } else jogo.vez--;
    jogo.ultimo = null;
    telaVez();
  }

  function avancar() {
    jogo.vez++;
    const acabouLista = jogo.usados.size >= jogo.itens.length;
    if (acabouLista) return telaFinal(true);
    if (jogo.vez < jogo.ordem.length) return telaVez();
    const bateuMeta = cfg.estilo === 'pontos' && cfg.modo === 'pontos' && Object.values(jogo.placar).some(p => p >= alvo());
    if (bateuMeta || jogo.rodada >= totalRodadas()) return telaFinal(false);
    telaFimRodada();
  }

  function telaFimRodada() {
    const daRodada = jogo.chutes.filter(c => c.rodada === jogo.rodada);
    render(`
      ${cabecalho()}
      <div class="card">
        <span class="label">Rodada ${jogo.rodada}</span>
        ${daRodada.map(c => `
          <div class="result ${classeResultado(c)}">
            <span class="who">${esc(c.jogador)}<br><span class="small muted">${descChute(c)}</span></span>
            <span class="pts">${fmtPts(c.pontos)}</span>
          </div>`).join('')}
      </div>
      <div class="card"><span class="label">Placar${cfg.estilo === 'reverso' ? ' (menos é melhor)' : ''}</span>${miniPlacar()}</div>
      <button class="btn" id="prox">Próxima rodada</button>
    `);
    ligarSair();
    document.getElementById('prox').onclick = () => { jogo.rodada++; jogo.vez = 0; jogo.ultimo = null; ordenar(); telaVez(); };
  }

  // ---------- estilo Duvido ----------
  function avancarPonteiro() {
    do { jogo.vez = (jogo.vez + 1) % jogo.ordem.length; } while (!jogo.vivos.has(jogo.ordem[jogo.vez]));
  }

  function proximaVezDuvido(msg) {
    if (jogo.vivos.size <= 1) return telaFinal(false);
    if (jogo.usados.size >= jogo.itens.length) return telaFinal(true);
    const atual = jogo.ordem[jogo.vez];
    if (!jogo.vivos.has(atual)) { avancarPonteiro(); return proximaVezDuvido(msg); }
    if (jogo.folgas[atual] > 0) return telaFolga(atual, msg);
    telaVezDuvido(atual, msg);
  }

  function chipsVivos() {
    return `<div class="chips" style="justify-content:center;margin:10px 0 4px">${jogo.ordem.map(j => `
      <span class="chip ${jogo.vivos.has(j) ? (j === jogo.ordem[jogo.vez] ? 'on' : '') : 'out'}">${jogo.vivos.has(j) ? '' : '❌ '}${esc(j)}${jogo.folgas[j] ? ' 🛡️' : ''}</span>`).join('')}</div>`;
  }
  const faixa = msg => msg ? `<div class="result ${msg.tipo}" style="margin-bottom:14px"><span class="who">${msg.html}</span></div>` : '';

  function telaFolga(nome, msg) {
    render(`
      ${cabecalho()}
      ${faixa(msg)}
      <div class="pass">
        <div class="emoji">🛡️</div>
        <div class="big-name" style="font-size:2rem">${esc(nome)} está de folga</div>
        <p class="muted">Ganhou essa rodada sem precisar falar.</p>
        ${chipsVivos()}
        <button class="btn" id="ok">Seguir</button>
      </div>
    `);
    ligarSair();
    document.getElementById('ok').onclick = () => { jogo.folgas[nome]--; avancarPonteiro(); proximaVezDuvido(); };
  }

  function telaVezDuvido(nome, msg) {
    render(`
      ${cabecalho()}
      ${faixa(msg)}
      ${cartaoLista()}
      ${chipsVivos()}
      <div class="card">
        <p style="margin:0 0 10px"><strong style="font-size:1.4rem">${esc(nome)}</strong>, fale um item do Top ${jogo.N}:</p>
        <form id="f">
          <input type="text" id="chute" autocomplete="off" autocapitalize="words" placeholder="Digite o nome">
          <button class="btn" type="submit">Falar</button>
        </form>
      </div>
      ${listaChutes(false)}
    `);
    ligarSair();
    const inp = document.getElementById('chute');
    inp.focus();
    document.getElementById('f').onsubmit = e => {
      e.preventDefault();
      const texto = inp.value.trim();
      if (!texto) return;
      const id = identificar(texto);
      if (id.erro) { toast(id.erro); return; }
      telaDuvido(nome, texto, id.item || null, id.itemFora || null);
    };
  }

  function telaDuvido(nome, texto, item, itemFora) {
    const outros = jogo.ordem.filter(j => jogo.vivos.has(j) && j !== nome);
    render(`
      ${cabecalho()}
      <div class="pass" style="padding-top:20px">
        <p class="muted">${esc(nome)} disse</p>
        <div class="big-name" style="font-size:2.2rem">${esc(texto)}</div>
        <p class="muted">Está no Top ${jogo.N}? Alguém duvida?</p>
        <button class="btn secondary" id="passa">👍 Ninguém duvida, passa</button>
        <div class="label" style="margin-top:22px">Quem duvidou?</div>
        ${outros.map(o => `<button class="btn duvido" data-quem="${esc(o)}">✋ ${esc(o)} duvida!</button>`).join('')}
      </div>
    `);
    ligarSair();
    document.getElementById('passa').onclick = () => {
      if (item) jogo.usados.add(item);
      jogo.chutes.push({ jogador: nome, texto, item, itemFora, status: 'passou' });
      avancarPonteiro();
      proximaVezDuvido({ tipo: 'under', html: `${esc(nome)}: <strong>${esc(texto)}</strong> passou sem dúvida.` });
    };
    app.querySelectorAll('[data-quem]').forEach(b => b.onclick = () => {
      const quem = b.dataset.quem;
      if (item) {
        jogo.usados.add(item);
        jogo.chutes.push({ jogador: nome, texto, item, status: 'duvidado-certo' });
        jogo.vivos.delete(quem); jogo.folgas[nome]++;
        jogo.log.push(`${quem} duvidou de ${item.nome} (#${item.pos}, falado por ${nome}) e saiu.`);
        avancarPonteiro();
        telaRevelacao(true, `${item.nome} está no Top ${jogo.N}!`, `É o #${item.pos}${item.info ? ' (' + item.info + ')' : ''}. ${quem} duvidou errado e está fora. ${nome} ganha uma folga 🛡️.`);
      } else {
        jogo.chutes.push({ jogador: nome, texto, item: null, itemFora, status: 'duvidado-errado' });
        jogo.vivos.delete(nome); jogo.folgas[quem]++;
        jogo.log.push(`${nome} falou “${texto}”, ${quem} duvidou e ${nome} saiu.`);
        avancarPonteiro();
        telaRevelacao(false, `${texto} não está no Top ${jogo.N}!`, `${itemFora ? `Está na lista, mas em #${itemFora.pos}. ` : ''}${nome} está fora. ${quem} duvidou certo e ganha uma folga 🛡️.`);
      }
    });
  }

  function telaRevelacao(ok, titulo, sub) {
    render(`
      ${cabecalho()}
      <div class="pass">
        <div class="emoji">${ok ? '✅' : '❌'}</div>
        <div class="big-name" style="font-size:2rem">${esc(titulo)}</div>
        <p class="muted">${esc(sub)}</p>
        ${chipsVivos()}
        <button class="btn" id="ok">Seguir</button>
      </div>
    `);
    ligarSair();
    document.getElementById('ok').onclick = () => proximaVezDuvido();
  }

  // ---------- fim ----------
  function telaFinal(acabouLista) {
    let campeoes, cabecalhoFinal, podio = '', placarHtml = '';
    if (cfg.estilo === 'duvido') {
      campeoes = jogo.ordem.filter(j => jogo.vivos.has(j));
      cabecalhoFinal = (acabouLista ? 'A lista acabou! ' : '') + (campeoes.length > 1 ? 'Sobreviventes' : 'Último em pé');
    } else {
      const rank = ranking();
      const topo = rank[0][1];
      campeoes = rank.filter(r => r[1] === topo).map(r => r[0]);
      cabecalhoFinal = (acabouLista ? 'A lista acabou! ' : '') + (campeoes.length > 1 ? 'Empate! Campeões da vez' : 'Campeão da vez');
      podio = C.htmlPodio(rank);
      const melhor = jogo.chutes.filter(c => c.item).sort((a, b) => cfg.estilo === 'reverso' ? a.pontos - b.pontos : b.pontos - a.pontos)[0];
      placarHtml = `<div class="card"><span class="label">Classificação final${cfg.estilo === 'reverso' ? ' (menos é melhor)' : ''}</span>${miniPlacar()}
        ${melhor ? `<p class="muted small" style="margin:12px 0 0">💎 Melhor chute: <strong>${esc(melhor.jogador)}</strong> com ${esc(melhor.item.nome)} (#${melhor.item.pos})</p>` : ''}</div>`;
    }
    const quem = new Map(jogo.chutes.filter(c => c.item).map(c => [c.item, c.jogador]));
    const blefes = jogo.chutes.filter(c => c.status === 'passou' && !c.item);

    render(`
      <div class="center" style="margin-top:10px">
        <div class="trophy">🏆</div>
        <p class="muted" style="margin:6px 0 0">${cabecalhoFinal}</p>
        <h1 class="logo" style="font-size:2.4rem">${campeoes.map(esc).join(' & ')}</h1>
      </div>
      ${podio}
      ${placarHtml}
      ${jogo.log.length ? `<div class="card"><span class="label">Eliminações</span>${jogo.log.map(l => `<p class="small" style="margin:6px 0">${esc(l)}</p>`).join('')}</div>` : ''}
      ${blefes.length ? `<div class="card"><span class="label">Passaram sem ninguém duvidar, mas não estavam 🤫</span>
        ${blefes.map(b => `<p class="small" style="margin:6px 0"><strong>${esc(b.jogador)}</strong>: ${esc(b.texto)}${b.itemFora ? ` (era o #${b.itemFora.pos})` : ''}</p>`).join('')}</div>` : ''}
      <div class="card">
        <span class="label">O Top ${jogo.N} completo</span>
        <div class="muted small" style="margin-bottom:10px">${esc(jogo.lista.titulo)} · ${esc(jogo.lista.referencia)}</div>
        <ol class="full-list">
          ${jogo.itens.map(it => `<li class="${quem.has(it) ? 'hit' : ''}"><span class="pos">${it.pos}</span><span class="grow">${esc(it.nome)}${it.info ? ` <span class="muted small">${esc(it.info)}</span>` : ''}</span>${quem.has(it) ? `<span class="tag close">${esc(quem.get(it))}</span>` : ''}</li>`).join('')}
        </ol>
      </div>
      <button class="btn" id="denovo">Jogar de novo</button>
      <button class="btn secondary" id="config">Mudar jogadores / lista</button>
      <a class="btn ghost" href="../">Voltar aos jogos</a>
    `);
    document.getElementById('denovo').onclick = () => iniciar((jogo.offset + 1) % cfg.jogadores.length);
    document.getElementById('config').onclick = () => { jogo = null; telaSetup(); };
  }

  telaSetup();
})();
