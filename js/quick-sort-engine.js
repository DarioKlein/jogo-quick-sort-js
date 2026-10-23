(function initializeQuickSortEngine(namespace) {
  "use strict";

  const { GameState, INITIAL_ARRAY, INITIAL_SCORE } = namespace.Constants;
  const { isSorted } = namespace.Utils;

  class QuickSortEngine {
    constructor(initialValues = INITIAL_ARRAY) {
      this.initialValues = [...initialValues];
      this.listeners = new Set();
      this.reset();
    }

    reset() {
      this.values = [...this.initialValues];
      this.score = INITIAL_SCORE;
      this.errors = 0;
      this.resolved = new Set();
      this.pendingSegments = [{ start: 0, end: this.values.length - 1 }];
      this.segment = null;
      this.pivotIndex = null;
      this.pivotValue = null;
      this.i = null;
      this.j = null;
      this.state = null;
      this.selected = null;
      this.message = "Sistema reiniciado. Localize o primeiro ponteiro.";
      this.comparison = null;
      this._startNextSegment();
      this._emit();
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    inspect(index) {
      if (this.state !== GameState.INSPECT_I && this.state !== GameState.INSPECT_J) {
        return this._reject("Ainda não é hora de inspecionar. Siga a ação indicada no painel.");
      }

      const pointerName = this.state === GameState.INSPECT_I ? "i" : "j";
      const expectedIndex = pointerName === "i" ? this.i : this.j;

      if (index !== expectedIndex) {
        return this._reject(
          `Essa caixa não está sendo apontada por ${pointerName}. Aproxime-se da posição ${expectedIndex + 1}.`,
        );
      }

      const currentValue = this.values[index];
      this.score += 20;

      if (pointerName === "i") {
        const canAdvance = currentValue <= this.pivotValue;
        this.comparison = {
          text: `${currentValue} ${canAdvance ? "≤" : ">"} ${this.pivotValue} ${canAdvance ? "✓" : "— pare aqui"}`,
          index,
          correct: true,
          timestamp: performance.now(),
        };

        if (canAdvance) {
          this.i += 1;
          this.message = `${currentValue} pode permanecer à esquerda. O ponteiro i avançou.`;
          if (this.i > this.segment.end) {
            this.state = GameState.INSPECT_J;
            this.message += " Agora inspecione o ponteiro j.";
          }
        } else {
          this.state = GameState.INSPECT_J;
          this.message = `${currentValue} é maior que o pivô. i parou; agora inspecione j.`;
        }
      } else {
        const mustRetreat = currentValue > this.pivotValue;
        this.comparison = {
          text: `${currentValue} ${mustRetreat ? ">" : "≤"} ${this.pivotValue} ${mustRetreat ? "✓" : "— pare aqui"}`,
          index,
          correct: true,
          timestamp: performance.now(),
        };

        if (mustRetreat) {
          this.j -= 1;
          this.message = `${currentValue} deve ficar à direita. O ponteiro j recuou.`;
          if (this.j <= this.segment.start) {
            this._evaluatePointers();
          }
        } else {
          this.message = `${currentValue} pode ir para a esquerda. O ponteiro j parou.`;
          this._evaluatePointers();
        }
      }

      this._emit();
      return { ok: true, type: "inspection" };
    }

    selectForSwap(index) {
      if (this.state !== GameState.SWAP_I_J && this.state !== GameState.PLACE_PIVOT) {
        return this._reject("Esta caixa não pode ser selecionada neste momento.", 40);
      }

      const pair = this.state === GameState.SWAP_I_J
        ? [this.i, this.j]
        : [this.pivotIndex, this.j];
      const allowed = new Set(pair);

      if (!allowed.has(index)) {
        return this._reject("Troca inválida. Selecione somente as duas caixas destacadas.", 60);
      }

      if (pair[0] === pair[1]) {
        this.selected = index;
        this._emit();
        return { ok: true, type: "swap-requested", a: index, b: index, pivot: true };
      }

      if (this.selected === null) {
        this.selected = index;
        this.message = "Primeira caixa selecionada. Vá até a outra caixa destacada.";
        this._emit();
        return { ok: true, type: "selected", index };
      }

      if (this.selected === index) {
        this.selected = null;
        this.message = "Seleção cancelada. Escolha uma das caixas destacadas.";
        this._emit();
        return { ok: true, type: "deselected", index };
      }

      const first = this.selected;
      this.selected = null;
      this._emit();
      return {
        ok: true,
        type: "swap-requested",
        a: first,
        b: index,
        pivot: this.state === GameState.PLACE_PIVOT,
      };
    }

    completeSwap(a, b) {
      if (this.state !== GameState.SWAP_I_J && this.state !== GameState.PLACE_PIVOT) {
        return { ok: false };
      }

      const isPivotPlacement = this.state === GameState.PLACE_PIVOT;
      [this.values[a], this.values[b]] = [this.values[b], this.values[a]];

      if (isPivotPlacement) {
        const finalPivotIndex = this.j;
        this.resolved.add(finalPivotIndex);
        this.score += 100;
        this.message = `Pivô ${this.pivotValue} fixado na posição ${finalPivotIndex + 1}.`;
        this._queueChildren(this.segment.start, finalPivotIndex, this.segment.end);
        this._startNextSegment();
      } else {
        this.score += 50;
        this.i += 1;
        this.j -= 1;
        this.state = GameState.INSPECT_I;
        this.message = "Troca concluída. Continue a busca com o ponteiro i.";

        if (this.i > this.segment.end) {
          this.state = GameState.INSPECT_J;
        }
      }

      this._emit();
      return { ok: true, pivot: isPivotPlacement };
    }

    getObjective() {
      switch (this.state) {
        case GameState.INSPECT_I:
          return `Inspecione a caixa apontada por i (posição ${this.i + 1}).`;
        case GameState.INSPECT_J:
          return `Inspecione a caixa apontada por j (posição ${this.j + 1}).`;
        case GameState.SWAP_I_J:
          return `Troque as caixas apontadas por i e j (posições ${this.i + 1} e ${this.j + 1}).`;
        case GameState.PLACE_PIVOT:
          return this.pivotIndex === this.j
            ? "Confirme o pivô: ele já está na posição correta."
            : `Troque o pivô com a caixa na posição ${this.j + 1}.`;
        case GameState.VICTORY:
          return "Linha reativada — todas as caixas estão ordenadas!";
        default:
          return "Preparando a linha de triagem…";
      }
    }

    getSnapshot() {
      return {
        values: [...this.values],
        score: this.score,
        errors: this.errors,
        resolved: new Set(this.resolved),
        pendingSegments: this.pendingSegments.map((segment) => ({ ...segment })),
        segment: this.segment ? { ...this.segment } : null,
        pivotIndex: this.pivotIndex,
        pivotValue: this.pivotValue,
        i: this.i,
        j: this.j,
        state: this.state,
        selected: this.selected,
        message: this.message,
        comparison: this.comparison ? { ...this.comparison } : null,
        objective: this.getObjective(),
      };
    }

    _evaluatePointers() {
      if (this.i >= this.j) {
        this.state = GameState.PLACE_PIVOT;
        this.message = "Os ponteiros se encontraram ou cruzaram. Posicione o pivô em j.";
      } else {
        this.state = GameState.SWAP_I_J;
        this.message = "Os dois ponteiros pararam. Troque as caixas destacadas.";
      }
    }

    _queueChildren(start, pivotIndex, end) {
      const left = { start, end: pivotIndex - 1 };
      const right = { start: pivotIndex + 1, end };

      this._registerSegment(right);
      this._registerSegment(left);
    }

    _registerSegment(segment) {
      const length = segment.end - segment.start + 1;
      if (length <= 0) return;
      if (length === 1) {
        this.resolved.add(segment.start);
        return;
      }
      this.pendingSegments.push(segment);
    }

    _startNextSegment() {
      if (this.pendingSegments.length === 0) {
        this.values.forEach((_, index) => this.resolved.add(index));
        if (!isSorted(this.values)) {
          throw new Error("Estado inválido: a pilha terminou antes da ordenação do vetor.");
        }
        this.segment = null;
        this.pivotIndex = null;
        this.pivotValue = null;
        this.i = null;
        this.j = null;
        this.state = GameState.VICTORY;
        this.score += 300;
        this.message = "Todas as posições foram resolvidas. Linha reativada!";
        return;
      }

      this.segment = this.pendingSegments.pop();
      this.pivotIndex = this.segment.start;
      this.pivotValue = this.values[this.pivotIndex];
      this.i = this.segment.start + 1;
      this.j = this.segment.end;
      this.selected = null;
      this.state = GameState.INSPECT_I;
      this.message = `Novo trecho: posições ${this.segment.start + 1}–${this.segment.end + 1}. Pivô ${this.pivotValue}.`;
    }

    _reject(message, penalty = 40) {
      this.score = Math.max(0, this.score - penalty);
      this.errors += 1;
      this.message = message;
      this.comparison = {
        text: "AÇÃO RECUSADA",
        index: null,
        correct: false,
        timestamp: performance.now(),
      };
      this._emit();
      return { ok: false, type: "error", message };
    }

    _emit() {
      const snapshot = this.getSnapshot();
      this.listeners.forEach((listener) => listener(snapshot));
    }
  }

  namespace.QuickSortEngine = QuickSortEngine;
})(window.SortFactory || (window.SortFactory = {}));
