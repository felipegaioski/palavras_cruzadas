import type {
  CreateCrosswordInput,
  Crossword,
  CrosswordSummary,
  WordBankEntry
} from "../shared/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Não foi possível concluir a operação.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  list(search = "") {
    return request<CrosswordSummary[]>(
      `/api/crosswords?search=${encodeURIComponent(search)}`
    );
  },
  get(id: number) {
    return request<Crossword>(`/api/crosswords/${id}`);
  },
  create(input: CreateCrosswordInput) {
    return request<Crossword>("/api/crosswords", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  save(crossword: Crossword) {
    return request<Crossword>(`/api/crosswords/${crossword.id}`, {
      method: "PUT",
      body: JSON.stringify(crossword)
    });
  },
  duplicate(id: number) {
    return request<Crossword>(`/api/crosswords/${id}/duplicate`, {
      method: "POST"
    });
  },
  remove(id: number) {
    return request<void>(`/api/crosswords/${id}`, { method: "DELETE" });
  },
  listWordBank(search = "") {
    return request<WordBankEntry[]>(
      `/api/word-bank?search=${encodeURIComponent(search)}`
    );
  },
  createWordBankEntry(word: string) {
    return request<WordBankEntry>("/api/word-bank", {
      method: "POST",
      body: JSON.stringify({ word })
    });
  },
  removeWordBankEntry(id: number) {
    return request<void>(`/api/word-bank/${id}`, { method: "DELETE" });
  },
  shutdown() {
    return request<{ ok: boolean }>("/api/shutdown", { method: "POST" });
  }
};
