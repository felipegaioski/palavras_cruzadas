import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Loader } from "../components/Loader";
import { ShutdownButton } from "../components/ShutdownButton";
import {
    KIND_LABELS,
    type CrosswordKind,
    type CrosswordSummary
} from "../../shared/types";

type SortMode =
    | "updated-desc"
    | "updated-asc"
    | "title-asc"
    | "title-desc"
    | "words-desc";
const PAGE_SIZE = 12;

export function HomePage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<CrosswordSummary[]>([]);
    const [search, setSearch] = useState("");
    const [kindFilter, setKindFilter] = useState<"all" | CrosswordKind>("all");
    const [sort, setSort] = useState<SortMode>("updated-desc");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [searchBusy, setSearchBusy] = useState(false);
    const [error, setError] = useState("");

    const load = async (term = search) => {
        try {
            if (!loading) setSearchBusy(true);
            setItems(await api.list(term));
            setError("");
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Nao foi possivel carregar suas cruzadas."
            );
        } finally {
            setLoading(false);
            setSearchBusy(false);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => void load(search), 250);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [search, kindFilter, sort]);

    const duplicate = async (id: number) => {
        const created = await api.duplicate(id);
        navigate(`/crosswords/${created.id}/edit`);
    };

    const remove = async (item: CrosswordSummary) => {
        if (
            !window.confirm(
                `Excluir "${item.title}"? Esta acao nao pode ser desfeita.`
            )
        ) {
            return;
        }
        await api.remove(item.id);
        await load();
    };

    const filteredItems = useMemo(() => {
        const result = items.filter(
            (item) => kindFilter === "all" || item.kind === kindFilter
        );
        result.sort((first, second) => {
            switch (sort) {
                case "updated-asc":
                    return (
                        new Date(first.updatedAt).getTime() -
                        new Date(second.updatedAt).getTime()
                    );
                case "title-asc":
                    return first.title.localeCompare(second.title, "pt-BR");
                case "title-desc":
                    return second.title.localeCompare(first.title, "pt-BR");
                case "words-desc":
                    return second.wordCount - first.wordCount;
                case "updated-desc":
                default:
                    return (
                        new Date(second.updatedAt).getTime() -
                        new Date(first.updatedAt).getTime()
                    );
            }
        });
        return result;
    }, [items, kindFilter, sort]);

    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const pageItems = filteredItems.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    return (
        <main className="home-page">
            <header className="home-hero">
                <div>
                    <p className="eyebrow">Atelie de Cruzadas</p>
                    <h1>Suas ideias, prontas para o papel.</h1>
                    <p>
                        Monte atividades no seu ritmo, guarde tudo com seguranca e imprima
                        quando estiver pronto.
                    </p>
                </div>
                <div className="hero-actions">
                    <Link to="/crosswords/create" className="primary-button">
                        + Nova cruzada
                    </Link>
                    <Link to="/word-bank" className="secondary-button">
                        Banco de palavras
                    </Link>
                    <ShutdownButton />
                </div>
            </header>

            <section className="library-section">
                <div className="section-heading">
                    <div>
                        <h2>Minhas cruzadas</h2>
                        <p className="muted">
                            {filteredItems.length} de {items.length} atividade(s)
                        </p>
                    </div>
                    <div className="library-actions">
                        <label className={`search-field ${searchBusy ? "is-busy" : ""}`}>
                            <span>Buscar</span>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Digite parte do titulo ou da resposta"
                            />
                        </label>
                        <label>
                            <span>Modo</span>
                            <select
                                value={kindFilter}
                                onChange={(event) =>
                                    setKindFilter(event.target.value as "all" | CrosswordKind)
                                }
                            >
                                <option value="all">Todos</option>
                                {Object.entries(KIND_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Ordenar</span>
                            <select
                                value={sort}
                                onChange={(event) => setSort(event.target.value as SortMode)}
                            >
                                <option value="updated-desc">Mais recentes</option>
                                <option value="updated-asc">Mais antigas</option>
                                <option value="title-asc">Titulo A-Z</option>
                                <option value="title-desc">Titulo Z-A</option>
                                <option value="words-desc">Mais palavras</option>
                            </select>
                        </label>
                        <Link to="/print" className="secondary-button">
                            Imprimir várias
                        </Link>
                        {/* <Link to="/word-bank" className="secondary-button">
              Banco de palavras
            </Link> */}
                    </div>
                </div>

                {error && <div className="notice error">{error}</div>}
                {loading ? (
                    <div className="empty-state">
                        <Loader label="Carregando suas cruzadas..." />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-illustration">A B C</div>
                        <h2>
                            {search || kindFilter !== "all"
                                ? "Nenhuma cruzada encontrada"
                                : "Sua primeira cruzada comeca aqui"}
                        </h2>
                        <p>
                            {search || kindFilter !== "all"
                                ? "Tente ajustar a busca ou o filtro de modo."
                                : "Crie uma grade e va preenchendo enunciados e respostas."}
                        </p>
                        {!search && kindFilter === "all" && (
                            <Link to="/crosswords/create" className="primary-button">
                                Criar primeira cruzada
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="crossword-cards">
                            {pageItems.map((item) => (
                                <article className="crossword-card" key={item.id}>
                                    <CrosswordCardPreview item={item} />
                                    <div className="card-body">
                                        <div className="card-topline">
                                            <span className="kind-badge">{KIND_LABELS[item.kind]}</span>
                                            <span>
                                                {item.rows} x {item.columns}
                                            </span>
                                        </div>
                                        <h3>{item.title}</h3>
                                        <p>
                                            {item.wordCount} palavra(s) - alterada em{" "}
                                            {new Intl.DateTimeFormat("pt-BR", {
                                                dateStyle: "short",
                                                timeStyle: "short"
                                            }).format(new Date(item.updatedAt))}
                                        </p>
                                        <div className="card-actions">
                                            <Link
                                                to={`/crosswords/${item.id}/edit`}
                                                className="primary-button compact"
                                            >
                                                Abrir
                                            </Link>
                                            <button onClick={() => void duplicate(item.id)}>
                                                Duplicar
                                            </button>
                                            <Link to={`/print?ids=${item.id}`}>Imprimir</Link>
                                            <button
                                                className="danger-link"
                                                onClick={() => void remove(item)}
                                            >
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                        {pageCount > 1 && (
                            <nav className="pagination" aria-label="Paginacao">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                                >
                                    Anterior
                                </button>
                                <span>
                                    Página {currentPage} de {pageCount}
                                </span>
                                <button
                                    disabled={currentPage === pageCount}
                                    onClick={() =>
                                        setPage((value) => Math.min(pageCount, value + 1))
                                    }
                                >
                                    Próxima
                                </button>
                            </nav>
                        )}
                    </>
                )}
            </section>
            <section className="footer">
                <div>
                    <p>
                        Desenvolvido por &nbsp;
                        <a href="https://github.com/felipegaioski" target="_blank" rel="noopener noreferrer">Felipe Gaioski</a>
                    </p>
                </div>
            </section>
        </main>
    );
}

function CrosswordCardPreview({ item }: { item: CrosswordSummary }) {
    const previewRows = Math.max(
        1,
        Math.min(
            6,
            item.rows,
            Math.max(
                1,
                ...item.previewAreas.map((area) => area.row + area.rowSpan)
            )
        )
    );
    return (
        <div
            className="card-preview"
            aria-hidden="true"
            style={{
                gridTemplateColumns: `repeat(${item.columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${previewRows}, minmax(0, 1fr))`
            }}
        >
            {item.previewAreas.length === 0
                ? Array.from({ length: Math.min(item.rows, 6) * item.columns }, (_, index) => (
                    <span key={index} className="preview-cell" />
                ))
                : item.previewAreas.map((area) => (
                    <span
                        key={area.id}
                        className={[
                            "preview-cell",
                            `kind-${area.kind}`,
                            area.diagonal ? "has-diagonal" : "",
                            area.letterBagSize >= 3 ? "has-letter-bag" : ""
                        ].join(" ")}
                        style={{
                            gridColumn: `${area.column + 1} / span ${area.columnSpan}`,
                            gridRow: `${area.row + 1} / span ${Math.min(
                                area.rowSpan,
                                previewRows - area.row
                            )}`
                        }}
                    >
                        {area.kind === "answer" ? area.content.slice(0, 2) : ""}
                    </span>
                ))}
        </div>
    );
}
