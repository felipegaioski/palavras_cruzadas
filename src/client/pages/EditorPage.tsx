import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Loader } from "../components/Loader";
import { CrosswordGrid, DirectResponseStrip } from "../components/CrosswordGrid";
import { ShutdownButton } from "../components/ShutdownButton";
import { useEditorStore } from "../store/editor";
import {
    DIRECTION_LABELS,
    DIRECTIONS,
    KIND_LABELS,
    type CellCoordinate,
    type Direction,
    type EditorTool,
    type WordBankEntry
} from "../../shared/types";
import { findAreaAt, wordState } from "../../shared/grid";
import { polygonToRectangle, textLikelyFits } from "../../shared/geometry";
import type { SplitOrientation } from "../../shared/geometry";

const TOOLS: Array<{ id: EditorTool; icon: string; label: string }> = [
    { id: "select", icon: "↖", label: "Selecionar" },
    { id: "answer", icon: "A", label: "Resposta" },
    { id: "clue", icon: "T", label: "Enunciado" },
    { id: "merge", icon: "▣", label: "Unir" },
    // { id: "divide", icon: "◇", label: "Dividir" },
    { id: "separate", icon: "▦", label: "Separar" },
    { id: "diagonal", icon: "╱", label: "Diagonal" },
    { id: "erase", icon: "×", label: "Apagar" }
];

const ZOOM_OPTIONS = [0.35, 0.4, 0.5, 0.6, 0.75, 1] as const;
const DEFAULT_ZOOM = 0.5;
const ZOOM_STORAGE_KEY = "crossword-editor-default-zoom";

