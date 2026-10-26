# SORT FACTORY — Documento Completo do MVP

## 1. Visão geral

**SORT FACTORY** será um jogo educativo 2D de puzzle e movimentação, executado diretamente no navegador. O jogador controla um pequeno robô em uma fábrica e precisa organizar caixas numeradas aplicando corretamente o algoritmo **Quick Sort clássico**, podendo escolher o **primeiro ou o último elemento de cada subarray como pivô** antes da missão.

O objetivo não é apresentar o algoritmo como um questionário ou como uma animação passiva. O Quick Sort será a própria mecânica do jogo: o jogador caminhará pelo cenário, inspecionará caixas, acompanhará os ponteiros `i` e `j`, realizará trocas físicas, posicionará o pivô e continuará o processo nos subarrays gerados até que todas as caixas estejam ordenadas.

O MVP será curto, mas completamente jogável. Ele deverá ensinar o processo por meio da ação, validar cada decisão do jogador e concluir com uma condição clara de vitória.

---

## 2. Objetivo do projeto

Criar uma primeira versão funcional que demonstre que é possível transformar a execução do Quick Sort em uma experiência de jogo 2D compreensível e divertida.

O MVP deverá permitir que o jogador:

- controle um personagem dentro de um cenário de fábrica;
- veja os números como caixas físicas no cenário;
- identifique o pivô do subarray atual;
- acompanhe e movimente logicamente os ponteiros `i` e `j`;
- inspecione os valores apontados;
- troque as caixas corretas;
- coloque o pivô em sua posição definitiva;
- repita o processo nos subarrays resultantes;
- termine a fase quando todo o vetor estiver ordenado.

Ao final da fase, o jogador deverá ter entendido visualmente que o Quick Sort:

1. escolhe um pivô;
2. particiona os demais valores em torno dele;
3. posiciona o pivô em seu lugar definitivo;
4. repete o mesmo processo nos lados esquerdo e direito.

---

## 3. Público-alvo

O jogo será pensado principalmente para:

- estudantes iniciantes em algoritmos e estruturas de dados;
- alunos de cursos técnicos ou de graduação;
- pessoas que já viram Quick Sort em pseudocódigo, mas ainda têm dificuldade para visualizar sua execução;
- professores que desejam uma demonstração interativa e curta.

Não será necessário conhecer Quick Sort antes de jogar. O tutorial inicial apresentará apenas as regras necessárias para começar.

---

## 4. Plataforma e tecnologia previstas

O projeto será desenvolvido com:

- **HTML5** para a página e os elementos de interface;
- **CSS3** para o HUD, tutorial, menus e adaptação da tela;
- **JavaScript puro** para toda a lógica do jogo;
- **Canvas 2D** para personagem, cenário, caixas, ponteiros, animações e efeitos;
- nenhuma dependência externa;
- nenhuma instalação obrigatória;
- nenhuma conexão com servidor.

O projeto será entregue em uma pasta que poderá ser executada abrindo o arquivo `index.html` em um navegador moderno.

O progresso existirá apenas durante a sessão atual. Não haverá conta, banco de dados ou serviço online no MVP.

---

## 5. Conceito narrativo

O jogador assume o controle de um robô de manutenção recém-ativado em uma fábrica automatizada. Uma falha atingiu a linha de separação e as cargas chegaram fora de ordem. Para reativar o sistema, o robô precisa executar manualmente o **Protocolo Pivô**, procedimento usado pela fábrica para organizar as caixas.

Cada caixa contém um número que representa sua prioridade de envio. A linha só poderá voltar a funcionar quando todas as cargas estiverem em ordem crescente.

A narrativa será simples e funcional. Seu papel será dar sentido às ações do algoritmo, sem interromper constantemente a jogabilidade.

---

## 6. Cenário da primeira fase

A primeira fase acontecerá em uma pequena área industrial vista lateralmente. O cenário terá:

- piso metálico por onde o personagem pode andar;
- uma esteira central com seis posições para caixas;
- tubulações, luzes, placas e máquinas ao fundo;
- uma cabine ou painel que apresenta instruções;
- iluminação colorida para destacar o estado atual do algoritmo;
- limites físicos simples para impedir que o personagem saia da área jogável.

O cenário inteiro deverá caber em uma única tela. Não haverá câmera rolando pelo mapa no MVP.

### Direção visual

