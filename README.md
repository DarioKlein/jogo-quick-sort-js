# Sort Factory

Jogo educativo 2D no qual o jogador executa cada etapa do Quick Sort caminhando por uma fábrica, inspecionando ponteiros e transportando caixas físicas com um robô.

## Como executar

Não há dependências externas nem banco de dados. O servidor local usa apenas recursos nativos do
Node.js. As partidas abertas ficam na memória e o ranking da execução atual é espelhado em
`data/ranking.json`.

1. Instale o Node.js 18 ou superior.
2. No terminal, execute `npm start`.
3. Abra o endereço do jogo mostrado no terminal.
4. Compartilhe o endereço `Rede da sala` com os alunos conectados ao mesmo Wi-Fi.
5. Abra `/dev` no seu computador para acompanhar o ranking e assistir às partidas.

Exemplo:

```text
Jogo local:   http://localhost:3000
Painel dev:   http://localhost:3000/dev
Rede da sala: http://192.168.0.15:3000
```

O arquivo de ranking é recriado vazio sempre que `npm start` inicia uma nova execução. Durante a aula,
os nomes e melhores resultados continuam no ranking mesmo se um aluno fechar o navegador. Nomes são
únicos, ignorando maiúsculas, espaços e acentos; o mesmo navegador consegue recuperar sua identidade.

A transmissão prioriza o desempenho de quem está jogando: o cliente envia no máximo 20 estados por
segundo quando é assistido. O painel reproduz esses estados em 60 FPS com um buffer adaptativo de
aproximadamente 320 a 700 ms, aceitando atraso adicional para absorver oscilações da rede sem aumentar
o trabalho no computador do jogador.

Chrome/Chromium, Edge e Firefox recentes são suportados.

## Controles

- `W`, `A`, `S`, `D` ou setas: movimentar o robô;
- `E` ou `Espaço`: inspecionar ou selecionar a caixa próxima;
- `Esc`: fechar o tutorial;
- **Como jogar**: reabrir o tutorial;
- **Reiniciar run**: zerar a tentativa atual e voltar ao caso médio.

## Regra ensinada

Cada run percorre automaticamente três fases, sempre nesta ordem:

| Fase | Caso | Vetor-base | Comportamento |
| --- | --- | --- | --- |
| 1 | Médio | `[8, 3, 12, 5, 1, 10]` | Partições irregulares; custo esperado `O(n log n)` |
| 2 | Melhor | `[4, 1, 3, 2, 5, 6]` | Partições tão equilibradas quanto possível; `O(n log n)` |
| 3 | Pior | `[1, 2, 3, 4, 5, 6]` | Partições com `n−1` elementos; `O(n²)` |

O pivô é sempre o primeiro elemento do trecho: `i` parte da esquerda e o pivô termina na posição de `j`.

Em cada subarray:

1. o primeiro elemento é escolhido como pivô;
2. `i` avança enquanto encontra valores menores ou iguais ao pivô;
3. `j` recua enquanto encontra valores maiores que o pivô;
4. se os ponteiros ainda não se cruzaram, suas caixas são trocadas;
5. após o cruzamento, o pivô troca de posição com `j`;
6. o processo continua primeiro no lado esquerdo e depois no direito.

Ao terminar uma fase, o jogo avança automaticamente. Depois do pior caso, registra a pontuação e o
tempo total da run. A pontuação reúne as três fases e perde 3 pontos por segundo; em caso de empate no
ranking, vence o menor tempo e depois o menor número de erros. Uma nova tentativa preserva o melhor
resultado anterior do jogador.

Durante uma troca, a primeira caixa selecionada fica nas mãos do robô. Ao chegar à segunda posição e interagir, essa caixa ocupa o encaixe e a caixa deslocada passa para as mãos do robô. O jogador precisa caminhar de volta ao primeiro encaixe vazio e interagir novamente para concluir a troca. O robô nunca percorre esse caminho automaticamente.

## Organização do código

O projeto usa módulos no padrão IIFE, compartilhados pelo namespace `window.SortFactory`. Scripts clássicos mantêm o cliente sem etapa de build; o servidor local é necessário apenas para conectar os jogadores ao painel da sala.

```text
.
├── index.html
├── dev.html                  # ranking e modo espectador do apresentador
├── style.css
├── dev.css
├── server.js                 # servidor HTTP, sessões ao vivo e ranking temporário em JSON
├── js/
│   ├── constants.js          # configuração imutável e conteúdo do tutorial
│   ├── utils.js              # funções puras compartilhadas
│   ├── quick-sort-engine.js  # máquina de estados e regras do algoritmo
│   ├── input-controller.js   # teclado e normalização de movimento
│   ├── ui-controller.js      # HUD, tutorial e modal de vitória
│   ├── renderer.js           # cenário e animações no Canvas 2D
│   ├── live-session.js       # envio temporário do estado do jogador
│   ├── run-scoring.js        # pontuação acumulada e penalidade por tempo
│   ├── spectator-buffer.js   # fila e interpolação suave da transmissão
│   ├── dev-dashboard.js      # ranking e reprodução das partidas ao vivo
│   └── game.js               # ciclo do jogo e coordenação dos módulos
└── tests/
    ├── quick-sort-engine.test.js
    ├── renderer-smoke.test.js
    └── server.test.js
```

A lógica do algoritmo não depende do Canvas ou do DOM. Isso permite testá-la isoladamente e impede que erros de interface corrompam o vetor.

## Testes

Com Node.js instalado, execute (não é necessário instalar pacotes):

```powershell
npm test
npm run check
```

Os testes percorrem as fases do algoritmo, validam a pontuação da run, nomes únicos, ranking temporário,
reinicialização limpa do JSON, transmissão e renderização em Canvas simulado.

## Acessibilidade

- indicadores usam texto e formas além de cores;
- números e instruções possuem alto contraste;
- botões são navegáveis por teclado;
- o jogo pausa ao perder foco;
- animações são reduzidas quando o sistema solicita `prefers-reduced-motion`.

## Limitações do MVP

- três fases fixas com seis caixas cada;
- controles por teclado, sem interface de toque dedicada;
- ranking mantido somente durante a execução atual do servidor;
- painel do apresentador sem autenticação, destinado somente à rede local da apresentação;
- áudio não incluído nesta versão.
