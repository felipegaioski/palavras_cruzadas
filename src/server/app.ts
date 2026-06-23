import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type {
  CreateCrosswordInput,
  CreateWordBankEntryInput,
  Crossword
} from "../shared/types.js";
import {
  createCrossword,
  createWordBankEntry,
  deleteCrossword,
  deleteWordBankEntry,
  duplicateCrossword,
  getCrossword,
  listCrosswords,
  listWordBankEntries,
  saveCrossword
} from "./repository.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 5 * 1024 * 1024
  });

  app.get("/api/health", async () => ({ ok: true }));
  app.post("/api/shutdown", async (_request, reply) => {
    await reply.send({ ok: true });
    setTimeout(() => {
      void app.close().finally(() => process.exit(0));
    }, 700);
  });
  app.get("/api/crosswords", async (request) => {
    const query = request.query as { search?: string };
    return listCrosswords(query.search);
  });
  app.get("/api/word-bank", async (request) => {
    const query = request.query as { search?: string };
    return listWordBankEntries(query.search);
  });
  app.post("/api/word-bank", async (request, reply) => {
    const body = request.body as CreateWordBankEntryInput;
    return reply.code(201).send(createWordBankEntry(body.word));
  });
  app.delete("/api/word-bank/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteWordBankEntry(Number(id));
    return reply.code(204).send();
  });
  app.get("/api/crosswords/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getCrossword(Number(id));
  });
  app.post("/api/crosswords", async (request, reply) => {
    const created = createCrossword(request.body as CreateCrosswordInput);
    return reply.code(201).send(created);
  });
  app.put("/api/crosswords/:id", async (request) => {
    const { id } = request.params as { id: string };
    return saveCrossword(Number(id), request.body as Crossword);
  });
  app.post("/api/crosswords/:id/duplicate", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.code(201).send(duplicateCrossword(Number(id)));
  });
  app.delete("/api/crosswords/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteCrossword(Number(id));
    return reply.code(204).send();
  });
  app.post("/api/print/preview", async (request) => {
    const body = request.body as {
      ids: number[];
      mode: "activity" | "answer";
      perPage: 1 | 2 | 4;
      orientation: "portrait" | "landscape";
    };
    return {
      ...body,
      crosswords: body.ids.map(getCrossword)
    };
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.message.includes("não encontrada") ? 404 : 400;
    reply.code(statusCode).send({
      error: error.message || "Não foi possível concluir a operação."
    });
  });

  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    app.register(fastifyStatic, {
      root: distPath,
      wildcard: false
    });
    app.setNotFoundHandler((_request, reply) => {
      reply.sendFile("index.html");
    });
  }

  return app;
}