O visual será estilizado, legível e produzido diretamente por formas do Canvas e CSS. A estética combinará:

- fundo industrial escuro em azul-petróleo e grafite;
- detalhes em amarelo de segurança;
- luzes em ciano para elementos neutros;
- laranja ou dourado para o pivô;
- verde para ações corretas e posições concluídas;
- vermelho para erros;
- caixas grandes, com números facilmente legíveis;
- personagem robótico simples, mas claramente animado ao caminhar e interagir.

O foco será a clareza da mecânica. O polimento visual ficará abaixo da jogabilidade na ordem de prioridade.

---

## 7. Fases do algoritmo

O jogo terá três fases didáticas. A primeira preserva o vetor originalmente planejado:

```text
[8, 3, 12, 5, 1, 10]
```

As fases serão:

1. **Caso médio:** partições irregulares, representando o comportamento esperado `O(n log n)`;
2. **Melhor caso:** vetores adaptados à extremidade escolhida, produzindo divisões tão equilibradas quanto possível e custo `O(n log n)`;
3. **Pior caso:** vetor ordenado `[1, 2, 3, 4, 5, 6]`, que com pivô em uma extremidade produz partições de tamanho `n−1` e custo `O(n²)`.

O menu inicial permitirá selecionar qualquer fase. Após uma vitória, também será possível avançar diretamente para a próxima mantendo a estratégia de pivô.

Ele é curto o suficiente para uma primeira experiência e demonstra os principais comportamentos da partição:

- avanço do ponteiro `i` por valores menores ou iguais ao pivô;
- recuo do ponteiro `j` por valores maiores que o pivô;
- encontro de duas caixas que precisam ser trocadas;
- cruzamento dos ponteiros;
- colocação do pivô;
- criação de subarrays;
- chamadas recursivas até a ordenação completa.

O resultado final esperado será:

```text
[1, 3, 5, 8, 10, 12]
```

---

## 8. Variante exata do Quick Sort

Para evitar ambiguidades, o jogo usará uma partição com dois ponteiros e oferecerá duas variantes espelhadas no menu inicial.

### Pivô no início

Para um subarray delimitado pelos índices `início` e `fim`:

1. o pivô será o valor em `início`;
2. `i` começará em `início + 1`;
3. `j` começará em `fim`;
4. `i` avançará enquanto o valor atual for **menor ou igual ao pivô**;
5. `j` recuará enquanto o valor atual for **maior que o pivô**;
6. se `i < j`, os valores apontados serão trocados;
7. a busca continuará até que `i` e `j` se encontrem ou se cruzem;
8. o pivô será trocado com a caixa na posição `j`;
9. a posição `j` passará a ser a posição definitiva do pivô;
10. o processo será repetido no subarray à esquerda e depois no subarray à direita.

Representação lógica da partição:

```text
pivô = vetor[início]
i = início + 1
j = fim

enquanto verdadeiro:
    enquanto i <= fim e vetor[i] <= pivô:
        i avança

    enquanto j > início e vetor[j] > pivô:
        j recua

    se i >= j:
        encerrar a busca

    trocar vetor[i] com vetor[j]
    i avança
    j recua

trocar vetor[início] com vetor[j]
```

### Pivô no final

Na variante espelhada:

1. o pivô será o valor em `fim`;
2. `i` começará em `início`;
3. `j` começará em `fim - 1`;
4. as regras de comparação permanecem iguais;
5. após o cruzamento, o pivô será trocado com a posição `i`.

```text
pivô = vetor[fim]
i = início
j = fim - 1

enquanto verdadeiro:
    enquanto i < fim e vetor[i] <= pivô:
        i avança

    enquanto j >= início e vetor[j] > pivô:
        j recua

    se i >= j:
        encerrar a busca

    trocar vetor[i] com vetor[j]
    i avança
    j recua

trocar vetor[fim] com vetor[i]
```

Subarrays com zero ou um elemento já serão considerados ordenados e não exigirão uma partição jogável.

---

## 9. Loop principal de jogabilidade

Cada partição será transformada em uma sequência de ações físicas:

