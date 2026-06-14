import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  KIND_LABELS,
  type CrosswordSummary
} from "../../shared/types";

export function HomePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CrosswordSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (term = search) => {
    try {
      setItems(await api.list(term));
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar suas cruzadas."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const duplicate = async (id: number) => {
    const created = await api.duplicate(id);
    navigate(`/crosswords/${created.id}/edit`);
  };

  const remove = async (item: CrosswordSummary) => {
    if (!window.confirm(`Excluir “${item.title}”? Esta ação não pode ser desfeita.`)) {
      return;
    }
    await api.remove(item.id);
    await load();
  };

  return (
    <main className="home-page">
      <header className="home-hero">
        <div>
          <p className="eyebrow">Ateliê de Cruzadas</p>
          <h1>Suas ideias, prontas para o papel.</h1>
          <p>
            Monte atividades no seu ritmo, guarde tudo com segurança e imprima
            quando estiver pronto.
          </p>
        </div>
        <Link to="/crosswords/create" className="primary-button">
          + Nova cruzada
        </Link>
      </header>

      <section className="library-section">
        <div className="section-heading">
          <div>
            <h2>Minhas cruzadas</h2>
            <p className="muted">{items.length} atividade(s) encontrada(s)</p>
          </div>
          <div className="library-actions">
            <label className="search-field">
              <span>Buscar</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite parte do título"
              />
            </label>
            <Link to="/print" className="secondary-button">
              Imprimir várias
            </Link>
          </div>
        </div>

        {error && <div className="notice error">{error}</div>}
        {loading ? (
          <div className="empty-state">Carregando suas cruzadas...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration">A B C</div>
            <h2>{search ? "Nenhum título encontrado" : "Sua primeira cruzada começa aqui"}</h2>
            <p>
              {search
                ? "Tente buscar por outro nome."
                : "Crie uma grade e vá preenchendo dicas e respostas."}
            </p>
            {!search && (
              <Link to="/crosswords/create" className="primary-button">
                Criar primeira cruzada
              </Link>
            )}
          </div>
        ) : (
          <div className="crossword-cards">
            {items.map((item) => (
              <article className="crossword-card" key={item.id}>
                <div className="card-preview" aria-hidden="true">
                  {Array.from({ length: 35 }, (_, index) => (
                    <span key={index} className={index % 7 === 0 ? "clue" : ""} />
                  ))}
                </div>
                <div className="card-body">
                  <div className="card-topline">
                    <span className="kind-badge">{KIND_LABELS[item.kind]}</span>
                    <span>
                      {item.rows} × {item.columns}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.wordCount} palavra(s) · alterada em{" "}
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
                    <button className="danger-link" onClick={() => void remove(item)}>
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
