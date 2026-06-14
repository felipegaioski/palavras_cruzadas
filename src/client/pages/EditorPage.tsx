import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { CrosswordGrid } from "../components/CrosswordGrid";
import { useEditorStore } from "../store/editor";
import {
  DIRECTION_LABELS,
  DIRECTIONS,
  KIND_LABELS,
  type Direction,
  type EditorTool
} from "../../shared/types";
import { wordState } from "../../shared/grid";
import { textLikelyFits } from "../../shared/geometry";
import type { SplitOrientation } from "../../shared/geometry";

const TOOLS: Array<{ id: EditorTool; icon: string; label: string }> = [
  { id: "select", icon: "↖", label: "Selecionar" },
  { id: "answer", icon: "A", label: "Resposta" },
  { id: "clue", icon: "T", label: "Dica" },
  { id: "merge", icon: "▣", label: "Unir" },
  { id: "divide", icon: "◇", label: "Dividir" },
  { id: "separate", icon: "▦", label: "Separar" },
  { id: "arrow", icon: "→", label: "Seta" },
  { id: "diagonal", icon: "╱", label: "Diagonal" },
  { id: "erase", icon: "×", label: "Apagar" }
];

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sideTab, setSideTab] = useState<"properties" | "words">("properties");
  const state = useEditorStore();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(Number(id))
      .then(state.load)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!state.dirty || !state.crossword) return;
    const snapshot = state.crossword;
    const timer = window.setTimeout(async () => {
      state.markSaving();
      try {
        const saved = await api.save(snapshot);
        if (useEditorStore.getState().crossword === snapshot) {
          state.markSaved(saved);
        }
      } catch (error) {
        state.markSaveError(
          error instanceof Error ? error.message : "Erro ao salvar."
        );
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state.crossword, state.dirty]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!useEditorStore.getState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? state.redo() : state.undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
      }
      if (event.key === "Escape") state.setTool("select");
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);

  if (loading) {
    return <main className="loading-page">Preparando o editor...</main>;
  }
  if (loadError || !state.crossword) {
    return (
      <main className="centered-page">
        <section className="form-card">
          <h1>Não foi possível abrir</h1>
          <p>{loadError}</p>
          <Link to="/" className="primary-button">
            Voltar
          </Link>
        </section>
      </main>
    );
  }

  const crossword = state.crossword;
  const selectedArea = crossword.areas.find(
    (area) => area.id === state.selectedAreaId
  );

  const resize = () => {
    const rows = Number(
      window.prompt("Quantidade de linhas (5 a 30):", String(crossword.rows))
    );
    if (!rows) return;
    const columns = Number(
      window.prompt(
        "Quantidade de colunas (5 a 30):",
        String(crossword.columns)
      )
    );
    if (!columns) return;
    const removesData = crossword.areas.some(
      (area) =>
        (area.row + area.rowSpan > rows ||
          area.column + area.columnSpan > columns) &&
        (area.kind !== "empty" || area.content)
    );
    if (
      removesData &&
      !window.confirm("A redução removerá conteúdo fora da nova grade. Continuar?")
    ) {
      return;
    }
    state.resizeGrid(rows, columns);
  };

  return (
    <div className="editor-shell">
      <header className="editor-header">
        <button
          className="icon-button"
          title="Voltar"
          onClick={() => navigate("/")}
        >
          ←
        </button>
        <div className="title-editor">
          <input
            aria-label="Título da cruzada"
            value={crossword.title}
            onChange={(event) =>
              state.updateMetadata({ title: event.target.value })
            }
          />
          <span className={`save-state ${state.saveState}`}>
            {state.saveState === "saved"
              ? "Salvo"
              : state.saveState === "saving"
                ? "Salvando..."
                : "Erro ao salvar"}
          </span>
        </div>
        <div className="header-actions">
          <button
            onClick={state.undo}
            disabled={!state.past.length}
            title="Desfazer (Ctrl+Z)"
          >
            ↶ Desfazer
          </button>
          <button
            onClick={state.redo}
            disabled={!state.future.length}
            title="Refazer (Ctrl+Y)"
          >
            ↷ Refazer
          </button>
          <button onClick={resize}>Tamanho</button>
          <button onClick={state.toggleAnswers}>
            {state.showAnswers ? "Ocultar respostas" : "Mostrar respostas"}
          </button>
          <Link
            to={`/print?ids=${crossword.id}`}
            className="primary-button compact"
          >
            Imprimir
          </Link>
        </div>
      </header>

      <nav className="editor-toolbar" aria-label="Ferramentas do editor">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            className={state.tool === tool.id ? "is-active" : ""}
            onClick={() => state.setTool(tool.id)}
            aria-pressed={state.tool === tool.id}
          >
            <span>{tool.icon}</span>
            {tool.label}
          </button>
        ))}
      </nav>

      {state.message && (
        <div className="editor-message" role="status">
          <span>{state.message}</span>
          <button onClick={state.clearMessage} aria-label="Fechar mensagem">
            ×
          </button>
        </div>
      )}

      <main className="editor-main">
        <section className="canvas-panel">
          <div className="canvas-heading">
            <div>
              <span className="kind-badge">{KIND_LABELS[crossword.kind]}</span>
              <span>
                {crossword.rows} × {crossword.columns}
              </span>
            </div>
            <p>
              {state.tool === "merge"
                ? "Escolha dois cantos para unir."
                : "Clique em um quadrado para editar."}
            </p>
          </div>
          <div className="grid-scroll">
            <CrosswordGrid
              crossword={crossword}
              showAnswers={state.showAnswers}
              selectedAreaId={state.selectedAreaId}
              selectedRegionId={state.selectedRegionId}
              selectedWordId={state.selectedWordId}
              tool={state.tool}
              onCellClick={state.applyToolAt}
              onRegionClick={state.selectArea}
              onMoveDivider={state.moveRegionDivider}
            />
          </div>
        </section>

        <aside className="side-panel">
          <div className="side-tabs">
            <button
              className={sideTab === "properties" ? "is-active" : ""}
              onClick={() => setSideTab("properties")}
            >
              Propriedades
            </button>
            <button
              className={sideTab === "words" ? "is-active" : ""}
              onClick={() => setSideTab("words")}
            >
              Palavras <span>{crossword.words.length}</span>
            </button>
          </div>
          {sideTab === "properties" ? (
            <PropertiesPanel selectedArea={selectedArea} />
          ) : (
            <WordsPanel />
          )}
        </aside>
      </main>

      <footer className="word-bank-editor">
        <div>
          <strong>Banco de palavras</strong>
          <span>Uma resposta por linha. Na impressão, elas ficam de ponta-cabeça.</span>
        </div>
        <textarea
          aria-label="Banco de palavras"
          value={crossword.wordBank.join("\n")}
          onChange={(event) =>
            state.updateWordBank(event.target.value.split(/\r?\n/))
          }
          placeholder="Digite palavras aqui..."
        />
      </footer>
    </div>
  );
}