1. o jogo destaca o subarray ativo;
2. a primeira ou a última caixa recebe o marcador visual de **PIVÔ**, conforme a escolha inicial;
3. os ponteiros `i` e `j` aparecem sobre suas posições iniciais;
4. o jogador caminha até a caixa apontada por `i` e a inspeciona;
5. se o valor puder continuar no lado esquerdo, `i` avança;
6. quando `i` encontra um valor maior que o pivô, ele para;
7. o jogador repete o processo com `j`;
8. se `j` encontrar valores maiores que o pivô, ele recua;
9. quando `j` encontra um valor menor ou igual ao pivô, ele para;
10. se os ponteiros ainda não se cruzaram, o jogador troca as duas caixas apontadas;
11. o processo de busca se repete;
12. quando os ponteiros se cruzam, o jogador pega o pivô e o troca com a caixa em `j`;
13. o pivô é marcado como definitivamente posicionado;
14. o jogo seleciona o próximo subarray ainda não resolvido;
15. a fase termina quando não restar nenhum subarray com dois ou mais elementos.

Esse ciclo deverá ser sempre visível no HUD por meio de uma instrução curta, como:

```text
Objetivo atual: inspecione a caixa apontada por i.
```

ou:

```text
Objetivo atual: troque as caixas nas posições i e j.
```

---

## 10. Controles

### Movimentação

- `W`, `A`, `S`, `D`: mover o robô;
- setas direcionais: alternativa para movimentação.

### Interação

- `E` ou `Espaço`: inspecionar, pegar ou soltar uma caixa próxima, dependendo do objetivo atual;
- `Esc`: fechar o tutorial ou uma mensagem aberta;
- botão **Reiniciar** no HUD: reiniciar toda a fase.

O jogo deverá impedir a rolagem da página quando as setas ou a barra de espaço estiverem sendo usadas durante a partida.

---

## 11. Interação com as caixas

As caixas ocuparão posições fixas na esteira, mas serão tratadas como objetos físicos do cenário.

Para interagir, o personagem deverá estar próximo da caixa correta. Um contorno luminoso aparecerá quando uma caixa estiver ao alcance.

### Inspeção

Durante a busca dos ponteiros, pressionar o botão de interação na caixa correta fará o jogo comparar seu número com o pivô.

Exemplos:

- se `i` aponta para `3` e o pivô é `8`, a inspeção mostrará `3 ≤ 8`, e `i` avançará;
- se `i` aponta para `12`, a inspeção mostrará `12 > 8`, e `i` permanecerá parado;
- se `j` aponta para `10`, a inspeção mostrará `10 > 8`, e `j` recuará;
- se `j` aponta para `1`, a inspeção mostrará `1 ≤ 8`, e `j` permanecerá parado.

### Troca comum

Quando `i` e `j` estiverem parados em caixas inadequadas para seus respectivos lados:

1. o jogador se aproxima de uma das duas caixas;
2. pressiona o botão de interação para selecioná-la;
3. o robô pega a caixa com as mãos e passa a carregá-la durante o deslocamento;
4. o jogador se aproxima da outra posição com a caixa;
5. pressiona novamente o botão de interação;
6. a primeira caixa ocupa o segundo encaixe e desloca a caixa que estava nele;
7. a caixa deslocada passa para as mãos do robô;
8. o jogador caminha manualmente de volta ao primeiro encaixe, agora vazio;
9. uma nova interação coloca a caixa carregada e conclui a troca.

A ordem de seleção não importará: será possível selecionar primeiro `i` ou `j`.

### Colocação do pivô

Após o cruzamento dos ponteiros, o HUD solicitará a troca do pivô com a posição `j`, para pivô no início, ou com a posição `i`, para pivô no final. Essa ação usará a mesma mecânica de selecionar duas caixas.

Depois da troca, o pivô receberá um selo verde ou trava luminosa indicando que sua posição é definitiva.

---

## 12. Representação dos ponteiros

Os ponteiros `i` e `j` existirão como pequenos drones, braços mecânicos ou marcadores suspensos sobre a esteira.

Cada um terá:

- uma letra grande (`i` ou `j`);
- cor própria;
- seta apontando para a caixa atual;
- animação ao mudar de posição;
- pequeno rastro luminoso;
- estado visual diferente quando estiver parado aguardando uma troca.

Sugestão de cores:

- `i`: ciano;
- `j`: magenta;
- pivô: amarelo/dourado;
- posição finalizada: verde.

Quando um ponteiro ultrapassar o limite válido ou cruzar o outro, ele deverá continuar visualmente compreensível, aparecendo entre posições ou junto à borda do subarray.

