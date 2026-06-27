import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Loader } from "../components/Loader";
import type { WordBankEntry } from "../../shared/types";

export function WordBankPage() {
  const [items, setItems] = useState<WordBankEntry[]>([]);
  const [search, setSearch] = useState("");
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async (term = search) => {
    try {
      if (!loading) setSearchBusy(true);
      setItems(await api.listWordBank(term));
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel carregar o banco de palavras."
      );
    } finally {
      setLoading(false);
      setSearchBusy(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const usedCount = useMemo(
    () => items.filter((item) => item.used).length,
    [items]
  );

  const addWord = async () => {
    if (!word.trim()) return;
    try {
      await api.createWordBankEntry(word);
      setWord("");
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nao foi possivel salvar a palavra."
      );
    }
  };

  const removeWord = async (entry: WordBankEntry) => {
    if (!window.confirm(`Remover "${entry.word}" do banco de palavras?`)) {
      return;
    }
    await api.removeWordBankEntry(entry.id);
    await load();
  };

  return (
    <main className="word-bank-page">
      <header className="word-bank-header">
        <div>
          <Link to="/" className="back-link">
            Voltar
          </Link>
          <p className="eyebrow">Banco de palavras</p>
          <h1>Palavras para reutilizar nas cruzadas.</h1>
          <p>
            {items.length} palavra(s) encontrada(s), {usedCount} ja usada(s).
          </p>
        </div>
      </header>

      <section className="word-bank-tools">
        <label className={searchBusy ? "is-busy" : ""}>
        Buscar
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite parte da palavra"
        />
        </label>
        <label>
        Nova palavra
        <input
            value={word}
            onChange={(event) => setWord(event.target.value)}
            onKeyDown={(event) => {
            if (event.key === "Enter") void addWord();
            }}
            placeholder="Digite a palavra"
        />
        </label>
        <button className="primary-button" onClick={() => void addWord()}>
          Salvar palavra
        </button>
      </section>

      {error && <div className="notice error">{error}</div>}
      {loading ? (
        <div className="empty-state">
          <Loader label="Carregando palavras..." />
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>Nenhuma palavra encontrada</h2>
          <p>Adicione palavras para seleciona-las depois no editor.</p>
        </div>
      ) : (
        <section className="word-bank-list">
          {items.map((entry) => (
            <article className="word-bank-row" key={entry.id}>
              <strong>{entry.word}</strong>
              <span className={`usage-badge ${entry.used ? "used" : ""}`}>
                {entry.used ? "Usada" : "Não usada"}
              </span>
              <small>
                Salva em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short"
                }).format(new Date(entry.createdAt))}
              </small>
              <button
                className="danger-link"
                onClick={() => void removeWord(entry)}
              >
                Remover
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
