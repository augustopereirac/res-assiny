// Utilidades compartilhadas entre os jogos
(function (global) {
  const C = {};

  // ---------- armazenamento local (opcional) ----------
  C.store = {
    get(k, def) { try { const v = localStorage.getItem('noite:' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('noite:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  C.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  C.rolarAte = el => { if (!el) return; const r = el.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, window.scrollY + r.bottom - window.innerHeight + 24), behavior: 'smooth' }); };
  C.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  C.toast = msg => {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  };
  C.plural = (n, s, p) => n + ' ' + (n === 1 ? s : (p || s + 's'));

  // ---------- texto ----------
  C.norm = s => String(s || '')
    .replace(/♀/g, ' femea').replace(/♂/g, ' macho').replace(/['’`´]/g, '')
    .replace(/ß/g, 'ss').replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd').replace(/æ/g, 'ae').replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/œ/g, 'oe').replace(/þ/g, 'th')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  C.lev = (a, b) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 3) return 99;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  };

  const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'the', 'and', 'van', 'von', 'der', 'den', 'del', 'la', 'le', 'los', 'las', 'di', 'uma', 'para', 'com']);
  const tolerancia = len => len <= 4 ? 0 : len <= 7 ? 1 : 2;

  // Cria um "reconhecedor" de nomes para uma lista de itens {nome, alias}.
  // Reconhece: nome, apelidos, sobrenome/palavra única, e tolera erros pequenos de digitação.
  // Retorna { item } quando acha um só, { ambiguos: [...] } quando bate em mais de um, ou null.
  C.criarMatcher = (itens) => {
    const fortes = []; // [chave, item]
    const palavras = new Map(); // palavra -> Set(item)
    itens.forEach(it => {
      const nomes = [it.nome, ...(it.alias || [])];
      nomes.forEach(n => {
        const k = C.norm(n);
        if (k) fortes.push([k, it]);
        const ws = k.split(' ');
        const extras = ws.length >= 2 ? [ws.slice(1).join(' ')] : []; // ex.: "van der sar", "de jong"
        ws.concat(extras).forEach(w => {
          if (w.length >= 3 && !STOP.has(w)) {
            if (!palavras.has(w)) palavras.set(w, new Set());
            palavras.get(w).add(it);
          }
        });
      });
    });
    const unicas = [...palavras].filter(([, s]) => s.size === 1).map(([w, s]) => [w, [...s][0]]);
    const ambiguas = new Map([...palavras].filter(([, s]) => s.size > 1));

    function resolver(cands) {
      const u = [...new Set(cands)];
      if (u.length === 1) return { item: u[0] };
      if (u.length > 1) return { ambiguos: u };
      return null;
    }

    return function match(texto) {
      const n = C.norm(texto);
      if (!n) return null;
      const numerico = /^\d+$/.test(n);
      // 1) igual a nome/apelido
      let r = resolver(fortes.filter(([k]) => k === n).map(([, it]) => it));
      if (r) return r;
      if (numerico) return null;
      // 2) palavra única (ex.: sobrenome)
      r = resolver(unicas.filter(([w]) => w === n).map(([, it]) => it));
      if (r) return r;
      if (ambiguas.has(n)) return { ambiguos: [...ambiguas.get(n)] };
      // 3) tolerância a erro de digitação
      const tol = tolerancia(n.length);
      if (tol === 0) return null;
      let melhor = 99, cands = [];
      [...fortes, ...unicas].forEach(([k, it]) => {
        if (/^\d+$/.test(k)) return;
        const d = C.lev(n, k);
        if (d <= tolerancia(k.length) && d <= tol) {
          if (d < melhor) { melhor = d; cands = [it]; } else if (d === melhor) cands.push(it);
        }
      });
      return resolver(cands);
    };
  };

  // ---------- editor de jogadores (compartilhado) ----------
  C.carregarJogadores = () => {
    let j = C.store.get('jogadores', null);
    if (!j) { try { j = JSON.parse(localStorage.getItem('nolimite:jogadores') || '[]'); } catch (e) { j = []; } }
    return Array.isArray(j) ? j : [];
  };

  // Retorna o HTML do cartão de jogadores. Depois de renderizar, chame ligarEditorJogadores.
  C.htmlEditorJogadores = (jogadores) => `
    <div class="card">
      <span class="label">Jogadores (ordem da vez)</span>
      ${jogadores.map((n, i) => `
        <div class="player-item">
          <span class="num">${i + 1}</span>
          <span class="name">${C.esc(n)}</span>
          <button class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
          <button class="icon-btn" data-down="${i}" ${i === jogadores.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
          <button class="icon-btn" data-del="${i}" aria-label="Remover">✕</button>
        </div>`).join('') || '<p class="muted small" style="margin-top:0">Adicione pelo menos 2 jogadores.</p>'}
      <form id="addForm" class="row" style="margin-top:8px">
        <input class="grow" type="text" id="novoNome" placeholder="Nome do jogador" maxlength="20" autocomplete="off">
        <button class="btn small" type="submit">Adicionar</button>
      </form>
      <div id="cadChips">${global.Ranking ? global.Ranking.htmlChips(jogadores, 'data-cad') : ''}</div>
      ${global.Ranking ? `<div style="margin-top:12px">${global.Ranking.htmlTreino()}</div>` : ''}
    </div>`;

  C.ligarEditorJogadores = (root, jogadores, aoMudar) => {
    const salvar = (focar) => { C.store.set('jogadores', jogadores); aoMudar(); if (focar) { const i = document.getElementById('novoNome'); if (i) i.focus(); } };
    root.querySelector('#addForm').onsubmit = e => {
      e.preventDefault();
      const inp = root.querySelector('#novoNome');
      let nome = inp.value.trim();
      if (!nome) return;
      if (global.Ranking) { nome = global.Ranking.canonico(nome); global.Ranking.cadastrar(nome); }
      if (jogadores.some(j => j.toLowerCase() === nome.toLowerCase())) { C.toast('Esse nome já está na lista.'); return; }
      jogadores.push(nome); salvar(true);
    };
    if (global.Ranking) global.Ranking.ligarTreino(aoMudar);
    const ligarChips = () => root.querySelectorAll('[data-cad]').forEach(b => b.onclick = () => { const n = b.dataset.cad; if (!jogadores.some(j => j.toLowerCase() === n.toLowerCase())) { jogadores.push(n); salvar(); } });
    ligarChips();
    if (global.Ranking) global.Ranking.atualizar().then(() => { const box = root.querySelector('#cadChips'); if (box) { box.innerHTML = global.Ranking.htmlChips(jogadores, 'data-cad'); ligarChips(); } });
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { jogadores.splice(+b.dataset.del, 1); salvar(); });
    root.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [jogadores[i - 1], jogadores[i]] = [jogadores[i], jogadores[i - 1]]; salvar(); });
    root.querySelectorAll('[data-down]').forEach(b => b.onclick = () => { const i = +b.dataset.down; [jogadores[i + 1], jogadores[i]] = [jogadores[i], jogadores[i + 1]]; salvar(); });
  };

  // Classificação com desempate. lista: [{nome, pts, tb: [números, maior = melhor]}], rotulos: texto de cada critério.
  // Devolve { rank: [[nome, pts]], camp: [nomes], motivo: texto ou null }
  C.classificar = (lista, rotulos, menorMelhor) => {
    const cmpTb = (a, b) => { for (let i = 0; i < Math.max(a.tb.length, b.tb.length); i++) { const d = (b.tb[i] || 0) - (a.tb[i] || 0); if (d) return d; } return 0; };
    const l = lista.slice().sort((a, b) => (menorMelhor ? a.pts - b.pts : b.pts - a.pts) || cmpTb(a, b));
    if (!l.length) return { rank: [], ordem: [], camp: [], motivo: null };
    let vivos = l.filter(x => x.pts === l[0].pts), motivo = null;
    if (vivos.length > 1) {
      const nomes = vivos.map(x => x.nome);
      const lista2 = n => n.length > 1 ? n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1] : n[0];
      const passos = [];
      for (let i = 0; i < rotulos.length && vivos.length > 1; i++) {
        const top = Math.max(...vivos.map(x => x.tb[i] || 0));
        const fica = vivos.filter(x => (x.tb[i] || 0) === top);
        if (fica.length < vivos.length) {
          const seg = Math.max(...vivos.filter(x => (x.tb[i] || 0) !== top).map(x => x.tb[i] || 0));
          passos.push(`${lista2(fica.map(x => x.nome))} ${fica.length > 1 ? 'ficaram na frente' : 'venceu'} por ${rotulos[i]} (${Math.abs(top)} x ${Math.abs(seg)})`);
          vivos = fica;
        }
      }
      if (passos.length) motivo = `Desempate (${lista2(nomes)} empataram nos pontos): ${passos.join('; ')}.`;
      if (vivos.length > 1) motivo = (motivo ? motivo + ' ' : '') + `${lista2(vivos.map(x => x.nome))} empataram também nos critérios de desempate (${rotulos.join(', ')}).`;
    }
    return { rank: l.map(x => [x.nome, x.pts]), ordem: l, camp: vivos.map(x => x.nome), motivo };
  };
  C.htmlDesempate = m => m ? `<p class="muted small center" style="margin:-4px 0 12px">⚖️ ${C.esc(m)}</p>` : '';

  // Pódio + tabela final a partir de [[nome, pontos], ...] ordenado
  C.htmlPodio = (rank, unidade) => {
    const pod = rank.slice(0, 3);
    return `<div class="podium">
      ${[1, 0, 2].filter(i => pod[i]).map(i => `
        <div class="step p${i + 1}">
          <div class="pname">${C.esc(pod[i][0])}</div>
          <div class="ppts">${C.plural(pod[i][1], unidade || 'pt')}</div>
          <div class="block">${i + 1}º</div>
        </div>`).join('')}
    </div>`;
  };

    // Enter aciona o botão principal da tela quando só há uma opção (fora de campos de texto)
  if (global.document) document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.repeat || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.closest && t.closest('input, textarea, select, [contenteditable="true"], button, a'))) return;
    const vis = el => !el.disabled && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    const btns = [...document.querySelectorAll('#app .btn, .btn')].filter((el, i, a) => a.indexOf(el) === i && vis(el));
    if (!btns.length) return;
    let alvo = btns.length === 1 ? btns[0] : null;
    if (!alvo) { const prim = btns.filter(b => !/\b(ghost|secondary|duvido)\b/.test(b.className)); if (prim.length === 1) alvo = prim[0]; }
    if (!alvo) return;
    e.preventDefault(); alvo.click();
  });
  global.Comum = C;
})(window);