---

## 13. Indicação do subarray ativo

A recursão será representada visualmente, sem exigir que o jogador entenda pilhas de chamadas.

O subarray atual terá:

- iluminação mais forte e moldura ciano completa;
- limites laterais e rótulo superior indicando claramente a zona ativa;
- texto indicando seus limites;
- trechos futuros bloqueados por máscara escura, faixas diagonais e cadeados;
- caixas bloqueadas fortemente dessaturadas e sem convite de interação;
- pivôs já posicionados marcados em verde.

Depois que um pivô for colocado, a faixa ativa diminuirá e passará para o próximo trecho. O jogo processará primeiro o lado esquerdo e depois o lado direito, seguindo uma ordem consistente e fácil de acompanhar.

Uma pequena fila visual poderá mostrar os segmentos pendentes, por exemplo:

```text
Agora: posições 0–5
Depois: posições 0–2 e 4–5
```

No MVP, essa informação será simplificada para não sobrecarregar o jogador.

---

## 14. Tutorial inicial

Ao abrir o jogo pela primeira vez ou ao reiniciar a página, um tutorial curto será exibido sobre o cenário.

O tutorial será dividido em telas simples:

1. **Missão:** ordenar as caixas para reativar a fábrica;
2. **Movimento:** usar WASD ou setas;
3. **Pivô:** a caixa no início ou no final do trecho será o pivô, conforme a escolha feita no menu;
4. **Ponteiros:** `i` procura um número grande demais para a esquerda e `j` procura um número que pode ir para a esquerda;
5. **Interação:** usar `E` ou `Espaço` perto das caixas;
6. **Conclusão:** posicionar cada pivô e continuar nos subarrays.

O jogador poderá avançar pelas telas, voltar ou pular o tutorial.

Durante a partida, pequenas mensagens contextuais reforçarão as regras. Assim, o tutorial não precisará explicar tudo antecipadamente.

---

## 15. HUD

O HUD será simples e permanecerá visível durante toda a fase.

Ele exibirá:

- nome do jogo ou da fase;
- objetivo atual;
- pivô atual;
- subarray ativo;
- pontuação;
- quantidade de erros;
- dica curta do controle de interação;
- botão **Como jogar**;
- botão **Reiniciar**.

Exemplo:

```text
FASE 1 — LINHA DE TRIAGEM
Objetivo: inspecione a caixa apontada por i
Pivô: 8 | Trecho: 0–5 | Pontos: 1000 | Erros: 0
```

---

## 16. Pontuação e erros

A pontuação terá função motivacional e não bloqueará o aprendizado.

Proposta inicial:

- pontuação inicial: `1000` pontos;
- inspeção correta: `+20` pontos;
- troca correta: `+50` pontos;
- pivô colocado corretamente: `+100` pontos;
- conclusão da fase: bônus de `+300` pontos;
- interação com caixa incorreta: `-40` pontos e um erro;
- tentativa de troca inválida: `-60` pontos e um erro;
- pontuação mínima: `0`.

O jogo nunca encerrará a fase por excesso de erros. A intenção é permitir experimentação e correção.

Quando ocorrer um erro:

- a ação inválida será recusada;
- a tela ou caixa piscará em vermelho;
- uma mensagem explicará o motivo;
- o estado correto do algoritmo será preservado;
- o jogador poderá tentar novamente imediatamente.

Exemplo de feedback:

```text
Essa caixa não está sendo apontada por i. Aproxime-se da caixa 12.
```

ou:

```text
Ainda não é hora de mover o pivô. Primeiro, troque as caixas apontadas por i e j.
```

---

## 17. Validação das ações

O jogo possuirá uma máquina de estados interna. Em cada momento, apenas as ações coerentes com o passo atual serão aceitas.

Estados principais:

1. `TUTORIAL` — entrada bloqueada ou limitada ao tutorial;
2. `INICIAR_PARTICAO` — destaca trecho, pivô e ponteiros;
3. `INSPECIONAR_I` — aguarda interação com a caixa de `i`;
4. `INSPECIONAR_J` — aguarda interação com a caixa de `j`;
5. `TROCAR_I_J` — permite selecionar somente as duas caixas indicadas;
6. `COLOCAR_PIVO` — permite trocar somente o pivô e a posição `j`;
7. `AVANCAR_RECURSAO` — marca o pivô e escolhe o próximo subarray;
8. `VITORIA` — bloqueia a partida e apresenta o resultado.

