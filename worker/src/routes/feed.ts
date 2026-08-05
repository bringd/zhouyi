import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db/client";
import { sharedPosts, sharedReplies, users } from "../db/schema";
import { eq, sql, desc, asc } from "drizzle-orm";
import type { Env } from "../types.js";

/**
 * Community feed routes.
 *
 *  - GET    /api/feed            list (newest first, paginated)
 *  - POST   /api/feed            publish a new post (requires session)
 *  - GET    /api/feed/:id        one post + its replies + author nickname
 *  - POST   /api/feed/:id/replies  add a reply (requires session)
 *
 * Session is provided by the parent router's sessionMiddleware.
 */

const publishSchema = z.object({
  mainHexagramId: z.number().int().min(1).max(64),
  changedHexagramId: z.number().int().min(1).max(64),
  movingLine: z.number().int().min(1).max(6),
  question: z.string().max(500).optional(),
  aiSummary: z.string().max(1000).optional(),
  note: z.string().max(500).optional(),
});

const replySchema = z.object({
  content: z.string().min(1).max(500),
});

export const feedRouter = new Hono<{
  Bindings: Env;
  Variables: { userId: string; sessionId: string };
}>();

/** GET /api/feed — paginated list of shared posts (newest first) */
feedRouter.get("/", async (c) => {
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") ?? "20", 10) || 20, 1),
    50,
  );
  const offset = Math.max(parseInt(c.req.query("offset") ?? "0", 10) || 0, 0);
  const db = getDb(c.env.DB);

  // Join users to attach author nickname; left-join so the post shows
  // up even if the user row is missing (shouldn't happen but be safe).
  const rows = await db
    .select({
      id: sharedPosts.id,
      mainHexagramId: sharedPosts.mainHexagramId,
      changedHexagramId: sharedPosts.changedHexagramId,
      movingLine: sharedPosts.movingLine,
      question: sharedPosts.question,
      aiSummary: sharedPosts.aiSummary,
      note: sharedPosts.note,
      replyCount: sharedPosts.replyCount,
      createdAt: sharedPosts.createdAt,
      authorId: users.id,
      authorNickname: users.nickname,
    })
    .from(sharedPosts)
    .leftJoin(users, eq(users.id, sharedPosts.userId))
    .orderBy(desc(sharedPosts.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ posts: rows, limit, offset });
});

/** POST /api/feed — publish a new post */
feedRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      400,
    );
  }
  const {
    mainHexagramId,
    changedHexagramId,
    movingLine,
    question,
    aiSummary,
    note,
  } = parsed.data;

  const id = crypto.randomUUID();
  const now = new Date();
  const db = getDb(c.env.DB);
  await db.insert(sharedPosts).values({
    id,
    userId: c.get("userId"),
    mainHexagramId,
    changedHexagramId,
    movingLine,
    question: question ?? null,
    aiSummary: aiSummary ?? null,
    note: note ?? null,
    replyCount: 0,
    createdAt: now,
  });

  return c.json({ id, createdAt: now.toISOString() }, 201);
});

/** GET /api/feed/:id — one post + all replies, with author nicknames */
feedRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env.DB);

  const postRow = await db
    .select({
      id: sharedPosts.id,
      mainHexagramId: sharedPosts.mainHexagramId,
      changedHexagramId: sharedPosts.changedHexagramId,
      movingLine: sharedPosts.movingLine,
      question: sharedPosts.question,
      aiSummary: sharedPosts.aiSummary,
      note: sharedPosts.note,
      replyCount: sharedPosts.replyCount,
      createdAt: sharedPosts.createdAt,
      authorId: users.id,
      authorNickname: users.nickname,
    })
    .from(sharedPosts)
    .leftJoin(users, eq(users.id, sharedPosts.userId))
    .where(eq(sharedPosts.id, id))
    .limit(1);

  const post = postRow[0];
  if (!post) return c.json({ error: "PostNotFound" }, 404);

  const replies = await db
    .select({
      id: sharedReplies.id,
      content: sharedReplies.content,
      createdAt: sharedReplies.createdAt,
      authorId: users.id,
      authorNickname: users.nickname,
    })
    .from(sharedReplies)
    .leftJoin(users, eq(users.id, sharedReplies.userId))
    .where(eq(sharedReplies.postId, id))
    .orderBy(asc(sharedReplies.createdAt));

  return c.json({ post, replies });
});

/** POST /api/feed/:id/replies — add a reply (increments reply_count) */
feedRouter.post("/:id/replies", async (c) => {
  const postId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "ValidationError", details: parsed.error.flatten() },
      400,
    );
  }
  const db = getDb(c.env.DB);

  // Verify post exists; 404 if not (avoid silent increments).
  const exists = await db
    .select({ id: sharedPosts.id })
    .from(sharedPosts)
    .where(eq(sharedPosts.id, postId))
    .limit(1);
  if (!exists[0]) return c.json({ error: "PostNotFound" }, 404);

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(sharedReplies).values({
    id,
    postId,
    userId: c.get("userId"),
    content: parsed.data.content,
    createdAt: now,
  });
  // denormalized counter — keep in sync atomically
  await db
    .update(sharedPosts)
    .set({ replyCount: sql`${sharedPosts.replyCount} + 1` })
    .where(eq(sharedPosts.id, postId));

  return c.json({ id, createdAt: now.toISOString() }, 201);
});