function PropertiesPanel({
  selectedArea
}: {
  selectedArea: ReturnType<typeof useEditorStore.getState>["crossword"] extends infer _T
    ? NonNullable<ReturnType<typeof useEditorStore.getState>["crossword"]>["areas"][number] | undefined
    : never;
}) {
  const state = useEditorStore();
  const [divisionCount, setDivisionCount] = useState(2);
  const [divisionTexts, setDivisionTexts] = useState(["", ""]);
  const [divisionOrientation, setDivisionOrientation] =
    useState<SplitOrientation>("auto");
  const [answer, setAnswer] = useState("");
  const [startSide, setStartSide] = useState<Direction>("right");
  const [endDirection, setEndDirection] = useState<Direction>("right");

  const crossword = state.crossword!;
  const selectedRegion = selectedArea?.clueRegions.find(
    (region) => region.id === state.selectedRegionId
  ) ?? selectedArea?.clueRegions[0];
  const existingWord = crossword.words.find(
    (word) =>
      word.id === state.selectedWordId &&
      word.clueRegionId === selectedRegion?.id
  );
  const regionWordCount = crossword.words.filter(
    (word) => word.clueRegionId === selectedRegion?.id
  ).length;

  useEffect(() => {
    setAnswer(existingWord?.answer ?? "");
    const arrow = selectedRegion?.arrows[0];
    setStartSide(arrow?.startSide ?? "right");
    setEndDirection(arrow?.endDirection ?? existingWord?.direction ?? "right");
  }, [selectedRegion?.id, existingWord?.answer]);

  if (!selectedArea) {
    return (
      <div className="panel-empty">
        <strong>Nada selecionado</strong>
        <p>Escolha uma ferramenta e clique na grade.</p>
      </div>
    );
  }

  return (
    <div className="panel-content">
      <div className="selection-summary">
        <span>
          Linha {selectedArea.row + 1}, coluna {selectedArea.column + 1}
        </span>
        <strong>
          {selectedArea.kind === "clue"
            ? "Área de dica"
            : selectedArea.kind === "answer"
              ? "Resposta"
              : "Área vazia"}
        </strong>
        <span>
          {selectedArea.rowSpan} × {selectedArea.columnSpan} quadrado(s)
        </span>
      </div>

      {selectedArea.kind === "answer" && (
        <label>
          {crossword.kind === "syllabic" ? "Sílaba" : "Letra"}
          <input
            autoFocus
            maxLength={crossword.kind === "syllabic" ? 5 : 1}
            value={selectedArea.content}
            onChange={(event) =>
              state.updateAreaContent(selectedArea.id, event.target.value)
            }
          />
        </label>
      )}

      {selectedArea.kind === "clue" && selectedRegion && (
        <>
          <label>
            Texto da dica
            <textarea
              value={selectedRegion.content}
              onChange={(event) =>
                state.updateRegionContent(selectedRegion.id, event.target.value)
              }
              rows={4}
              placeholder="Digite a pergunta ou definição"
            />
          </label>
          {!textLikelyFits(
            selectedRegion.content,
            selectedRegion.polygon,
            selectedArea.columnSpan * 56,
            selectedArea.rowSpan * 56
          ) && (
            <div className="fit-warning">
              O texto está apertado. Aumente a área, reduza a dica ou redistribua
              as divisões.
            </div>
          )}
          {selectedArea.clueRegions.length > 1 && (
            <div className="region-picker">
              <span>Parte selecionada</span>
              <div>
                {selectedArea.clueRegions.map((region, index) => (
                  <button
                    key={region.id}
                    className={
                      region.id === selectedRegion.id ? "is-active" : ""
                    }
                    onClick={() =>
                      state.selectArea(selectedArea.id, region.id)
                    }
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <small>
                Arraste as alças azuis para ajustar cada divisão na horizontal
                ou vertical.
              </small>
            </div>
          )}

          <section className="property-section">
            <h3>Resposta e seta</h3>
            <label>
              Resposta
              <input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={
                  crossword.kind === "syllabic"
                    ? "Res - pos - ta"
                    : "Resposta"
                }
              />
            </label>
            <div className="form-row">
              <label>
                Saída
                <select
                  value={startSide}
                  onChange={(event) =>
                    setStartSide(event.target.value as Direction)
                  }
                >
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {DIRECTION_LABELS[direction]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Direção
                <select
                  value={endDirection}
                  onChange={(event) =>
                    setEndDirection(event.target.value as Direction)
                  }
                >
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {DIRECTION_LABELS[direction]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="primary-button full"
              onClick={() =>
                state.upsertWord(
                  selectedRegion.id,
                  answer,
                  startSide,
                  endDirection,
                  existingWord?.id
                )
              }
            >
              {existingWord ? "Atualizar palavra" : "Criar palavra"}
            </button>
            {existingWord && (
              <div className="button-stack">
                <button
                  className="secondary-button full"
                  onClick={() => {
                    state.selectArea(selectedArea.id, selectedRegion.id);
                    setAnswer("");
                  }}
                >
                  Adicionar outra direção
                </button>
                <button
                  className="danger-link"
                  onClick={() => state.removeWord(existingWord.id)}
                >
                  Remover esta palavra
                </button>
              </div>
            )}
            {regionWordCount > 1 && (
              <small className="muted">
                Esta dica possui {regionWordCount} respostas e setas.
              </small>
            )}
          </section>

          <section className="property-section">
            <h3>Divisão da área</h3>
            {selectedArea.clueRegions.length === 1 ? (
              <>
                <label>
                  Quantidade de dicas
                  <select
                    value={divisionCount}
                    onChange={(event) => {
                      const count = Number(event.target.value);
                      setDivisionCount(count);
                      setDivisionTexts((current) =>
                        Array.from(
                          { length: count },
                          (_, index) => current[index] ?? ""
                        )
                      );
                    }}
                  >
                    {[2, 3, 4, 5, 6].map((count) => (
                      <option key={count}>{count}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Orientação da primeira divisão
                  <select
                    value={divisionOrientation}
                    onChange={(event) =>
                      setDivisionOrientation(
                        event.target.value as SplitOrientation
                      )
                    }
                  >
                    <option value="auto">Automática</option>
                    <option value="vertical">Lado a lado</option>
                    <option value="horizontal">Uma em cima da outra</option>
                  </select>
                </label>
                {divisionTexts.map((text, index) => (
                  <label key={index}>
                    Dica {index + 1}
                    <textarea
                      rows={2}
                      value={text}
                      onChange={(event) =>
                        setDivisionTexts((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index ? event.target.value : value
                          )
                        )
                      }
                    />
                  </label>
                ))}
                <button
                  className="secondary-button full"
                  onClick={() =>
                    state.divideArea(
                      selectedArea.id,
                      divisionTexts.slice(0, divisionCount),
                      divisionOrientation
                    )
                  }
                >
                  Dividir automaticamente
                </button>
              </>
            ) : (
              <div className="button-stack">
                <label>
                  Redistribuir com orientação
                  <select
                    value={divisionOrientation}
                    onChange={(event) =>
                      setDivisionOrientation(
                        event.target.value as SplitOrientation
                      )
                    }
                  >
                    <option value="auto">Automática</option>
                    <option value="vertical">Lado a lado</option>
                    <option value="horizontal">Uma em cima da outra</option>
                  </select>
                </label>
                <button
                  className="secondary-button full"
                  onClick={() =>
                    state.redistributeRegions(
                      selectedArea.id,
                      divisionOrientation
                    )
                  }
                >
                  Redistribuir automaticamente
                </button>
                <button
                  className="danger-link"
                  onClick={() => state.undoDivision(selectedArea.id)}
                >
                  Desfazer divisão
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function WordsPanel() {
  const state = useEditorStore();
  const crossword = state.crossword!;
  const [sort, setSort] = useState<"position" | "alphabetical">("position");
  const words = useMemo(() => {
    const result = [...crossword.words];
    if (sort === "alphabetical") {
      result.sort((a, b) => a.answer.localeCompare(b.answer, "pt-BR"));
    } else {
      result.sort((a, b) => {
        const firstA = a.cells[0] ?? { row: 999, column: 999 };
        const firstB = b.cells[0] ?? { row: 999, column: 999 };
        return firstA.row - firstB.row || firstA.column - firstB.column;
      });
    }
    return result;
  }, [crossword.words, sort]);

  return (
    <div className="panel-content">
      <label>
        Ordenar por
        <select
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as "position" | "alphabetical")
          }
        >
          <option value="position">Posição na grade</option>
          <option value="alphabetical">Ordem alfabética</option>
        </select>
      </label>
      {words.length === 0 ? (
        <div className="panel-empty">
          <strong>Nenhuma palavra ainda</strong>
          <p>Selecione uma dica e informe sua resposta.</p>
        </div>
      ) : (
        <div className="word-list">
          {words.map((word) => {
            const region = crossword.areas
              .flatMap((area) => area.clueRegions)
              .find((item) => item.id === word.clueRegionId);
            const status = wordState(word, crossword);
            return (
              <button
                key={word.id}
                className={[
                  "word-item",
                  state.selectedWordId === word.id ? "is-active" : ""
                ].join(" ")}
                onClick={() => state.selectWord(word.id)}
              >
                <span className={`status-dot ${status}`} />
                <span>
                  <strong>{word.answer}</strong>
                  <small>{region?.content || "Dica sem texto"}</small>
                </span>
                <span className="word-meta">
                  {DIRECTION_LABELS[word.direction]} · {word.cells.length}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
