// Regras de pontuação do No Limite.
// Fica separado para ser reaproveitado no modo com vários celulares.
//
// - Cravou (palpite == resposta): 2 pontos. Se alguém cravou, só quem cravou pontua.
// - Ninguém cravou: quem ficou mais perto SEM passar da resposta ganha 1 ponto.
// - Empate no mais perto: todos os empatados pontuam.
// - Todo mundo estourou: ninguém pontua.
(function (global) {
  function pontuarRodada(resposta, palpites) {
    // palpites: [{ jogador: "Augusto", valor: 205 }, ...]
    // valor null = acabou o tempo sem palpite (não pontua, não conta como mais perto)
    const validos = palpites.filter(p => p.valor != null);
    const cravaram = validos.filter(p => p.valor === resposta);
    const abaixo = validos.filter(p => p.valor < resposta);
    const melhor = abaixo.length ? Math.max(...abaixo.map(p => p.valor)) : null;

    return palpites.map(p => {
      let status, pontos = 0;
      if (p.valor == null) return { jogador: p.jogador, valor: null, status: 'tempo', pontos: 0, distancia: Infinity };
      if (p.valor === resposta) {
        status = 'exact'; pontos = 2;
      } else if (p.valor > resposta) {
        status = 'bust';
      } else if (cravaram.length === 0 && p.valor === melhor) {
        status = 'close'; pontos = 1;
      } else {
        status = 'under';
      }
      return { jogador: p.jogador, valor: p.valor, status, pontos, distancia: Math.abs(resposta - p.valor) };
    });
  }

  // Selo "Donan": palpite muito longe da resposta.
  // Anos: 20 ou mais de diferença. Outros números: metade ou menos, ou o dobro ou mais da resposta.
  function donan(resposta, valor, unidade) {
    if (valor == null) return false;
    if (unidade === 'ano') return Math.abs(valor - resposta) >= 20;
    if (resposta <= 0) return Math.abs(valor - resposta) >= 10;
    if (valor <= 0) return true;
    return valor / resposta >= 2 || resposta / valor >= 2;
  }
  const htmlDonan = '<img class="selo-donan" src="donan.png" alt="Donan" title="Donan" width="40" height="40" style="width:40px;height:40px;border-radius:50%;vertical-align:middle;margin-right:10px">';
  global.NoLimiteRegras = { pontuarRodada, donan, htmlDonan };
})(typeof window !== 'undefined' ? window : globalThis);
