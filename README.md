# Sort Factory

Jogo educativo 2D no qual o jogador executa cada etapa do Quick Sort caminhando por uma fábrica, inspecionando ponteiros e transportando caixas físicas com um robô.

## Como executar

Não há instalação, dependências ou servidor.

1. Abra `index.html` em um navegador moderno.
2. Escolha se o pivô de cada trecho ficará no início ou no final.
3. Escolha uma das três fases.
4. Avance ou pule o tutorial.
5. Siga o objetivo exibido no painel superior.

Chrome/Chromium, Edge e Firefox recentes são suportados.

## Controles

- `W`, `A`, `S`, `D` ou setas: movimentar o robô;
- `E` ou `Espaço`: inspecionar ou selecionar a caixa próxima;
- `Esc`: fechar o tutorial;
- **Como jogar**: reabrir o tutorial;
- **Reiniciar**: restaurar completamente a fase.

## Regra ensinada

O jogo contém três fases que demonstram comportamentos diferentes do Quick Sort:

| Fase | Caso | Vetor-base | Comportamento |
| --- | --- | --- | --- |
| 1 | Médio | `[8, 3, 12, 5, 1, 10]` | Partições irregulares; custo esperado `O(n log n)` |
| 2 | Melhor | Adaptado à estratégia escolhida | Partições tão equilibradas quanto possível; `O(n log n)` |
| 3 | Pior | `[1, 2, 3, 4, 5, 6]` | Partições com `n−1` elementos; `O(n²)` |

Antes da missão, o jogador também escolhe uma das duas variantes:

- **pivô no início:** `i` parte da esquerda e o pivô termina na posição de `j`;
- **pivô no final:** a busca é espelhada e o pivô termina na posição de `i`.

Em cada subarray:

1. o primeiro ou o último elemento é escolhido como pivô, conforme o menu inicial;
2. `i` avança enquanto encontra valores menores ou iguais ao pivô;
3. `j` recua enquanto encontra valores maiores que o pivô;
4. se os ponteiros ainda não se cruzaram, suas caixas são trocadas;
5. após o cruzamento, o pivô troca de posição com `j`;
6. o processo continua primeiro no lado esquerdo e depois no direito.

Ao terminar uma fase, o jogo apresenta a complexidade observada e permite avançar diretamente para a próxima.

Durante uma troca, a primeira caixa selecionada fica nas mãos do robô. Ao chegar à segunda posição e interagir, essa caixa ocupa o encaixe e a caixa deslocada passa para as mãos do robô. O jogador precisa caminhar de volta ao primeiro encaixe vazio e interagir novamente para concluir a troca. O robô nunca percorre esse caminho automaticamente.

## Organização do código

O projeto usa módulos no padrão IIFE, compartilhados pelo namespace `window.SortFactory`. Scripts clássicos foram escolhidos deliberadamente para que o jogo continue funcionando ao abrir `index.html` por `file://`, sem servidor local.

```text
.
├── index.html
├── style.css
├── js/
│   ├── constants.js          # configuração imutável e conteúdo do tutorial
│   ├── utils.js              # funções puras compartilhadas
│   ├── quick-sort-engine.js  # máquina de estados e regras do algoritmo
│   ├── input-controller.js   # teclado e normalização de movimento
│   ├── ui-controller.js      # HUD, tutorial e modal de vitória
│   ├── renderer.js           # cenário e animações no Canvas 2D
│   └── game.js               # ciclo do jogo e coordenação dos módulos
└── tests/
    ├── quick-sort-engine.test.js
    └── renderer-smoke.test.js
```

A lógica do algoritmo não depende do Canvas ou do DOM. Isso permite testá-la isoladamente e impede que erros de interface corrompam o vetor.

## Testes

Com Node.js instalado, execute (não é necessário instalar pacotes):

```powershell
npm test
npm run check
```

Os testes percorrem automaticamente as três fases com as duas estratégias de pivô, confirmam os vetores finais, comparam o número de ações do melhor e do pior caso, verificam ações incorretas e exercitam a renderização em um Canvas simulado.

## Acessibilidade

- indicadores usam texto e formas além de cores;
- números e instruções possuem alto contraste;
- botões são navegáveis por teclado;
- o jogo pausa ao perder foco;
- animações são reduzidas quando o sistema solicita `prefers-reduced-motion`.

## Limitações do MVP

- três fases fixas com seis caixas cada;
- controles por teclado, sem interface de toque dedicada;
- progresso mantido apenas durante a sessão;
- áudio não incluído nesta versão.
