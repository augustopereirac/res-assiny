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
  // clubes dos temas: lista fixa (os elencos desses clubes foram baixados por completo no banco)
  const CLUBES_TEMA = [631, 704, 1422, 1457, 1543, 1886, 2052, 2074, 2609, 2641, 2693, 2739, 2768, 2798, 4512, 5794, 7156, 8682, 8701, 8723, 8749, 8760, 8780, 9616, 9617, 10315, 10329, 10333, 11938, 12297, 15789, 15799, 17479, 18656, 18708, 18711, 18716, 18732, 18741, 18747, 19467, 19481, 19509, 19516, 19593, 19628, 29108, 29112, 32494, 35933, 38245, 38568, 41420, 50602, 51974, 51976, 75729, 80845, 80955, 80958, 80964, 80987, 81888, 101859, 101959, 102720, 104761, 128446, 131499, 132885, 134241, 172476, 172567, 172803, 172969, 180305, 188277, 198032, 219098, 221695, 270995, 274465, 338285, 478317, 483020, 495299, 506832, 541744, 816779, 1052219, 1130849, 5014111, 6601875, 170703, 188841, 482764, 73965, 16844931, 309480, 1128631, 19490, 19453, 185163, 702455, 8687, 499616, 1007597, 276533, 214978, 2622870];
  const CLUBES_TOP = CLUBES_TEMA.filter(c => D.clubes[c] && (contagemClubes[c] || 0) >= 25 && !PEQUENOS.has(F.nomeClube(c)));

  // clubes conhecidos da galera; os outros ficam no grupo "Mais clubes"
  const CLUBES_GRANDES = new Set([17479, 35933, 38568, 80964, 80955, 221695, 80845, 270995, 188277, 80987, 80958, 5014111, 198032, 506832, 188841, 219098, 274465, 541744,
    8682, 7156, 8701, 10329, 10333, 18656, 50602, 1130849, 9616, 9617, 18741, 1422, 1543, 631, 2739, 2641, 2609, 15789, 41420, 104761, 483020, 132885, 704, 180305,
    128446, 131499, 75729, 81888, 495299, 6601875, 170703, 15799, 482764, 73965, 16844931]);
  F.TEMAS = [
    ...SELECOES.map(s => ({ id: 'sel:' + s, grupo: 'Seleções', nome: s.replace('Seleção', 'Jogou pela Seleção'), nao: 'nunca jogou pela ' + s, test: j => j.sel === s })),
    ...CLUBES_TOP.map(c => ({ id: 'clube:' + c, grupo: CLUBES_GRANDES.has(c) ? 'Clubes' : 'Mais clubes', nome: 'Passou pelo clube: ' + F.nomeClube(c), nao: 'nunca jogou no ' + F.nomeClube(c), test: j => j.clubes.has(c) })),
    ...PAISES.map(([p, d]) => ({ id: 'pais:' + p, grupo: 'Países', nome: 'Jogou em ' + d, nao: 'nunca jogou em ' + d, test: j => j.paises.has(p) })),
    ...[1960, 1970, 1980, 1990, 2000].map(d => ({ id: 'dec:' + d, grupo: 'Gerações', nome: `Nasceu nos anos ${String(d).slice(2)}`, nao: `não nasceu nos anos ${String(d).slice(2)}`, test: j => j.ano >= d && j.ano < d + 10 }))
  ];
  F.GRUPOS_TEMA = ['Seleções', 'Clubes', 'Mais clubes', 'Países', 'Gerações'];
  F.GRUPOS_PADRAO = ['Seleções', 'Clubes', 'Países', 'Gerações']; // "Mais clubes" (menos conhecidos) começa desligado

  F.SLOTS = [{ k: 'A1', g: 'A' }, { k: 'A2', g: 'A' }, { k: 'M1', g: 'M' }, { k: 'M2', g: 'M' }, { k: 'D1', g: 'D' }, { k: 'D2', g: 'D' }, { k: 'G', g: 'G' }];
  const ADJ = { D: ['D', 'M'], M: ['D', 'M', 'A'], A: ['M', 'A'] };
  // goleiro só no gol; na linha, aceita a posição e as vizinhas (o banco às vezes marca atacante como meia etc.)
  F.encaixa = (j, g) => g === 'G' ? j.pos.includes('G') : [...j.pos].some(p => ADJ[g].includes(p));

  F.temaValido = (t, crit) => ['G', 'D', 'M', 'A'].every(gp => J.filter(j => t.test(j) && j.pos.includes(gp) && crit.val(j) != null).length >= 3);

  // escolha inválida (fora do tema ou sem dado): devolve a mensagem para pedir outro jogador
  F.motivoInvalido = (j, tema, crit) => !tema.test(j) ? `${j.nome} ${tema.nao}. Escolha outro jogador.`
    : crit.val(j) == null ? `Não temos o dado "${crit.curto}" de ${j.nome}. Escolha outro jogador.` : null;

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
  // histórico de chutes agrupado por clube revelado. chutes: [{quem, passo, ok, passou, nome, meu}]
  F.htmlHistChutes = (chutes, nomeQuem, titulo) => {
    const porPasso = {};
    chutes.forEach(c => (porPasso[c.passo] = porPasso[c.passo] || []).push(c));
    const passos = Object.keys(porPasso).map(Number).sort((a, b) => a - b);
    if (!passos.length) return '';
    return `<div class="card"><span class="label">${titulo || 'Jogadores já chutados'}</span>${passos.map(k => `<p class="small" style="margin:6px 0"><span class="muted">Clube ${k}:</span> ${porPasso[k].map(c =>
      `${C.esc(nomeQuem(c.quem))} ${c.ok ? '✅' + (c.nome ? ' ' + C.esc(c.nome) : ' acertou') : c.passou ? '<span class="muted">passou</span>' : '❌ <strong>' + C.esc(c.nome) + '</strong>'}${c.meu ? ' <span class="muted">(só você vê)</span>' : ''}`).join(' · ')}</p>`).join('')}</div>`;
  };

  F.anos = c => c.ini ? (c.fim && c.fim !== c.ini ? `${c.ini}–${c.fim}` : c.fim === c.ini ? `${c.ini}` : `${c.ini}–`) : '';
  F.POOLS = {
    famosos: { nome: 'Famosos do mundo todo', test: j => j.fama >= 60 },
    brasil: { nome: 'Com passagem pelo futebol brasileiro', test: j => j.brasil && j.fama >= 30 },
    todos: { nome: 'Todos do banco (mais difícil)', test: j => j.fama >= 25 }
  };
  F.poolCarreira = (pool, minClubes) => J.filter(j => F.POOLS[pool].test(j) && j.car.length >= (minClubes || 4) && j.car.length <= 12 && [...j.paises].some(p => p !== 'Japão'));

  g.Futebol = F;
})(window);
