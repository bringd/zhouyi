import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import { favoriteHexagrams } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { Env } from "../types.js";

/** Favorites routes. Session required. */

const addSchema = z.object({
  hexagramId: z.number().int().min(1).max(64),
  note: z.string().max(500).optional(),
});

export const favoritesRouter = new Hono<{
  Bindings: Env;
  Variables: { userId: string };
}>();

favoritesRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      400,
    );
  }
  const id = crypto.randomUUID();
  const db = getDb(c.env.DB);
  try {
    await db.insert(favoriteHexagrams).values({
      id,
      userId: c.get("userId"),
      hexagramId: parsed.data.hexagramId,
      note: parsed.data.note ?? null,
      createdAt: new Date(),
    });
  } catch (err: unknown) {
    // SQLite unique violation
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      return c.json({ error: "AlreadyFavorited" }, 409);
    }
    throw err;
  }
  return c.json({ id }, 201);
});

favoritesRouter.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(favoriteHexagrams)
    .where(eq(favoriteHexagrams.userId, c.get("userId")))
    .orderBy(desc(favoriteHexagrams.createdAt));
  return c.json({ favorites: rows });
});

favoritesRouter.delete("/:hexagramId", async (c) => {
  const hexagramId = parseInt(c.req.param("hexagramId"), 10);
  if (Number.isNaN(hexagramId) || hexagramId < 1 || hexagramId > 64) {
    return c.json({ error: "InvalidHexagramId" }, 400);
  }
  const db = getDb(c.env.DB);
  const deleted = await db
    .delete(favoriteHexagrams)
    .where(
      and(
        eq(favoriteHexagrams.userId, c.get("userId")),
        eq(favoriteHexagrams.hexagramId, hexagramId),
      ),
    )
    .returning({ hexagramId: favoriteHexagrams.hexagramId });
  if (!deleted[0]) return c.json({ error: "FavoriteNotFound" }, 404);
  return c.body(null, 204);
});
