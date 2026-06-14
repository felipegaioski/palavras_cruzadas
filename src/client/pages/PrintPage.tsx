import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { CrosswordGrid } from "../components/CrosswordGrid";
import {
  KIND_LABELS,
  type Crossword,
  type CrosswordSummary
} from "../../shared/types";

type PrintMode = "activity" | "answer";
type Orientation = "portrait" | "landscape";
type PerPage = 1 | 2 | 4;

export function PrintPage() {
  const [params] = useSearchParams();
  const initialIds = params
    .get("ids")
    ?.split(",")
    .map(Number)
    .filter(Boolean) ?? [];
  const [items, setItems] = useState<CrosswordSummary[]>([]);
  const [selected, setSelected] = useState<number[]>(initialIds);
  const [crosswords, setCrosswords] = useState<Crossword[]>([]);
  const [mode, setMode] = useState<PrintMode>("activity");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [perPage, setPerPage] = useState<PerPage>(1);
  const [error, setError] = useState("");

  useEffect(() => {
    api.list().then(setItems).catch((requestError: Error) => setError(requestError.message));
  }, []);

  useEffect(() => {
    Promise.all(selected.map((id) => api.get(id)))
      .then(setCrosswords)
      .catch((requestError: Error) => setError(requestError.message));
  }, [selected.join(",")]);

  const pages = useMemo(() => {
    const result: Crossword[][] = [];
    for (let index = 0; index < crosswords.length; index += perPage) {
      result.push(crosswords.slice(index, index + perPage));
    }
    return result;
  }, [crosswords, perPage]);

  return (
    <div className={`print-screen orientation-${orientation}`}>
      <header className="print-header no-print">
        <div>
          <Link to="/" className="back-link">
            Voltar
          </Link>
          <h1>Preparar impressão</h1>
          <p>Escolha as atividades e confira como ficarão no papel.</p>
        </div>
        <button
          className="primary-button"
          disabled={!crosswords.length}
          onClick={() => window.print()}
        >
          Imprimir / Salvar em PDF
        </button>
      </header>

      <div className="print-layout">
        <aside className="print-settings no-print">
          <section>
            <h2>1. Cruzadas</h2>
            <div className="print-selection-list">
              {items.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id)
                      )
                    }
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {KIND_LABELS[item.kind]} · {item.rows} × {item.columns}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h2>2. Conteúdo</h2>
            <label className="radio-line">
              <input
                type="radio"
                name="mode"
                checked={mode === "activity"}
                onChange={() => setMode("activity")}
              />
              Atividade sem respostas
            </label>
            <label className="radio-line">
              <input
                type="radio"
                name="mode"
                checked={mode === "answer"}
                onChange={() => setMode("answer")}
              />
              Gabarito com respostas
            </label>
          </section>
          <section>
            <h2>3. Página</h2>
            <label>
              Orientação
              <select
                value={orientation}
                onChange={(event) =>
                  setOrientation(event.target.value as Orientation)
                }
              >
                <option value="portrait">Retrato</option>
                <option value="landscape">Paisagem</option>
              </select>
            </label>
            <label>
              Cruzadas por página
              <select
                value={perPage}
                onChange={(event) =>
                  setPerPage(Number(event.target.value) as PerPage)
                }
              >
                <option value={1}>1 por página</option>
                <option value={2}>2 por página</option>
                <option value={4}>4 por página</option>
              </select>
            </label>
          </section>
          {error && <div className="notice error">{error}</div>}
        </aside>

        <main className={`print-preview per-page-${perPage}`}>
          {pages.length ? (
            pages.map((page, pageIndex) => (
              <section className="paper-page" key={pageIndex}>
                {page.map((crossword) => (
                  <article className="print-crossword" key={crossword.id}>
                    <header>
                      <div>
                        <span>{KIND_LABELS[crossword.kind]}</span>
                        <h2>{crossword.title}</h2>
                      </div>
                      <small>Nome: ______________________________</small>
                    </header>
                    <CrosswordGrid
                      crossword={crossword}
                      showAnswers={mode === "answer"}
                      readOnly
                    />
                    {crossword.wordBank.length > 0 && (
                      <footer className="printed-bank">
                        <strong>BANCO</strong>
                        <span>
                          {crossword.wordBank.join(" · ")}
                        </span>
                      </footer>
                    )}
                  </article>
                ))}
              </section>
            ))
          ) : (
            <div className="empty-state no-print">
              <h2>Escolha ao menos uma cruzada</h2>
              <p>A pré-visualização aparecerá aqui.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
