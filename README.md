# Res Assiny

Site de jogos para jogar com os amigos, feito para rodar no GitHub Pages (sem servidor, sem build).

## Jogos
- **No Limite** (`no-limite/`): chegue o mais perto da resposta sem passar dela.
  - Cravou = 2 pontos (se alguém cravou, só quem cravou pontua)
  - Mais perto sem estourar = 1 ponto (empates pontuam juntos)
  - Todo mundo estourou = ninguém pontua
  - 500 perguntas em 15 temas (`no-limite/perguntas.js`)
  - Modo um celular (passa a vez) ou vários celulares (`no-limite/sala.html`): cada um responde no seu

- **Top 100 / Top 10** (`top-100/`): 72 listas pesquisadas na web (futebol, Brasil, mundo, música, cinema, internet, economia), cada uma com fonte, data e critério mostrados no jogo.
  - Tamanho: Top 10, 20, 30, 50 ou 100
  - Estilo Pontos: pontos = posição, fora da lista = 0, mais pontos vence (em X rodadas ou primeiro a X pontos)
  - Estilo Reverso: pontos = posição, fora/passar = tamanho + 1, menos pontos vence
  - Estilo Duvido: sem pontos; o app só confere quando alguém duvida; último em pé vence (link direto no hub: Top 10 · Duvido)
  - Um ou vários celulares (`top-100/sala.html`)
  - Listas em `top-100/listas.js`
- **Quem Tava Lá** (`quem-tava-la/`): fale alguém que estava em campo (titular ou reserva que entrou).
  - Com "Duvido": duvidou e estava → quem duvidou sai, quem falou ganha folga; duvidou e não estava → quem falou sai, quem duvidou ganha folga
  - Sem "Duvido": o app confere na hora; errou, está fora
  - Um ou vários celulares (`quem-tava-la/sala.html`): cada um fala no seu e os outros duvidam no deles
  - Jogos em `quem-tava-la/jogos.js`. Quando a lista de reservas de um time pode estar incompleta (`reservas_completas: false`), o app pergunta ao grupo antes de eliminar alguém por um nome que não conhece.
- **Impostor** (`impostor/`): todos recebem a mesma palavra, menos o impostor. Temas Futebol (200) e Geral (300) em `impostor/palavras.js`.
  - Impostor recebe uma dica (sabe que é impostor) ou uma palavra parecida (não sabe)
  - 1 a 3 impostores, 1 a 3 rodadas de pistas, votação secreta ou aberta
  - Vários celulares (`impostor/sala.html`): cada um vê a própria palavra e vota no seu celular
  - Votaram num inocente ou deu empate → impostores vencem. Pegaram todos → inocentes vencem. Placar da noite: inocente +1, impostor +2

## Estrutura
Todos os arquivos ficam na raiz (sem pastas), para facilitar o upload pelo site do GitHub.

## Publicar no GitHub Pages
1. Crie um repositório no GitHub (ex.: `res-assiny`).
2. Envie todos os arquivos desta pasta para o repositório (botão **Add file → Upload files**, arrastando a pasta inteira).
3. Vá em **Settings → Pages**, em *Branch* escolha `main` e pasta `/ (root)`, e salve.
4. Em 1 ou 2 minutos o site fica em `https://SEU-USUARIO.github.io/res-assiny/`.

## Adicionar ou corrigir perguntas
Edite `no-limite/perguntas.js`. Cada linha é uma pergunta:

```js
{"id": 501, "c": "Futebol", "p": "Pergunta?", "r": 123, "u": "gols", "i": "Curiosidade mostrada na revelação."}
```

- `id` precisa ser único
- `r` é sempre um número inteiro
- use `"u": "ano"` para perguntas de ano (o número aparece sem ponto: 1922)

## Estrutura
```
index.html            hub com a lista de jogos
assets/style.css      visual compartilhado
no-limite/
  index.html
  game.js             telas e fluxo do jogo
  regras.js           pontuação (reaproveitada no modo vários celulares)
  perguntas.js        banco de perguntas
top-100/              listas.js + game.js
quem-tava-la/         jogos.js + game.js
assets/comum.js       reconhecimento de nomes, editor de jogadores, pódio
```

## Vários celulares (Supabase)
- Configuração em `assets/config.js` (URL do projeto + chave publishable; nunca a secret).
- Usa só o Realtime (broadcast + presence), sem tabelas. Quem cria a sala é o anfitrião e guarda o estado do jogo; se ele recarregar a página, o jogo continua.
- Código da sala de 4 letras, link e QR code para entrar.
