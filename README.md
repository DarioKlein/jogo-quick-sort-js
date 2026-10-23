# Sort Factory

Jogo educativo 2D no qual o jogador executa cada etapa do Quick Sort caminhando por uma fábrica, inspecionando ponteiros e trocando caixas físicas.

## Como executar

Não há instalação, dependências ou servidor.

1. Abra `index.html` em um navegador moderno.
2. Avance ou pule o tutorial.
3. Siga o objetivo exibido no painel superior.

Chrome/Chromium, Edge e Firefox recentes são suportados.

## Controles

- `W`, `A`, `S`, `D` ou setas: movimentar o robô;
- `E` ou `Espaço`: inspecionar ou selecionar a caixa próxima;
- `Esc`: fechar o tutorial;
- **Como jogar**: reabrir o tutorial;
- **Reiniciar**: restaurar completamente a fase.

## Regra ensinada

A fase começa com `[8, 3, 12, 5, 1, 10]`. Em cada subarray:

1. o primeiro elemento é escolhido como pivô;
2. `i` avança enquanto encontra valores menores ou iguais ao pivô;
3. `j` recua enquanto encontra valores maiores que o pivô;
4. se os ponteiros ainda não se cruzaram, suas caixas são trocadas;
5. após o cruzamento, o pivô troca de posição com `j`;
6. o processo continua primeiro no lado esquerdo e depois no direito.

O resultado final é `[1, 3, 5, 8, 10, 12]`.

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
    └── quick-sort-engine.test.js
```

A lógica do algoritmo não depende do Canvas ou do DOM. Isso permite testá-la isoladamente e impede que erros de interface corrompam o vetor.

## Testes

Com Node.js instalado, execute (não é necessário instalar pacotes):

```powershell
npm test
npm run check
```

O teste percorre automaticamente todos os estados da fase, confirma o vetor final e verifica que ações incorretas não alteram os valores.

## Acessibilidade

- indicadores usam texto e formas além de cores;
- números e instruções possuem alto contraste;
- botões são navegáveis por teclado;
- o jogo pausa ao perder foco;
- animações são reduzidas quando o sistema solicita `prefers-reduced-motion`.

## Limitações do MVP

- uma fase fixa com seis caixas;
- controles por teclado, sem interface de toque dedicada;
- progresso mantido apenas durante a sessão;
- áudio não incluído nesta versão.