export function EditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [sideTab, setSideTab] = useState<"properties" | "words">("properties");
    const [defaultZoom, setDefaultZoom] = useState(() => {
        if (typeof window === "undefined") return DEFAULT_ZOOM;
        const stored = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
        return ZOOM_OPTIONS.includes(stored as (typeof ZOOM_OPTIONS)[number])
            ? stored
            : DEFAULT_ZOOM;
    });
    const [zoom, setZoom] = useState(defaultZoom);
    const [zoomOptionsOpen, setZoomOptionsOpen] = useState(false);
    const [showDiagonals, setShowDiagonals] = useState(true);
    const [bankText, setBankText] = useState("");
    const [sourceCellEnabled, setSourceCellEnabled] = useState(false);
    const [sourceCellPicking, setSourceCellPicking] = useState(false);
    const [sourceCell, setSourceCell] = useState<CellCoordinate | null>(null);
    const [sourceCellError, setSourceCellError] = useState("");
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
        if (state.crossword) {
            setBankText(state.crossword.wordBank.join("\n"));
        }
    }, [state.crossword?.id]);

    useEffect(() => {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, String(defaultZoom));
    }, [defaultZoom]);

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
        return (
            <main className="loading-page">
                <Loader label="Preparando o editor..." size="lg" fullPage />
            </main>
        );
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
    const selectedRegion = selectedArea?.clueRegions.find(
        (region) => region.id === state.selectedRegionId
    ) ?? selectedArea?.clueRegions[0];

    const handleGridCellClick = (row: number, column: number) => {
        if (!sourceCellPicking) {
            state.applyToolAt(row, column);
            return;
        }
        if (
            !selectedArea ||
            !selectedRegion ||
            !sourceCellIsAdjacentToRegion(selectedArea, selectedRegion.polygon, {
                row,
                column
            })
        ) {
            setSourceCellError(
                "Escolha uma célula adjacente ao enunciado selecionado."
            );
            return;
        }
        const areaAtCell = findAreaAt(crossword.areas, row, column);
        if (
            !areaAtCell ||
            areaAtCell.kind === "clue" ||
            areaAtCell.rowSpan > 1 ||
            areaAtCell.columnSpan > 1
        ) {
            setSourceCellError("A célula de saída precisa ser uma célula simples.");
            return;
        }
        setSourceCell({ row, column });
        setSourceCellEnabled(true);
        setSourceCellPicking(false);
        setSourceCellError("");
    };

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
                    {crossword.kind === "diagonalless" && (
                        <button onClick={() => setShowDiagonals((value) => !value)}>
                            {showDiagonals ? "Ocultar diagonais" : "Mostrar diagonais"}
                        </button>
                    )}
                    <Link
                        to={`/print?ids=${crossword.id}`}
                        className="primary-button compact"
                    >
                        Imprimir
                    </Link>
                    <ShutdownButton compact />
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
                        <div className="canvas-controls">
                            <p>
                                {state.tool === "merge"
                                    ? "Escolha dois cantos para unir."
                                    : "Clique em um quadrado para editar."}
                            </p>
                            <div className="zoom-controls" aria-label="Zoom da grade">
                                <button
                                    onClick={() => setZoom((value) => Math.max(0.2, value - 0.1))}
                                    title="Diminuir zoom"
                                >
                                    −
                                </button>
                                <span>{Math.round(zoom * 100)}%</span>
                                <button
                                    onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))}
                                    title="Aumentar zoom"
                                >
                                    +
                                </button>
                                <button onClick={() => setZoom(defaultZoom)} title="Restaurar zoom" className="generic-button">
                                    &#8635;
                                </button>
                                <button
                                    className="zoom-options-toggle generic-button"
                                    onClick={() => setZoomOptionsOpen((value) => !value)}
                                    title="Mostrar opções de zoom"
                                    aria-expanded={zoomOptionsOpen}
                                >
                                    &#x2699;
                                    &nbsp;
                                    {!zoomOptionsOpen && <>&#10094;</>}
                                    {zoomOptionsOpen && <>&#10095;</>}
                                </button>
                                <div
                                    className={`zoom-default-panel ${zoomOptionsOpen ? "is-open" : ""}`}
                                    aria-hidden={!zoomOptionsOpen}
                                >
                                        <span>Padrão</span>
                                        <label className="zoom-default-picker">
                                            <select
                                                value={defaultZoom}
                                                onChange={(event) => {
                                                    const nextZoom = Number(event.target.value);
                                                    setDefaultZoom(nextZoom);
                                                    setZoom(nextZoom);
                                                }}
                                            >
                                                {ZOOM_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>
                                                        {Math.round(option * 100)}%
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                            </div>
                        </div>
                    </div>
                    {crossword.kind === "thematic" && (
                        <label className="theme-editor">
                            Tema
                            <input
                                value={crossword.themeDescription}
                                onChange={(event) =>
                                    state.updateMetadata({ themeDescription: event.target.value })
                                }
                                placeholder="Digite o tema"
                            />
                        </label>
                    )}
                    {crossword.kind === "directresponse" && (
                        <DirectResponseStrip crossword={crossword} showValues />
                    )}
                    <div className="grid-scroll">
                        <div className="grid-zoom" style={{ width: `${zoom * 100}%` }}>
                            <CrosswordGrid
                                crossword={crossword}
                                showAnswers={state.showAnswers}
                                selectedAreaId={state.selectedAreaId}
                                selectedRegionId={state.selectedRegionId}
                                selectedWordId={state.selectedWordId}
                                selectedSourceCell={sourceCell}
                                sourceCellPicking={sourceCellPicking}
                                tool={state.tool}
                                showDiagonals={
                                    crossword.kind === "diagonalless" ? showDiagonals : true
                                }
                                onCellClick={handleGridCellClick}
                                onRegionClick={state.selectArea}
                                onMoveDivider={state.moveRegionDivider}
                            />
                        </div>
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
                        <PropertiesPanel
                            selectedArea={selectedArea}
                            sourceCell={sourceCell}
                            sourceCellEnabled={sourceCellEnabled}
                            sourceCellPicking={sourceCellPicking}
                            sourceCellError={sourceCellError}
                            onSourceCellEnabledChange={(enabled) => {
                                setSourceCellEnabled(enabled);
                                if (!enabled) setSourceCell(null);
                            }}
                            onSourceCellChange={setSourceCell}
                            onSourceCellPickingChange={setSourceCellPicking}
                            onSourceCellErrorChange={setSourceCellError}
                        />
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
                    value={bankText}
                    onChange={(event) => {
                        const value = event.target.value;
                        setBankText(value);
                        state.updateWordBank(value.split(/\r?\n/));
                    }}
                    placeholder="Digite palavras aqui..."
                />
            </footer>
        </div>
    );
}

function sourceCellIsAdjacentToRegion(
    area: NonNullable<ReturnType<typeof useEditorStore.getState>["crossword"]>["areas"][number],
    polygon: Array<{ x: number; y: number }>,
    cell: CellCoordinate
): boolean {
    const rectangle = polygonToRectangle(polygon);
    if (!rectangle) return false;
    const bounds = {
        left: area.column + rectangle.left * area.columnSpan,
        right: area.column + rectangle.right * area.columnSpan,
        top: area.row + rectangle.top * area.rowSpan,
        bottom: area.row + rectangle.bottom * area.rowSpan
    };
    const cellBounds = {
        left: cell.column,
        right: cell.column + 1,
        top: cell.row,
        bottom: cell.row + 1
    };
    const verticalTouch =
        rangesOverlap(cellBounds.top, cellBounds.bottom, bounds.top, bounds.bottom) &&
        (nearlyEqual(cellBounds.right, bounds.left) ||
            nearlyEqual(cellBounds.left, bounds.right));
    const horizontalTouch =
        rangesOverlap(cellBounds.left, cellBounds.right, bounds.left, bounds.right) &&
        (nearlyEqual(cellBounds.bottom, bounds.top) ||
            nearlyEqual(cellBounds.top, bounds.bottom));
    return verticalTouch || horizontalTouch;
}

function rangesOverlap(
    firstStart: number,
    firstEnd: number,
    secondStart: number,
    secondEnd: number
): boolean {
    return firstStart < secondEnd && secondStart < firstEnd;
}

function nearlyEqual(first: number, second: number): boolean {
    return Math.abs(first - second) < 0.001;
}

function PropertiesPanel({
    selectedArea,
    sourceCell,
    sourceCellEnabled,
    sourceCellPicking,
    sourceCellError,
    onSourceCellEnabledChange,
    onSourceCellChange,
    onSourceCellPickingChange,
    onSourceCellErrorChange
}: {
    selectedArea: ReturnType<typeof useEditorStore.getState>["crossword"] extends infer _T
    ? NonNullable<ReturnType<typeof useEditorStore.getState>["crossword"]>["areas"][number] | undefined
    : never;
    sourceCell: CellCoordinate | null;
    sourceCellEnabled: boolean;
    sourceCellPicking: boolean;
    sourceCellError: string;
    onSourceCellEnabledChange: (enabled: boolean) => void;
    onSourceCellChange: (cell: CellCoordinate | null) => void;
    onSourceCellPickingChange: (picking: boolean) => void;
    onSourceCellErrorChange: (message: string) => void;
}) {
    const state = useEditorStore();
    const [divisionCount, setDivisionCount] = useState(2);
    const [divisionTexts, setDivisionTexts] = useState(["", ""]);
    const [divisionOrientation, setDivisionOrientation] =
        useState<SplitOrientation>("auto");
    const [divisionEnabled, setDivisionEnabled] = useState(false);
    const [answer, setAnswer] = useState("");
    const [bankSearch, setBankSearch] = useState("");
    const [bankEntries, setBankEntries] = useState<WordBankEntry[]>([]);
    const [bankLoading, setBankLoading] = useState(false);
    const [bankError, setBankError] = useState("");
    const [isWordBankOpen, setIsWordBankOpen] = useState(false);
    const [startSide, setStartSide] = useState<Direction>("right");
    const [endDirection, setEndDirection] = useState<Direction>("right");
    const [addingDirection, setAddingDirection] = useState(false);

    const crossword = state.crossword!;
    const selectedRegion = selectedArea?.clueRegions.find(
        (region) => region.id === state.selectedRegionId
    ) ?? selectedArea?.clueRegions[0];
    const regionWords = crossword.words.filter(
        (word) => word.clueRegionId === selectedRegion?.id
    );
    const existingWord = addingDirection
        ? undefined
        : regionWords.find((word) => word.id === state.selectedWordId) ??
        regionWords[0];
    const existingWordIndex = existingWord
        ? regionWords.findIndex((word) => word.id === existingWord.id)
        : -1;
    const regionWordCount = regionWords.length;
    const nextDirectResponseNumber =
        Math.max(
            0,
            ...crossword.areas.map((area) => area.directResponseNumber ?? 0)
        ) + 1;

    useEffect(() => {
        if (addingDirection) {
            setAnswer("");
            setStartSide("right");
            setEndDirection("right");
            onSourceCellEnabledChange(false);
            return;
        }

        setAnswer(existingWord?.answer ?? "");
        const arrow =
            selectedRegion?.arrows[existingWordIndex] ?? selectedRegion?.arrows[0];
        setStartSide(arrow?.startSide ?? "right");
        setEndDirection(arrow?.endDirection ?? existingWord?.direction ?? "right");
        onSourceCellChange(arrow?.sourceCell ?? null);
        onSourceCellPickingChange(false);
        onSourceCellErrorChange("");
        if (arrow?.sourceCell) {
            onSourceCellEnabledChange(true);
            onSourceCellPickingChange(false);
        } else {
            onSourceCellEnabledChange(false);
        }
    }, [
        addingDirection,
        selectedRegion?.id,
        selectedRegion?.arrows,
        existingWord?.answer,
        existingWordIndex
    ]);

    useEffect(() => {
        setAddingDirection(false);
    }, [selectedRegion?.id]);

    useEffect(() => {
        setIsWordBankOpen(false);
        setBankSearch("");
    }, [selectedRegion?.id]);

    useEffect(() => {
        setDivisionEnabled((selectedArea?.clueRegions.length ?? 0) > 1);
        setDivisionCount(2);
        setDivisionTexts(["", ""]);
        setDivisionOrientation("auto");
    }, [selectedArea?.id]);

    const loadBankEntries = async (term = bankSearch) => {
        setBankLoading(true);
        try {
            setBankEntries(await api.listWordBank(term));
            setBankError("");
        } catch (requestError) {
            setBankError(
                requestError instanceof Error
                    ? requestError.message
                    : "Nao foi possivel carregar o banco de palavras."
            );
        } finally {
            setBankLoading(false);
        }
    };

    useEffect(() => {
        if (selectedArea?.kind !== "clue") return;
        if (!isWordBankOpen || !bankSearch.trim()) {
            setBankEntries([]);
            setBankLoading(false);
            return;
        }
        const timer = window.setTimeout(() => void loadBankEntries(bankSearch), 200);
        return () => window.clearTimeout(timer);
    }, [bankSearch, isWordBankOpen, selectedArea?.kind]);

    const saveAnswerToBank = async () => {
        if (!answer.trim()) return;
        try {
            await api.createWordBankEntry(answer);
            setBankSearch(answer.trim());
            await loadBankEntries(answer.trim());
        } catch (requestError) {
            setBankError(
                requestError instanceof Error
                    ? requestError.message
                    : "Nao foi possivel salvar a palavra."
            );
        }
    };

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
                        ? "Área de enunciado"
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
                    {crossword.kind === "syllabic"
                        ? "Sílaba"
                        : selectedArea.letterBagSize >= 3
                            ? "Letras"
                            : selectedArea.diagonal
                                ? "Duas letras"
                                : "Letra"}
                    <input
                        autoFocus
                        maxLength={
                            crossword.kind === "syllabic"
                                ? 5
                                : selectedArea.letterBagSize >= 3
                                    ? selectedArea.letterBagSize
                                    : selectedArea.diagonal
                                        ? 2
                                        : 1
                        }
                        value={selectedArea.content}
                        onChange={(event) =>
                            state.updateAreaContent(selectedArea.id, event.target.value)
                        }
                    />
                </label>
            )}

            {selectedArea.kind === "answer" && crossword.kind === "letterbag" && (
                <section className="property-section">
                    <label className="division-toggle">
                        <span>
                            <strong>Bolsão de letras</strong>
                            <small>
                                {selectedArea.letterBagSize >= 3
                                    ? `${selectedArea.letterBagSize} letras`
                                    : "Desativado"}
                            </small>
                        </span>
                        <input
                            type="checkbox"
                            checked={selectedArea.letterBagSize >= 3}
                            onChange={(event) =>
                                state.updateAreaLetterBagSize(
                                    selectedArea.id,
                                    event.target.checked ? 3 : 0
                                )
                            }
                        />
                    </label>
                    {selectedArea.letterBagSize >= 3 && (
                        <label>
                            Quantidade de letras
                            <input
                                type="number"
                                min={3}
                                max={12}
                                value={selectedArea.letterBagSize}
                                onChange={(event) =>
                                    state.updateAreaLetterBagSize(
                                        selectedArea.id,
                                        Number(event.target.value)
                                    )
                                }
                            />
                        </label>
                    )}
                </section>
            )}

            {selectedArea.kind === "answer" && crossword.kind === "directresponse" && (
                <section className="property-section">
                    <label className="division-toggle">
                        <span>
                            <strong>Letra-resposta</strong>
                            <small>
                                {selectedArea.directResponseNumber
                                    ? `Número ${selectedArea.directResponseNumber}`
                                    : "Desativada"}
                            </small>
                        </span>
                        <input
                            type="checkbox"
                            checked={Boolean(selectedArea.directResponseNumber)}
                            onChange={(event) =>
                                state.updateAreaDirectResponseNumber(
                                    selectedArea.id,
                                    event.target.checked ? nextDirectResponseNumber : null
                                )
                            }
                        />
                    </label>
                    {selectedArea.directResponseNumber && (
                        <label>
                            Número da letra
                            <input
                                type="number"
                                min={1}
                                max={99}
                                value={selectedArea.directResponseNumber}
                                onChange={(event) =>
                                    state.updateAreaDirectResponseNumber(
                                        selectedArea.id,
                                        Number(event.target.value)
                                    )
                                }
                            />
                        </label>
                    )}
                </section>
            )}

            {selectedArea.kind === "clue" && selectedRegion && (
                <>
                    {crossword.kind === "thematic" && (
                        <label className="division-toggle">
                            <span>
                                <strong>Temática</strong>
                                <small>{selectedRegion.isThematic ? "Ativa" : "Desativada"}</small>
                            </span>
                            <input
                                type="checkbox"
                                checked={selectedRegion.isThematic}
                                onChange={(event) =>
                                    state.updateRegionThematic(
                                        selectedRegion.id,
                                        event.target.checked
                                    )
                                }
                            />
                        </label>
                    )}
                    <label>
                        Texto do enunciado
                        <textarea
                            disabled={selectedRegion.isThematic}
                            value={selectedRegion.isThematic ? "" : selectedRegion.content}
                            onChange={(event) =>
                                state.updateRegionContent(selectedRegion.id, event.target.value)
                            }
                            rows={4}
                            placeholder="Digite a pergunta ou definição"
                        />
                    </label>
                    <label>
                        Reduzir tamanho do texto
                        <div className="text-scale-control">
                            <input
                                type="range"
                                min={60}
                                max={120}
                                step={5}
                                value={selectedRegion.textScale ?? 100}
                                onChange={(event) =>
                                    state.updateRegionTextScale(
                                        selectedRegion.id,
                                        Number(event.target.value)
                                    )
                                }
                            />
                            <span>{selectedRegion.textScale ?? 100}%</span>
                            <button
                                type="button"
                                onClick={() =>
                                    state.updateRegionTextScale(selectedRegion.id, 100)
                                }
                            >
                                Padrão
                            </button>
                        </div>
                    </label>
                    {!selectedRegion.isThematic && !textLikelyFits(
                        selectedRegion.content,
                        selectedRegion.polygon,
                        selectedArea.columnSpan * 56,
                        selectedArea.rowSpan * 56
                    ) && (
                            <div className="fit-warning">
                                O texto está apertado. Aumente a área, reduza o enunciado ou redistribua
                                as divisões.
                            </div>
                        )}
                    {crossword.kind === "diagonalless" && (
                        <label>
                            Quantidade de letras
                            <input
                                type="number"
                                min={0}
                                max={99}
                                value={selectedRegion.answerLength}
                                onChange={(event) =>
                                    state.updateRegionAnswerLength(
                                        selectedRegion.id,
                                        Number(event.target.value)
                                    )
                                }
                            />
                        </label>
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
                        <div className="word-bank-picker">
                            <div className="word-bank-picker-heading">
                                <button
                                    type="button"
                                    className="word-bank-toggle"
                                    onClick={() => setIsWordBankOpen((value) => !value)}
                                    aria-expanded={isWordBankOpen}
                                >
                                    <strong>Banco de palavras</strong>
                                    <span>{isWordBankOpen ? "▾" : "▸"}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void saveAnswerToBank()}
                                    disabled={!answer.trim()}
                                >
                                    Salvar resposta
                                </button>
                            </div>
                            {isWordBankOpen ? (
                                <>
                                    <input
                                        value={bankSearch}
                                        onChange={(event) => setBankSearch(event.target.value)}
                                        placeholder="Pesquisar palavra salva"
                                    />
                                    {bankError && <small className="error-text">{bankError}</small>}
                                    {bankSearch.trim() ? (
                                        <div className="word-bank-options">
                                            {bankLoading ? (
                                                <Loader label="Carregando palavras..." size="sm" />
                                            ) : bankEntries.length === 0 ? (
                                                <span>Nenhuma palavra encontrada.</span>
                                            ) : (
                                                bankEntries.slice(0, 8).map((entry) => (
                                                    <button
                                                        key={entry.id}
                                                        type="button"
                                                        className="word-bank-option"
                                                        onClick={() => setAnswer(entry.word)}
                                                    >
                                                        <strong>{entry.word}</strong>
                                                        <small>{entry.used ? "Usada" : "Não usada"}</small>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    ) : null}
                                </>
                            ) : null}
                        </div>
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
                        <label className="division-toggle">
                            <span>
                                <strong>Célula de saída</strong>
                                <small>
                                    {sourceCellEnabled && sourceCell
                                        ? `Linha ${sourceCell.row + 1}, coluna ${sourceCell.column + 1}`
                                        : sourceCellPicking
                                            ? "Clique na grade"
                                            : "Automática"}
                                </small>
                            </span>
                            <input
                                type="checkbox"
                                checked={sourceCellEnabled}
                                onChange={(event) => {
                                    const enabled = event.target.checked;
                                    onSourceCellEnabledChange(enabled);
                                    onSourceCellPickingChange(enabled);
                                    onSourceCellErrorChange(
                                        enabled
                                            ? "Clique na grade para escolher a célula de saída."
                                            : ""
                                    );
                                }}
                            />
                        </label>
                        {sourceCellEnabled && (
                            <div className="source-cell-picker">
                                <span>{sourceCellError}</span>
                                {sourceCell && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSourceCellChange(null);
                                            onSourceCellPickingChange(true);
                                            onSourceCellErrorChange(
                                                "Clique na grade para escolher a célula de saída."
                                            );
                                        }}
                                    >
                                        Escolher outra célula
                                    </button>
                                )}
                            </div>
                        )}
                        <button
                            className="primary-button full"
                            disabled={sourceCellEnabled && !sourceCell}
                            onClick={() => {
                                state.upsertWord(
                                    selectedRegion.id,
                                    answer,
                                    startSide,
                                    endDirection,
                                    sourceCellEnabled ? sourceCell : null,
                                    existingWord?.id
                                );
                                setAddingDirection(false);
                            }}
                        >
                            {existingWord ? "Atualizar palavra" : "Criar palavra"}
                        </button>
                        {existingWord && (
                            <div className="button-stack">
                                {/* <button
                  className="secondary-button full"
                  onClick={() => {
                    setAddingDirection(true);
                    setAnswer("");
                    setStartSide("right");
                    setEndDirection("right");
                  }}
                >
                  Adicionar outra direção
                </button> */}
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
                                Este enunciado possui {regionWordCount} respostas e setas.
                            </small>
                        )}
                    </section>

                    <section className="property-section">
                        <label className="division-toggle">
                            <span>
                                <strong>Divisão da área</strong>
                                <small>
                                    {divisionEnabled ? "Ativa" : "Desativada"}
                                </small>
                            </span>
                            <input
                                type="checkbox"
                                checked={divisionEnabled}
                                onChange={(event) => setDivisionEnabled(event.target.checked)}
                            />
                        </label>
                        {divisionEnabled && selectedArea.clueRegions.length === 1 ? (
                            <>
                                <label>
                                    Quantidade de enunciados
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
                                        Enunciado {index + 1}
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
                                    Dividir área
                                </button>
                            </>
                        ) : divisionEnabled ? (
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
                        ) : null}
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
                    <p>Selecione um enunciado e informe sua resposta.</p>
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
                                    <small>{region?.content || "Enunciado sem texto"}</small>
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
