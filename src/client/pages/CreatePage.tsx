import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { CrosswordKind } from "../../shared/types";

export function CreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CrosswordKind>("direct");
  const [rows, setRows] = useState(15);
  const [columns, setColumns] = useState(10);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const crossword = await api.create({ title, kind, rows, columns });
      navigate(`/crosswords/${crossword.id}/edit`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível criar a cruzada."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="centered-page">
      <section className="form-card">
        <Link to="/" className="back-link">
          Voltar para minhas cruzadas
        </Link>
        <p className="eyebrow">Nova atividade</p>
        <h1>Comece uma cruzada</h1>
        <p className="muted">
          Dê um nome e escolha o formato. Você poderá ajustar tudo no editor.
        </p>
        <form onSubmit={submit} className="stack-form">
          <label>
            Título
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Diretas de junho"
            />
          </label>
          <fieldset>
            <legend>Tipo</legend>
            <div className="choice-grid">
              {(
                [
                  ["direct", "Direta", "Uma letra por quadrado"],
                  ["syllabic", "Silábica", "Uma sílaba por quadrado"],
                  ["arrowless", "Sem setas", "Enunciados sem indicação visual"],
                  ["thematic", "Temática", "Alguns enunciados viram tema"],
                  ["diagonalless", "Sem diagonal", "Mostra a quantidade de letras"],
                  ["directresponse", "Direta resposta", "Forma uma palavra final"],
                  ["letterbag", "Bolsão de letras", "Células com três ou mais letras"]
                ] as const
              ).map(([value, label, help]) => (
                <label
                  className={`choice-card ${kind === value ? "is-active" : ""}`}
                  key={value}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                  />
                  <strong>{label}</strong>
                  <span>{help}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-row">
            <label>
              Linhas
              <input
                type="number"
                min={5}
                max={30}
                value={rows}
                onChange={(event) => setRows(Number(event.target.value))}
              />
            </label>
            <label>
              Colunas
              <input
                type="number"
                min={5}
                max={30}
                value={columns}
                onChange={(event) => setColumns(Number(event.target.value))}
              />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={submitting}>
            {submitting ? "Criando..." : "Criar e abrir editor"}
          </button>
        </form>
      </section>
    </main>
  );
}