A validação deverá considerar:

- a caixa com que o personagem tentou interagir;
- o estado atual;
- os índices atuais de `i`, `j` e do pivô;
- a comparação numérica esperada;
- se a seleção de troca contém exatamente as posições permitidas;
- se os ponteiros já se cruzaram;
- se ainda existem subarrays pendentes.

Nenhum erro do jogador poderá corromper o vetor ou deixar a partida sem saída.

---

## 18. Progressão recursiva

Após a colocação de um pivô:

1. a posição final do pivô será marcada como concluída;
2. o subarray esquerdo será registrado, se tiver ao menos dois elementos;
3. o subarray direito será registrado, se tiver ao menos dois elementos;
4. trechos de tamanho zero serão ignorados;
5. trechos de tamanho um serão marcados automaticamente como concluídos;
6. o próximo trecho pendente será ativado;
7. uma nova caixa passará a ser o pivô por estar no início desse trecho.

A implementação usará uma pilha interna de subarrays para reproduzir o comportamento recursivo sem depender da pilha real de chamadas durante a interação do jogador.

Para manter uma ordem pedagógica, o lado esquerdo será resolvido antes do lado direito.

---

## 19. Condição de vitória

A fase será concluída quando:

- não houver mais subarrays pendentes com dois ou mais elementos;
- todas as posições estiverem marcadas como resolvidas;
- o vetor estiver em ordem crescente.

Na vitória:

- a esteira voltará a funcionar;
- as caixas serão iluminadas em verde;
- o robô fará uma animação simples de comemoração;
- partículas ou faíscas aparecerão;
- o vetor final será apresentado;
- a pontuação e os erros serão mostrados;
- uma mensagem resumirá o aprendizado;
- haverá opções para reiniciar ou jogar novamente.

Mensagem sugerida:

```text
Linha reativada!

Você posicionou cada pivô e ordenou todos os subarrays.
[1, 3, 5, 8, 10, 12]
```

---

## 20. Estados visuais das caixas

Cada caixa poderá assumir os seguintes estados:

- **normal:** pertence à área jogável, mas não exige ação imediata;
- **fora do subarray:** escurecida temporariamente;
- **pivô:** brilho dourado e placa `PIVÔ`;
- **apontada por i:** contorno ciano;
- **apontada por j:** contorno magenta;
- **selecionada:** elevada visualmente ou ligada ao robô por um feixe;
- **trocando:** animação de deslocamento entre duas posições;
- **posição definitiva:** selo ou base verde;
- **erro:** tremor e pulso vermelho;
- **ao alcance:** contorno branco discreto.

Caso uma caixa acumule mais de um estado, o jogo deverá combinar os indicadores sem ocultar o número.

---

## 21. Personagem

O personagem será um robô pequeno desenhado no Canvas com formas geométricas.

Ele terá:

- movimentação em quatro direções;
- orientação visual para esquerda ou direita;
- animação simples de caminhada;
- estado parado;
- pequeno efeito ao interagir;
- indicador quando estiver carregando ou selecionando uma caixa;
- colisão com os limites do cenário.

Não haverá combate, vida, inimigos ou plataformas complexas. O personagem existirá para transformar a execução do algoritmo em uma ação espacial.

---

## 22. Animações e feedback

As animações previstas para o MVP serão curtas e funcionais:

- caminhada do robô;
- movimentação suave dos ponteiros;
- balanço ou pulso do pivô;
- elevação da caixa selecionada;
- arco de movimento durante uma troca;
- tremor em uma ação inválida;
- feixe ou linha entre caixas selecionadas;
- travamento verde de uma posição concluída;
- movimento da esteira na vitória;
- partículas simples na conclusão.

Comparações importantes aparecerão brevemente sobre as caixas, por exemplo:

```text
3 ≤ 8 ✓
12 > 8 — pare aqui
```

Esse feedback fará a ligação entre a ação do jogador e a regra do algoritmo.

---

## 23. Áudio

O áudio será opcional no MVP e não dependerá de arquivos externos. Se incluído, poderá ser gerado com a Web Audio API.

Sons possíveis:

- passo mecânico suave;
- confirmação de inspeção;
- movimento de ponteiro;
- encaixe de caixa;
- alerta de erro;
- posicionamento do pivô;
- fanfarra curta de vitória.

