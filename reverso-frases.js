// Áudio Reverso — frases para sortear. Curtas (2 a 5 palavras) funcionam melhor de trás pra frente.
(function (global) {
  const F = {};
  F.TEMAS = { frases: '😂 Frases', futebol: '⚽ Futebol', misto: '🔀 Misturado', livre: '✍️ Cada um inventa' };
  F.FRASES = [
    'Nós somos gêmeos', 'Eu amo pão de queijo', 'Cadê o controle remoto', 'Hoje tem churrasco', 'Me empresta um real',
    'O gato subiu no telhado', 'Ninguém me ama', 'Bom dia flor do dia', 'Já volto, vou no banheiro', 'Fala sério',
    'Quem comeu meu iogurte', 'Abacaxi com hortelã', 'Paçoca de amendoim', 'Eu sou o rei do camarote', 'Vai dar certo',
    'Chama no zap', 'A conta não fecha', 'Segura essa marimba', 'Tô de dieta', 'Brigadeiro de colher',
    'O pai tá on', 'Cuidado com o degrau', 'Meu cachorro fala inglês', 'Pizza de calabresa', 'Não sei nadar',
    'Hoje é sexta-feira', 'Cadê meu carregador', 'Esqueci a senha do wi-fi', 'Coxinha de frango', 'Ai que preguiça',
    'Vou dormir cedo hoje', 'O mundo é uma bola', 'Ovo frito com arroz', 'Pastel de feira',
    'O sinal caiu', 'Minha mãe mandou', 'Abre a porta, Mariquinha', 'Pegou o beco', 'Corre que a polícia vem',
    'Banana de pijama', 'Rato roeu a roupa do rei', 'Três pratos de trigo', 'Sabiá na palmeira', 'Batata frita',
    'Eu sou lindo', 'Quero café', 'Fecha a geladeira', 'A vaca foi pro brejo', 'Chuchu beleza',
    'Tá pegando fogo, bicho', 'Sextou com S de saudade', 'Eu não aguento mais', 'Me dá um abraço', 'Pipoca doce',
    'Picolé de limão', 'Arroz, feijão e farofa', 'Pede um Uber', 'Desce mais uma', 'Pagode na laje',
    'Vamos pra praia', 'Fiquei sem bateria', 'Dá licença, por favor', 'Hoje eu tô feliz', 'Cuscuz com ovo',
    'Mamão com açúcar', 'Bolo de cenoura', 'Senta lá, Cláudia', 'Que isso, meu filho', 'Tô nem aí',
    'Ganhei na Mega-Sena', 'O boleto venceu', 'Segunda-feira de novo', 'Feliz aniversário', 'Parabéns pra você',
    'Ô abre alas', 'Tchau, querida', 'Acorda, Pedrinho', 'É ruim, hein', 'Melhor do mundo',
    'Mais um dia normal', 'Mentira tem perna curta', 'Água mole em pedra dura', 'Quem não chora não mama', 'De grão em grão',
    'Pão com manteiga', 'Ninguém segura esse menino', 'Que vergonha alheia', 'Já deu por hoje', 'Bora, bora, bora',
    'Eu sou o capitão', 'Tamo junto', 'Partiu academia', 'Volta pra casa', 'Cadê a cerveja',
    'O churrasqueiro sumiu', 'Abacate com leite', 'Sorvete de flocos', 'Calma, calabreso', 'Toma, toma, toma',
    'O pinguim da geladeira', 'Peixe fora d\'água', 'Bicho de sete cabeças', 'Pé de pano', 'Jacaré no seco anda',
    'Galinha pintadinha', 'Elefante cor-de-rosa', 'Macaco velho', 'Lagartixa na parede', 'Tartaruga ninja',
  ];
  F.FUTEBOL = [
    'Maturana preguiçoso', 'Léo Ortiz', 'É campeão', 'Pênalti mal batido', 'Gol de placa',
    'Bola na trave', 'Impedimento claro', 'Cartão vermelho', 'Chuta que é macumba', 'Olé, olé, olé',
    'Mengão', 'Vai Corinthians', 'Dá-lhe Galo', 'Avanti Palestra', 'Bambi', 'Ronaldo Fenômeno',
    'Ronaldinho Gaúcho', 'Pelé eterno', 'Messi ou Cristiano', 'Neymar caiu de novo', 'Var checando',
    'Tem que respeitar', 'Haja coração', 'Sai que é sua, Taffarel', 'Aqui é trabalho', 'O juiz roubou',
    'Gabigol', 'Arrascaeta', 'Hulk paraíba', 'Cássio', 'Vini Júnior', 'Rogério Ceni', 'Romário',
    'Bola murcha', 'Chapéu no zagueiro', 'Caneta', 'Golaço de bicicleta', 'Lateral é lateral',
    'Fominha', 'Perna de pau', 'Frango do goleiro', 'Libertadores', 'Copa do Mundo', 'Sete a um',
    'Alex Turco', 'Escanteio curto', 'Tiro de meta', 'Dois a zero', 'Bola pro mato',
  ];
  const norm = s => String(s).toLowerCase();
  F.sortear = (tema, usados) => {
    const base = tema === 'futebol' ? F.FUTEBOL : tema === 'frases' ? F.FRASES : F.FRASES.concat(F.FUTEBOL);
    const u = new Set((usados || []).map(norm));
    let livres = base.filter(f => !u.has(norm(f)));
    if (!livres.length) livres = base;
    return livres[Math.floor(Math.random() * livres.length)];
  };
  global.Reverso = global.Reverso || {};
  global.Reverso.Frases = F;
})(window);
