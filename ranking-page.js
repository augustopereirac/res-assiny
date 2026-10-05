// Página do ranking geral: % de vitórias por jogador, filtrável por jogo.
(function () {
  const C = window.Comum, R = window.Ranking, { esc } = C;
  const app = document.getElementById('app');
  let partidas = null, erro = false, jogo = '', minimo = C.store.get('rk:min', 1), aba = 'ranking';
  const pct = x => Math.round(x * 100) + '%';
  const data = s => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  function desenhar() {
    const topo = `<div class="topbar"><a class="link-back" href="index.html">← Jogos</a></div>
      <div class="center" style="margin-bottom:14px"><div class="logo">Ranking</div>
      <p class="muted" style="margin:4px 0 0">Porcentagem de vitórias nas partidas registradas.<br>Empate no 1º lugar conta vitória para todos os empatados.</p></div>`;
    if (!partidas) return app.innerHTML = topo + `<div class="pass"><div class="emoji">${erro ? '⚠️' : '⏳'}</div><p class="muted">${erro ? 'Não consegui carregar o ranking. Confira a internet e tente de novo.' : 'Carregando…'}</p>${erro ? '<button class="btn" id="tentar">Tentar de novo</button>' : ''}</div>`, ligar();
    const lista = R.calcular(partidas, jogo).filter(x => x.j >= minimo);
    const doJogo = partidas.filter(p => !jogo || p.jogo.replace('-sala', '') === jogo);
    app.innerHTML = topo + `
      <div class="chips" style="margin-bottom:10px"><button class="chip ${aba === 'ranking' ? 'on' : ''}" data-aba="ranking">🏆 Ranking</button><button class="chip ${aba === 'hist' ? 'on' : ''}" data-aba="hist">📜 Partidas</button><button class="chip ${aba === 'cad' ? 'on' : ''}" data-aba="cad">👥 Cadastrados</button></div>
      ${aba !== 'cad' ? `<div class="card"><span class="label">Jogo</span><div class="chips"><button class="chip ${!jogo ? 'on' : ''}" data-jogo="">Todos</button>${Object.entries(R.JOGOS).map(([k, n]) => `<button class="chip ${jogo === k ? 'on' : ''}" data-jogo="${k}">${esc(n)}</button>`).join('')}</div>
        ${aba === 'ranking' ? `<span class="label" style="margin-top:12px">Mínimo de partidas</span><div class="chips">${[1, 3, 5, 10, 20].map(n => `<button class="chip ${minimo === n ? 'on' : ''}" data-min="${n}">${n}</button>`).join('')}</div>` : ''}</div>` : ''}
      ${aba === 'ranking' ? (lista.length ? `<div class="card"><table class="score rank"><tr><th>#</th><th>Jogador</th><th>V/P</th><th>%</th></tr>
          ${lista.map((x, i) => `<tr><td>${i + 1}${i === 0 ? ' 🥇' : i === 1 ? ' 🥈' : i === 2 ? ' 🥉' : ''}</td><td>${esc(x.nome)} <button type="button" class="x-rem" data-rem="${esc(x.nome)}" title="Remover do ranking">✕</button></td><td>${x.v}/${x.j}</td><td><strong>${pct(x.pct)}</strong></td></tr>`).join('')}</table>
          <p class="muted small" style="margin:10px 0 0">${C.plural(doJogo.length, 'partida registrada', 'partidas registradas')}.</p></div>`
        : '<p class="muted center">Nenhuma partida registrada ainda. O resultado entra sozinho quando uma partida termina (com 2 ou mais jogadores).</p>') : ''}
      ${aba === 'hist' ? `<div class="card">${doJogo.slice(0, 200).map(p => `<p class="small" style="margin:6px 0"><span class="muted">${data(p.criado)} · ${esc(R.JOGOS[p.jogo.replace('-sala', '')] || p.jogo)}${p.jogo.endsWith('-sala') ? ' 📲' : ''}</span><br>🏆 <strong>${p.vencedores.map(esc).join(', ')}</strong> <span class="muted">· ${p.participantes.filter(n => !p.vencedores.includes(n)).map(esc).join(', ')}</span></p>`).join('') || '<p class="muted">Nenhuma partida.</p>'}</div>` : ''}
      ${aba === 'cad' ? `<div class="card"><span class="label">Jogadores cadastrados</span><div class="chips">${R.cadastrados().map(n => `<span class="chip">${esc(n)} <button type="button" class="x-rem" data-rem="${esc(n)}" title="Remover">✕</button></span>`).join('') || '<span class="muted small">Ninguém ainda.</span>'}</div>
        <form id="cadForm" class="row" style="margin-top:12px"><input class="grow" type="text" id="cadNome" placeholder="Nome (ex.: Gui)" maxlength="20" autocomplete="off"><button class="btn small" type="submit">Cadastrar</button></form>
        <p class="muted small" style="margin:10px 0 0">Quem é cadastrado aparece para tocar e entrar direto na lista de jogadores de qualquer jogo. Quem entra numa partida pelo nome também fica cadastrado. Toque no ✕ para remover alguém do cadastro e do ranking.</p></div>` : ''}
      <button class="btn ghost" id="recarregar">↻ Atualizar</button>`;
    ligar();
  }
  function ligar() {
    const t = document.getElementById('tentar'); if (t) t.onclick = carregar;
    const r = document.getElementById('recarregar'); if (r) r.onclick = carregar;
    app.querySelectorAll('[data-jogo]').forEach(b => b.onclick = () => { jogo = b.dataset.jogo; desenhar(); });
    app.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { minimo = +b.dataset.min; C.store.set('rk:min', minimo); desenhar(); });
    app.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; desenhar(); });
    const f = document.getElementById('cadForm');
    if (f) f.onsubmit = e => { e.preventDefault(); const n = document.getElementById('cadNome').value.trim(); if (!n) return; R.cadastrar(n, true); C.toast(n + ' cadastrado!'); desenhar(); };
    app.querySelectorAll('[data-rem]').forEach(b => b.onclick = () => { const n = b.dataset.rem; if (!confirm(`Remover ${n} do ranking e dos cadastrados? As partidas dos outros continuam contando.`)) return; R.remover(n).then(() => C.toast(n + ' removido.')).catch(() => C.toast('Não consegui remover agora. Tente de novo.')); desenhar(); });
  }
  function carregar() {
    partidas = null; erro = false; desenhar();
    Promise.all([R.partidas(), R.atualizar(true)]).then(([p]) => { partidas = p; desenhar(); }).catch(() => { erro = true; desenhar(); });
  }
  carregar();
})();
