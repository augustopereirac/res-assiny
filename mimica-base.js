// Mímica — regras e sorteios usados no modo um celular e no modo vários celulares.
// Duplas: um faz a mímica, o outro adivinha. Cada pessoa faz mímica uma vez (rodada de 1:30 com 3 nomes).
// Número ímpar de pessoas: um time fica com 3 (cada um faz mímica uma vez para os outros dois).
(function (global) {
  const C = global.Comum;
  const M = {};
  M.TEMPO = 90000;
  M.POR_RODADA = 3;
  M.TEMAS = { futebol: '⚽ Futebol', geral: '🎲 Geral', misto: '🔀 Misturado' };

  const limpa = n => String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  // os jogadores mais conhecidos do banco (por fama)
  const CRAQUES_TOP = ["Lionel Messi","Cristiano Ronaldo","Pelé","Diego Maradona","Neymar","Zinédine Zidane","David Beckham","Kylian Mbappé","Johan Cruijff","Francesco Totti","Ronaldo Nazário","Zlatan Ibrahimović","Franz Beckenbauer","Luis Suárez","Ronaldinho Gaúcho","Gianluigi Buffon","Luka Modrić","José Mourinho","Karim Benzema","Andrés Iniesta","Mesut Özil","Robert Lewandowski","Michel Platini","Frank Lampard","Mohamed Salah","Thierry Henry","Miroslav Klose","Wayne Rooney","Iker Casillas","Antoine Griezmann","Kaká","Manuel Neuer","Erling Haaland","Robin van Persie","Xavi","Steven Gerrard","Harry Kane","Josep Guardiola","Eusébio","Thomas Müller","George Weah","Gareth Bale","Arjen Robben","Paul Pogba","Eden Hazard","Gerard Piqué","Kevin De Bruyne","Fernando Torres","Didier Drogba","Roberto Baggio","Sadio Mané","Samuel Eto'o","Gerd Müller","Sergio Agüero","Lukas Podolski","James Rodríguez","Sergio Ramos","Olivier Giroud","Franck Ribéry","Gary Lineker","Mario Balotelli","Romelu Lukaku","Marco van Basten","Thibaut Courtois","Carlo Ancelotti","George Best","Andriy Shevchenko","Diego Forlán","Ousmane Dembélé","Alessandro Del Piero","Ryan Giggs","Philipp Lahm","Jürgen Klopp","Marcus Rashford","Hugo Lloris","Cesc Fàbregas","Andrea Pirlo","David Villa","Toni Kroos","Edinson Cavani","Xabi Alonso","Ángel di María","Lothar Matthäus","Daniel Alves","Roberto Carlos","Raúl González","Fabio Cannavaro","Joao Grimaldo","Bobby Charlton","Sergio Busquets","Oliver Kahn","Vinícius Júnior","Percy Liza","Joachim Löw","Michael Ballack","Ivan Rakitić","David de Gea","Paolo Maldini","Éric Cantona","Romário","Jordi Alba","Luís Figo","Carles Puyol","John Terry","Michael Owen","Paulo Dybala","Rivaldo","Casemiro","Garrincha","Jérôme Boateng","Hernán Crespo","Raphaël Varane","Didier Deschamps","Riyad Mahrez","Jude Bellingham","Jürgen Klinsmann","Robinho","Wesley Sneijder","Marco Reus","Nemanja Vidić","Dennis Bergkamp","Jordan Henderson","Son Heung-min","Edwin van der Sar","Louis van Gaal","Bastian Schweinsteiger","Carlos Tévez","Sami Khedira","Mario Götze","David Silva","Mario Mandžukić","Diego Godín","Philippe Coutinho","Pepe","N'Golo Kanté","Zico","Ruud van Nistelrooy","Mats Hummels","Pepe Reina","Ruud Gullit","Yaya Touré","Raheem Sterling","Petr Čech","Alan Shearer","Gonzalo Higuaín","Víctor Valdés","Virgil van Dijk","Javier Mascherano","Juan Manuel Mata","Lilian Thuram","Arturo Vidal","Henrik Mkhitarian","Keisuke Honda","Nani","Rio Ferdinand","Alisson Becker","Paul Scholes","Giorgio Chiellini","Alexis Sánchez","David Luiz","Thiago Silva","Diego Costa","Rodri","Achraf Hakimi","Kevin Keegan","Mario Gómez","Patrick Vieira","Javier Zanetti","Hidetoshi Nakata","Ashley Cole","Ivan Perišić","Harry Maguire","Wojciech Szczęsny","Aaron Ramsey","Arda Turan","Roberto Firmino","Keylor Navas","Diogo Jota","Andrey Arshavin","Paolo Rossi","Hristo Stoichkov","Álvaro Arbeloa","Xherdan Shaqiri","Emmanuel Adebayor","Joshua Kimmich","Bukayo Saka","Nicolas Anelka","Ashley Young","Klaas-Jan Huntelaar","Dani Carvajal","Marc-André ter Stegen","Frank Rijkaard","David Trezeguet","Michael Laudrup","Leonardo Bonucci","Deco","Mario Kempes","Memphis Depay","Patrice Evra","Éric Abidal","André Schürrle","Edin Džeko","Shinji Kagawa","Javier Hernández","Gabriel Batistuta","Ronald Koeman","Dunga","Christian Eriksen","Pedri","Raúl Albiol","Samuel Umtiti","Michael Carrick","David Alaba","Park Ji-Sung","Mikel Arteta","Salvatore Schillaci","Shinji Okazaki","Bruno Fernandes","Dino Zoff","Theo Walcott","Jens Lehmann","Hulk","Per Mertesacker","Filippo Inzaghi","Radamel Falcao García","Rafael van der Vaart","Makoto Hasebe","Mikel John Obi","Vincent Kompany","Diego Simeone","Yūto Nagatomo","Julian Draxler","Dejan Lovren","Takumi Minamino","Jamie Vardy","Jordan Pickford","Ole Gunnar Solskjær","Alan Dzagoyev","Takashi Inui","Isco","Luke Shaw","Antonio Rüdiger","İlkay Gündoğan","Davor Šuker","Gheorghe Hagi","Igor Akinfeyev","Dirk Kuyt","César Azpilicueta","Clarence Seedorf","Wataru Endō","Federico Valverde","Kai Havertz","Ferran Torres","Gavi","Samir Nasri","Thiago Alcântara"];
  let cache = null;
  function bancos() {
    if (cache) return cache;
    const P = global.PALAVRAS_IMPOSTOR || [];
    const futebol = new Set(), geral = new Set();
    P.forEach(x => [x.p, x.s].forEach(w => { if (w) (x.g === 'Futebol' ? futebol : geral).add(limpa(w)); }));
    CRAQUES_TOP.forEach(n => futebol.add(n));
    cache = { futebol: [...futebol], geral: [...geral] };
    return cache;
  }
  // n nomes do tema, sem repetir nada que já saiu na partida
  M.sortear = (tema, n, usados) => {
    const b = bancos(), ja = new Set((usados || []).map(C.norm));
    const pool = tema === 'futebol' ? b.futebol : tema === 'geral' ? b.geral : b.futebol.concat(b.geral);
    return C.shuffle(pool.filter(w => !ja.has(C.norm(w)))).slice(0, n);
  };

  // times de 2 (um de 3 se for ímpar); recebe a lista de nomes (ou ids)
  M.montarTimes = lista => {
    const xs = C.shuffle(lista.slice()), times = [];
    while (xs.length >= 2) times.push(xs.splice(0, 2));
    if (xs.length) { if (times.length) times[times.length - 1].push(xs[0]); else times.push([xs[0]]); }
    return times;
  };
  // ordem das rodadas: 1º de cada time, depois o 2º de cada time, …
  // cada rodada = { time, mimo (quem faz a mímica), adivinha: [quem adivinha] }
  M.rodadas = times => {
    const max = Math.max(...times.map(t => t.length)), out = [];
    for (let k = 0; k < max; k++) times.forEach((t, ti) => { if (t[k] !== undefined) out.push({ time: ti, mimo: t[k], adivinha: t.filter((_, i) => i !== k) }); });
    return out;
  };
  // placar por time: acertos, % (time de 3 tem uma rodada a mais), tempo médio por rodada (desempate: quem acertou mais rápido)
  M.placar = (times, feitas) => times.map((t, ti) => {
    const rs = feitas.filter(r => r.time === ti);
    const ac = rs.reduce((s, r) => s + r.acertos.length, 0), tot = rs.length * M.POR_RODADA;
    return { ti, membros: t, acertos: ac, total: tot, pct: tot ? ac / tot : 0, tempo: rs.length ? Math.round(rs.reduce((s, r) => s + (r.tempo || 0), 0) / rs.length) : 0 };
  }).sort((a, b) => b.pct - a.pct || b.acertos - a.acertos || a.tempo - b.tempo);
  const fmt = ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  M.fmt = fmt;

  global.Mimica = M;
})(window);
