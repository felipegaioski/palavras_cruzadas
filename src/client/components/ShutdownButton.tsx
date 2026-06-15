import { useState } from "react";

export function ShutdownButton({ compact = false }: { compact?: boolean }) {
  const [closing, setClosing] = useState(false);

  const shutdown = async () => {
    if (
      !window.confirm(
        "Encerrar o Ateliê de Cruzadas? O servidor será desligado."
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      await fetch("/api/shutdown", { method: "POST", keepalive: true });
    } catch {
      // A conexão pode cair antes da resposta porque o servidor foi encerrado.
    }
    window.setTimeout(() => {
      window.close();
      document.body.innerHTML = `
        <main class="shutdown-page">
          <h1>Aplicação encerrada</h1>
          <p>Você já pode fechar esta aba.</p>
        </main>
      `;
    }, 350);
  };

  return (
    <button
      className={`shutdown-button ${compact ? "compact" : ""}`}
      onClick={() => void shutdown()}
      disabled={closing}
    >
      {closing ? "Encerrando..." : "Encerrar aplicação"}
    </button>
  );
}
