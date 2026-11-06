(function initializeConstants(namespace) {
  "use strict";

  const GameState = Object.freeze({
    INSPECT_I: "INSPECT_I",
    INSPECT_J: "INSPECT_J",
    SWAP_I_J: "SWAP_I_J",
    PLACE_PIVOT: "PLACE_PIVOT",
    VICTORY: "VICTORY",
  });

  const PivotStrategy = Object.freeze({
    FIRST: "FIRST",
    LAST: "LAST",
  });

  const PhaseId = Object.freeze({
    AVERAGE: "AVERAGE",
    BEST: "BEST",
    WORST: "WORST",
  });

  const PHASES = Object.freeze([
    Object.freeze({
      id: PhaseId.AVERAGE,
      number: 1,
      title: "Caso médio",
      shortTitle: "MÉDIO",
      complexity: "O(n log n) esperado",
      description: "Partições irregulares, como acontece com dados comuns sem uma ordem especial.",
      lesson: "Na média, as divisões ainda reduzem bem o problema e mantêm o Quick Sort eficiente.",
      values: Object.freeze({
        [PivotStrategy.FIRST]: Object.freeze([8, 3, 12, 5, 1, 10]),
        [PivotStrategy.LAST]: Object.freeze([8, 3, 12, 5, 1, 10]),
      }),
    }),
    Object.freeze({
      id: PhaseId.BEST,
      number: 2,
      title: "Melhor caso",
      shortTitle: "MELHOR",
      complexity: "O(n log n)",
      description: "Cada pivô divide o trecho em partes tão equilibradas quanto possível.",
      lesson: "Divisões equilibradas reduzem a altura da recursão e o total de comparações.",
      values: Object.freeze({
        [PivotStrategy.FIRST]: Object.freeze([4, 1, 3, 2, 5, 6]),
        [PivotStrategy.LAST]: Object.freeze([6, 5, 1, 2, 4, 3]),
      }),
    }),
    Object.freeze({
      id: PhaseId.WORST,
      number: 3,
      title: "Pior caso",
      shortTitle: "PIOR",
      complexity: "O(n²)",
      description: "O vetor ordenado faz o pivô de extremidade gerar um trecho com n−1 elementos.",
      lesson: "Divisões muito desequilibradas aprofundam a recursão e levam ao custo quadrático.",
      values: Object.freeze({
        [PivotStrategy.FIRST]: Object.freeze([1, 2, 3, 4, 5, 6]),
        [PivotStrategy.LAST]: Object.freeze([1, 2, 3, 4, 5, 6]),
      }),
    }),
  ]);

  namespace.Constants = Object.freeze({
    WIDTH: 1280,
    HEIGHT: 720,
    INITIAL_ARRAY: Object.freeze([8, 3, 12, 5, 1, 10]),
    INITIAL_SCORE: 1000,
    ERROR_PENALTY: 5,
    WALK_SPEED: 260,
    SPRINT_MULTIPLIER: 1.8,
    BOX_START_X: 245,
    BOX_GAP: 158,
    BOX_Y: 344,
    BOX_SIZE: 96,
    INTERACTION_Y: 505,
    INTERACTION_DISTANCE: 92,
    HANDOFF_DURATION: 1000,
    PLACE_DURATION: 520,
    COMPARISON_DURATION: 3800,
    GameState,
    PivotStrategy,
    PhaseId,
    PHASES,
    COLORS: Object.freeze({
      cyan: "#30e6f2",
      magenta: "#ef5bd7",
      gold: "#ffc845",
      green: "#65ed9a",
      red: "#ff6174",
      ink: "#eafcff",
      muted: "#6f9aa5",
    }),
    TUTORIAL_PAGES: Object.freeze([
      Object.freeze({
        title: "Missão",
        text: "Uma falha embaralhou as cargas. Controle o robô e ordene as caixas para reativar a linha de triagem.",
        art: "radial-gradient(circle at 50% 55%, rgba(255,200,69,.35) 0 9%, transparent 10%), repeating-linear-gradient(90deg, transparent 0 13%, rgba(48,230,242,.16) 13% 14%), linear-gradient(135deg,#10323c,#081a22)",
      }),
      Object.freeze({
        title: "Movimento",
        text: "Use WASD ou as setas para caminhar e segure Shift para correr. Aproxime-se da posição destacada antes de interagir.",
        art: "linear-gradient(135deg, transparent 35%, rgba(48,230,242,.22) 36% 42%, transparent 43%), linear-gradient(45deg, transparent 35%, rgba(48,230,242,.16) 36% 42%, transparent 43%), #0b2731",
      }),
      Object.freeze({
        title: "O pivô",
        text: "A caixa escolhida no menu será o pivô de cada trecho. As demais serão organizadas ao redor do valor dela.",
        art: "radial-gradient(circle at 25% 50%, rgba(255,200,69,.75) 0 13%, rgba(255,200,69,.16) 14% 23%, transparent 24%), linear-gradient(90deg,transparent 0 42%,rgba(255,255,255,.06) 42% 44%,transparent 44%), #0b2731",
      }),
      Object.freeze({
        title: "Os ponteiros",
        text: "O ponteiro i procura um valor grande demais para a esquerda. O ponteiro j procura um valor que pode ocupar esse lado.",
        art: "linear-gradient(90deg, transparent 0 22%, rgba(48,230,242,.6) 23% 26%, transparent 27% 72%, rgba(239,91,215,.6) 73% 76%, transparent 77%), #0b2731",
      }),
      Object.freeze({
        title: "Interação",
        text: "Pressione E ou Espaço perto de uma caixa. Nas trocas, selecione as duas caixas indicadas em qualquer ordem.",
        art: "radial-gradient(circle at 50% 50%, rgba(255,255,255,.65) 0 8%, rgba(48,230,242,.18) 9% 25%, transparent 26%), #0b2731",
      }),
      Object.freeze({
        title: "Protocolo pronto",
        text: "Inspecione, troque e posicione cada pivô. O painel superior sempre mostrará sua próxima ação. Boa missão!",
        art: "radial-gradient(circle at 50% 50%, rgba(101,237,154,.55) 0 12%, rgba(101,237,154,.12) 13% 30%, transparent 31%), #0b2731",
      }),
    ]),
  });
})(window.SortFactory || (window.SortFactory = {}));