O jogo deverá continuar totalmente compreensível sem som.

---

## 24. Responsividade e acessibilidade

O layout será otimizado para computador, pois os controles principais usam teclado. Ainda assim, deverá se adaptar a diferentes tamanhos de janela.

Requisitos:

- Canvas redimensionado mantendo proporção e legibilidade;
- números grandes e com alto contraste;
- instruções que não dependam apenas de cor;
- letras `i`, `j` e `PIVÔ` sempre visíveis;
- botões acessíveis pelo teclado;
- tutorial legível em telas menores;
- opção de fechar e reabrir o tutorial;
- pausa automática quando a janela perder o foco, se necessário;
- respeito à preferência de redução de movimento do sistema, reduzindo animações não essenciais.

Controles por toque não farão parte do escopo obrigatório do primeiro MVP.

---

## 25. Estrutura planejada do projeto

A pasta final deverá seguir uma estrutura simples:

```text
sort-factory/
├── index.html
├── style.css
├── game.js
└── README.md
```

Responsabilidades previstas:

### `index.html`

- estrutura da página;
- Canvas;
- HUD;
- tutorial;
- tela de vitória;
- botões de interface.

### `style.css`

- layout geral;
- aparência do HUD;
- modais;
- botões;
- adaptação para diferentes telas;
- estética industrial ao redor do Canvas.

### `game.js`

- ciclo de atualização e desenho;
- leitura do teclado;
- movimentação do personagem;
- renderização do cenário;
- caixas e animações;
- ponteiros;
- lógica de partição;
- validação das ações;
- subarrays pendentes;
- pontuação e erros;
- vitória e reinício.

### `README.md`

- como abrir e jogar;
- controles;
- resumo da regra do Quick Sort utilizada;
- limitações conhecidas do MVP.

Se a implementação crescer, o JavaScript poderá ser dividido em módulos, mas isso não será obrigatório para a primeira versão.

---

## 26. Fluxo de telas

### Tela inicial/tutorial

- título do jogo;
- breve contexto narrativo;
- instruções;
- botão **Iniciar missão**.

### Partida

- cenário 2D;
- personagem e caixas;
- HUD;
- objetivo atual;
- botões **Como jogar** e **Reiniciar**.

### Pausa de instrução

- pequena janela com a regra relevante;
- jogo congelado ao fundo;
- botão para continuar.

### Vitória

- resultado ordenado;
- pontuação;
- erros;
- mensagem de conclusão;
- botão **Jogar novamente**.

---

## 27. Tratamento de situações especiais

O jogo deverá lidar corretamente com:

- `i` avançando além do fim do subarray;
- `j` chegando ao início do subarray;
- ponteiros se encontrando exatamente na mesma posição;
- ponteiros se cruzando entre duas posições;
- pivô já estar na posição correta, exigindo uma confirmação visual sem troca perceptível;
- subarray com dois elementos;
- subarray com um elemento;
- cliques repetidos durante animações;
- tentativa de movimentação enquanto um modal está aberto;
- reinício durante qualquer etapa;
- perda de foco da janela;
- pressionamento simultâneo de teclas.

Durante animações críticas, novas interações serão temporariamente bloqueadas para evitar estados inconsistentes.

---

## 28. Critérios de aceitação do MVP

O MVP será considerado concluído quando todos os itens abaixo estiverem funcionando:

- [ ] abrir `index.html` inicia o jogo sem instalação;
- [ ] o cenário 2D de fábrica é exibido corretamente;
- [ ] o personagem se move com WASD e setas;
- [ ] as seis caixas aparecem em posições físicas;
- [ ] o número de cada caixa permanece legível;
- [ ] um menu inicial permite escolher o pivô no início ou no final;
- [ ] o menu permite selecionar caso médio, melhor caso ou pior caso;
- [ ] a vitória permite avançar para a próxima fase mantendo o pivô escolhido;
- [ ] cada fase explica o comportamento e a complexidade demonstrados;
- [ ] a extremidade escolhida do subarray atual é sempre marcada como pivô;
- [ ] os ponteiros `i` e `j` aparecem e mudam de posição corretamente;
- [ ] o jogador precisa se aproximar das caixas para interagir;
- [ ] as inspeções aplicam as comparações corretas;
- [ ] trocas corretas são aceitas e animadas;
- [ ] trocas incorretas são recusadas com explicação;
- [ ] o cruzamento dos ponteiros é detectado;
- [ ] o pivô é colocado na posição `j` na variante inicial ou em `i` na variante final;
- [ ] os subarrays seguintes são processados;
- [ ] subarrays de tamanho zero ou um são resolvidos automaticamente;
- [ ] a partida chega ao vetor ordenado esperado;
- [ ] a vitória é exibida somente após a ordenação completa;
- [ ] pontuação e erros são atualizados;
- [ ] o tutorial inicial funciona;
- [ ] o botão de reiniciar restaura completamente a fase;
- [ ] não há dependências externas;
- [ ] erros do jogador não deixam a partida travada.

