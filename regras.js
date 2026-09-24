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
    const cravaram = palpites.filter(p => p.valor === resposta);
    const abaixo = palpites.filter(p => p.valor < resposta);
    const melhor = abaixo.length ? Math.max(...abaixo.map(p => p.valor)) : null;

    return palpites.map(p => {
      let status, pontos = 0;
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

  global.NoLimiteRegras = { pontuarRodada };
})(typeof window !== 'undefined' ? window : globalThis);
