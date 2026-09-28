// Utilidades dos jogos de futebol (banco de jogadores, busca com sugestões, critérios, temas e campinho)
(function (g) {
  const C = g.Comum;
  const esc = C.esc;
  const D = g.CRAQUES;
  const F = {};

  const J = D.jog.map(a => ({
    id: a[0], nome: a[1], en: a[2], ano: a[3], h: a[4], pos: a[5] || '', sel: a[6], selJ: a[7], selG: a[8], fama: a[9],
    car: a[10].map(c => ({ c: c[0], nome: (D.clubes[c[0]] || ['?'])[0], pais: (D.clubes[c[0]] || [])[1] || '', ini: c[1], fim: c[2], j: c[3], g: c[4] }))
  }));
  J.forEach(j => {
    j.clubes = new Set(j.car.map(c => c.c));
    j.paises = new Set(j.car.map(c => c.pais));
    j.nClubes = j.clubes.size;
    j.golsClubes = j.car.some(c => c.g != null) ? j.car.reduce((s, c) => s + (c.g || 0), 0) : null;
    j.k1 = C.norm(j.nome); j.k2 = j.en ? C.norm(j.en) : '';
    j.brasil = j.sel === 'Seleção Brasileira' || j.paises.has('Brasil');
  });
  F.J = J;
  F.porId = Object.fromEntries(J.map(j => [j.id, j]));
  F.nomeClube = id => (D.clubes[id] || ['?'])[0];

  const POSN = { G: 'Goleiro', D: 'Defensor', M: 'Meio-campo', A: 'Atacante' };
  F.POSN = POSN;
  F.descPos = j => j.pos ? j.pos.split('').map(p => POSN[p]).join('/') : 'posição ?';

  // ---------- busca com sugestões ----------
  F.buscar = (texto, n = 8, filtro) => {
    const q = C.norm(texto);
    if (q.length < 2) return [];
    const toks = q.split(' ');
    const ok = j => {
      const words = (j.k1 + ' ' + j.k2).split(' ');
      return toks.every(t => words.some(w => w.startsWith(t)));
    };
    return J.filter(j => (!filtro || filtro(j)) && ok(j)).sort((a, b) => b.fama - a.fama).slice(0, n);
  };

  // HTML de um campo de busca. Depois de renderizar, chame F.ligarBusca(idBase, onEscolha)
  F.htmlBusca = (idBase, placeholder) => `
    <div class="busca">
      <input type="text" id="${idBase}" autocomplete="off" autocapitalize="words" placeholder="${esc(placeholder || 'Digite o nome do jogador')}">
      <div class="sugs" id="${idBase}-sugs"></div>
      <div class="escolhido hidden" id="${idBase}-esc"></div>
    </div>`;

  F.ligarBusca = (idBase, onEscolha, filtro) => {
    const inp = document.getElementById(idBase), box = document.getElementById(idBase + '-sugs'), esc_ = document.getElementById(idBase + '-esc');
    if (!inp) return;
    let atual = null;
    const mostrar = () => {
      const lista = F.buscar(inp.value, 8, filtro);
      box.innerHTML = lista.map(j => `<button type="button" class="sug" data-id="${j.id}"><strong>${esc(j.nome)}</strong><span class="muted small">${esc(F.descPos(j))}${j.ano ? ' · ' + j.ano : ''}</span></button>`).join('')
        || (C.norm(inp.value).length >= 2 ? '<div class="muted small" style="padding:8px 4px">Nenhum jogador com esse nome no banco.</div>' : '');
      box.querySelectorAll('.sug').forEach(b => b.onclick = () => escolher(F.porId[b.dataset.id]));
    };
    const escolher = j => {
      atual = j;
      inp.value = j.nome; box.innerHTML = '';
      esc_.innerHTML = `✔ <strong>${esc(j.nome)}</strong> <span class="muted small">${esc(F.descPos(j))}${j.ano ? ' · ' + j.ano : ''}</span>`;
      esc_.classList.remove('hidden');
      onEscolha(j);
    };
    inp.oninput = () => { if (atual) { atual = null; esc_.classList.add('hidden'); onEscolha(null); } mostrar(); };
    inp.focus();
  };

  // ---------- Monta o Time: critérios e temas ----------
  const m = v => (v / 100).toFixed(2).replace('.', ',') + ' m';
  F.CRITERIOS = [
    { id: 'alto', nome: 'Time mais alto', curto: 'Altura', desc: 'Soma das alturas. Maior soma vence.', val: j => j.h, fmt: m, maior: true },
    { id: 'baixo', nome: 'Time mais baixo', curto: 'Altura', desc: 'Soma das alturas. MENOR soma vence. Escolha errada vale 2,00 m.', val: j => j.h, fmt: m, maior: false, penal: 200 },
    { id: 'golsSel', nome: 'Mais gols pela seleção', curto: 'Gols pela seleção', desc: 'Soma dos gols pela seleção principal.', val: j => j.sel ? (j.selG || 0) : 0, fmt: v => C.plural(v, 'gol', 'gols'), maior: true },
    { id: 'jogosSel', nome: 'Mais jogos pela seleção', curto: 'Jogos pela seleção', desc: 'Soma dos jogos pela seleção principal.', val: j => j.sel ? (j.selJ || 0) : 0, fmt: v => C.plural(v, 'jogo', 'jogos'), maior: true },
    { id: 'golsClubes', nome: 'Mais gols por clubes', curto: 'Gols por clubes', desc: 'Soma dos gols por clubes na carreira (sem seleção).', val: j => j.golsClubes, fmt: v => C.plural(v, 'gol', 'gols'), maior: true },
    { id: 'clubes', nome: 'Mais rodados', curto: 'Clubes na carreira', desc: 'Soma de quantos clubes cada um defendeu.', val: j => j.nClubes, fmt: v => C.plural(v, 'clube', 'clubes'), maior: true },
    { id: 'velho', nome: 'Time mais velho', curto: 'Ano de nascimento', desc: 'Soma dos anos de nascimento. MENOR soma (mais velhos) vence. Escolha errada vale 2010.', val: j => j.ano, fmt: v => String(v), maior: false, penal: 2010 }
  ];
  F.criterio = id => F.CRITERIOS.find(c => c.id === id);

  const SELECOES = ['Seleção Brasileira', 'Seleção Argentina', 'Seleção Francesa', 'Seleção Alemã', 'Seleção Espanhola', 'Seleção Italiana', 'Seleção Inglesa', 'Seleção Portuguesa', 'Seleção Neerlandesa', 'Seleção Uruguaia', 'Seleção Croata', 'Seleção Belga'];
  const PAISES = [['Itália', 'clube italiano'], ['Espanha', 'clube espanhol'], ['Reino Unido', 'clube inglês/britânico'], ['Alemanha', 'clube alemão'], ['França', 'clube francês'], ['Brasil', 'clube brasileiro'], ['Portugal', 'clube português'], ['Argentina', 'clube argentino'], ['Países Baixos', 'clube holandês'], ['Turquia', 'clube turco'], ['Arábia Saudita', 'clube saudita'], ['Estados Unidos', 'clube dos EUA']];
  const contagemClubes = {};
  J.forEach(j => j.clubes.forEach(c => contagemClubes[c] = (contagemClubes[c] || 0) + 1));
  const PEQUENOS = new Set(['Juventus-SP', 'Santo André', 'Paulista', 'Ituano', 'Marília', 'Botafogo-SP', 'São Caetano', 'Portuguesa', 'Figueirense', 'Avaí', 'Criciúma', 'Paraná', 'Guarani', 'Ponte Preta', 'Santa Cruz', 'Juventude', 'Náutico', 'Queens Park Rangers', 'Stoke City', 'Sunderland', 'West Bromwich Albion', 'Real Zaragoza']);
  const CLUBES_TOP = Object.entries(contagemClubes).filter(([c, n]) => n >= 28 && (D.clubes[c] || [])[1] !== 'Japão' && !PEQUENOS.has(F.nomeClube(c))).map(([c]) => +c);

  F.TEMAS = [
    ...SELECOES.map(s => ({ id: 'sel:' + s, grupo: 'Seleções', nome: s.replace('Seleção', 'Jogou pela Seleção'), test: j => j.sel === s })),
    ...CLUBES_TOP.map(c => ({ id: 'clube:' + c, grupo: 'Clubes', nome: 'Passou pelo clube: ' + F.nomeClube(c), test: j => j.clubes.has(c) })),
    ...PAISES.map(([p, d]) => ({ id: 'pais:' + p, grupo: 'Países', nome: 'Jogou em ' + d, test: j => j.paises.has(p) })),
    ...[1960, 1970, 1980, 1990, 2000].map(d => ({ id: 'dec:' + d, grupo: 'Gerações', nome: `Nasceu nos anos ${String(d).slice(2)}`, test: j => j.ano >= d && j.ano < d + 10 }))
  ];
  F.GRUPOS_TEMA = ['Seleções', 'Clubes', 'Países', 'Gerações'];

  F.SLOTS = [{ k: 'A1', g: 'A' }, { k: 'A2', g: 'A' }, { k: 'M1', g: 'M' }, { k: 'M2', g: 'M' }, { k: 'D1', g: 'D' }, { k: 'D2', g: 'D' }, { k: 'G', g: 'G' }];
  const ADJ = { D: ['D', 'M'], M: ['D', 'M', 'A'], A: ['M', 'A'] };
  // goleiro só no gol; na linha, aceita a posição e as vizinhas (o banco às vezes marca atacante como meia etc.)
  F.encaixa = (j, g) => g === 'G' ? j.pos.includes('G') : [...j.pos].some(p => ADJ[g].includes(p));

  F.temaValido = (t, crit) => ['G', 'D', 'M', 'A'].every(gp => J.filter(j => t.test(j) && j.pos.includes(gp) && crit.val(j) != null).length >= 3);

  // pontuação de uma escolha
  F.pontuar = (j, tema, crit) => {
    const v = crit.val(j);
    const ok = tema.test(j) && v != null;
    return { ok, v: ok ? v : (crit.maior ? 0 : crit.penal), motivo: !tema.test(j) ? 'não é do tema' : v == null ? 'sem dado no banco' : '' };
  };

  // campinho: slots = { A1: {nome, v, ok}, ... }
  F.htmlCampo = (slots, crit, titulo) => {
    const cel = k => {
      const s = slots[k];
      return `<div class="slot ${s ? (s.ok ? 'ok' : 'bad') : ''}"><div class="slot-pos">${k[0] === 'G' ? 'GOL' : k[0] === 'D' ? 'DEF' : k[0] === 'M' ? 'MEI' : 'ATA'}</div>
        ${s ? `<div class="slot-nome">${esc(s.nome)}</div><div class="slot-val">${crit ? esc(crit.fmt(s.v)) : ''}</div>` : '<div class="slot-vazio">—</div>'}</div>`;
    };
    return `<div class="campo">${titulo ? `<div class="campo-tit">${titulo}</div>` : ''}
      <div class="linha">${cel('A1')}${cel('A2')}</div>
      <div class="linha">${cel('M1')}${cel('M2')}</div>
      <div class="linha">${cel('D1')}${cel('D2')}</div>
      <div class="linha">${cel('G')}</div></div>`;
  };
  F.total = slots => Object.values(slots).reduce((s, x) => s + (x ? x.v : 0), 0);

  // ---------- Carreira ----------
  F.anos = c => c.ini ? (c.fim && c.fim !== c.ini ? `${c.ini}–${c.fim}` : c.fim === c.ini ? `${c.ini}` : `${c.ini}–`) : '';
  F.POOLS = {
    famosos: { nome: 'Famosos do mundo todo', test: j => j.fama >= 60 },
    brasil: { nome: 'Com passagem pelo futebol brasileiro', test: j => j.brasil && j.fama >= 30 },
    todos: { nome: 'Todos do banco (mais difícil)', test: j => j.fama >= 25 }
  };
  F.poolCarreira = (pool, minClubes) => J.filter(j => F.POOLS[pool].test(j) && j.car.length >= (minClubes || 4) && j.car.length <= 12 && [...j.paises].some(p => p !== 'Japão'));

  g.Futebol = F;
})(window);