---

## 29. Testes previstos

### Testes de lógica

- confirmar cada movimento de `i` e `j` na fase inicial;
- confirmar as trocas esperadas;
- verificar a posição final de cada pivô;
- verificar a ordem dos subarrays processados;
- validar o vetor final;
- testar todos os estados de erro;
- reiniciar em cada etapa possível.

### Testes de jogabilidade

- verificar se a distância de interação é confortável;
- confirmar que o objetivo atual é sempre compreensível;
- observar se o jogador distingue pivô, `i` e `j`;
- confirmar que a troca física não parece apenas uma alteração instantânea de números;
- verificar se o tutorial é suficiente para alguém que não conhece o algoritmo.

### Testes de navegador

- Chrome ou Chromium recente;
- Microsoft Edge recente;
- Firefox recente;
- diferentes tamanhos de janela;
- execução direta por `index.html` sem servidor local.

---

## 30. Itens fora do escopo do MVP

Não serão necessários nesta primeira versão:

- editor de vetores;
- números aleatórios;
- seleção de diferentes algoritmos;
- inimigos ou combate;
- história extensa;
- inventário;
- sistema de contas;
- salvamento online;
- ranking;
- multiplayer;
- arte externa complexa;
- suporte completo a dispositivos móveis;
- publicação em loja ou servidor;
- narração por voz;
- localização em vários idiomas.

Esses itens poderão ser avaliados somente depois que a mecânica principal estiver validada.

---

## 31. Possíveis expansões futuras

Após o MVP, o jogo poderá receber:

- novas fases com vetores maiores;
- números repetidos;
- valores negativos;
- limite de tempo opcional;
- dificuldade progressiva;
- modo livre com vetor personalizado;
- comparação pedagógica de custo entre as estratégias de pivô;
- desafios com menos dicas;
- mapa da fábrica;
- setores temáticos;
- conquistas;
- registro do número de movimentos;
- replay visual da solução;
- modo professor;
- explicação passo a passo após a fase;
- comparação do número de operações;
- outros algoritmos de ordenação como fases separadas.

Essas expansões não deverão influenciar o escopo ou atrasar a primeira versão jogável.

---

## 32. Prioridades de desenvolvimento futuro

Quando o desenvolvimento for autorizado, a ordem recomendada será:

1. implementar a lógica de partição e recursão de forma isolada;
2. criar o Canvas, cenário e posições das caixas;
3. implementar movimento e proximidade do personagem;
4. conectar inspeções às etapas de `i` e `j`;
5. implementar seleção e troca física das caixas;
6. implementar colocação do pivô e progressão dos subarrays;
7. criar HUD, pontuação e mensagens de erro;
8. adicionar tutorial e tela de vitória;
9. acrescentar animações e feedback visual;
10. testar a fase completa e corrigir situações de bloqueio;
11. revisar responsividade e acessibilidade;
12. preparar a pasta final e o README.

---

## 33. Resultado esperado

O resultado será um pequeno jogo 2D de navegador no qual o jogador não apenas observa o Quick Sort: ele **executa fisicamente cada decisão do algoritmo**.

A primeira fase deverá durar aproximadamente alguns minutos para um iniciante. Ao terminá-la, o jogador terá participado de todo o ciclo de partição, entendido a função dos ponteiros, colocado diferentes pivôs em suas posições definitivas e acompanhado a divisão recursiva do vetor até a ordenação completa.

O MVP será propositalmente compacto. Seu sucesso será medido pela clareza da mecânica, pela ausência de estados sem saída e pela capacidade de ensinar Quick Sort por meio da jogabilidade.
