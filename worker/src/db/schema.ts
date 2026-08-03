import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

/**
 * D1 (Cloudflare Workers SQLite) schema for zhouyi.
 *
 * Conventions:
 * - `id` is always a text UUID generated application-side via crypto.randomUUID().
 *   D1/SQLite has no native UUID; using text keeps it portable.
 * - Timestamps are stored as `integer` with Drizzle's `timestamp` mode
 *   (JS Date <-> Unix epoch ms round-trip).
 * - Foreign keys are declared but D1 requires `PRAGMA foreign_keys = ON`
 *   to enforce; we set that in the migration.
 *
 * Migration generation: `npm run db:generate` (drizzle-kit).
 */

/**
 * Users. Guest session model: every visitor gets a row keyed off a
 * session UUID, no email/password. The `nickname` is set via the
 * /settings page and surfaced on the community feed when the user
 * publishes or replies.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname'),

  // Geo / locale — populated by the client (browser Intl) when available.
  region: text('region'),
  timezone: text('timezone'),

  // Passive observation signals (used to be Postgres `text NOT NULL`
  // columns; on D1 we keep them NOT NULL and default to '').
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  visitCount: integer('visit_count').notNull().default(1),
  userAgent: text('user_agent').notNull().default(''),
  acceptLanguage: text('accept_language').notNull().default(''),
  firstReferer: text('first_referer'),
  lastReferer: text('last_referer'),
  ipAddress: text('ip_address').notNull().default(''),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  lastSeenIdx: index('users_last_seen_idx').on(table.lastSeenAt),
}))

/**
 * User records (divination history). Stores the JSON-serialized record
 * from frontend.
 */
export const records = sqliteTable('records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),  // 'three-number' | 'daily'
  question: text('question'),
  /** JSON-encoded [a, b, c] or null */
  numbersJson: text('numbers_json'),
  region: text('region'),
  timezone: text('timezone'),
  mainHexagramId: integer('main_hexagram_id').notNull(),
  movingLine: integer('moving_line').notNull(),
  changedHexagramId: integer('changed_hexagram_id').notNull(),
  aiInterpretation: text('ai_interpretation'),
  userNote: text('user_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userCreatedIdx: index('records_user_created_idx').on(table.userId, table.createdAt),
  userTypeIdx: index('records_user_type_idx').on(table.userId, table.type),
}))

/**
 * Favorite hexagrams.
 */
export const favoriteHexagrams = sqliteTable('favorite_hexagrams', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  hexagramId: integer('hexagram_id').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  userHexIdx: index('fav_user_hex_idx').on(table.userId, table.hexagramId),
}))

/**
 * AI usage tracking (for rate limiting).
 */
export const aiUsage = sqliteTable('ai_usage', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  ipAddress: text('ip_address').notNull(),
  /** 'YYYY-MM-DD' UTC bucket */
  date: text('date').notNull(),
  hexagramId: integer('hexagram_id'),
  tokensUsed: integer('tokens_used'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  ipDateIdx: index('ai_usage_ip_date_idx').on(table.ipAddress, table.date),
  userDateIdx: index('ai_usage_user_date_idx').on(table.userId, table.date),
}))

/**
 * Sessions (for JWT refresh / revocation). Optional for MVP — only
 * needed if we add refresh tokens.
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),

  // SMS 注册字段(migration 0002)
  smsPhone: text('sms_phone'),
  smsCode: text('sms_code'),
  smsExpiresAt: integer('sms_expires_at', { mode: 'timestamp' }),
  smsVerifyAttempts: integer('sms_verify_attempts').notNull().default(0),
  smsLockedUntil: integer('sms_locked_until', { mode: 'timestamp' }),
}, (table) => ({
  userIdx: index('sessions_user_idx').on(table.userId),
  refreshIdx: index('sessions_refresh_idx').on(table.refreshTokenHash),
  smsPhoneIdx: index('sessions_sms_phone_idx').on(table.smsPhone),
}))

/**
 * Community feed: shared divination results.
 *
 * When a user clicks "发布到社区" on the result page, the row from
 * `records` is denormalized here so the feed query doesn't have to
 * join across many tables (cheap reads, more expensive writes —
 * acceptable for a community feed where reads dominate).
 */
export const sharedPosts = sqliteTable('shared_posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Denormalized from records
  mainHexagramId: integer('main_hexagram_id').notNull(),
  changedHexagramId: integer('changed_hexagram_id').notNull(),
  movingLine: integer('moving_line').notNull(),

  // Optional user-provided content
  question: text('question'),
  /** First 280 chars of the AI interpretation, captured at publish time. */
  aiSummary: text('ai_summary'),
  /** Author's optional intro / context for the post. */
  note: text('note'),

  /** Denormalized counter, kept in sync via the reply endpoints. */
  replyCount: integer('reply_count').notNull().default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  createdIdx: index('shared_posts_created_idx').on(table.createdAt),
  userIdx: index('shared_posts_user_idx').on(table.userId),
}))

/**
 * Community feed replies (感言 from other users). Sorted by createdAt
 * ascending within a post.
 */
export const sharedReplies = sqliteTable('shared_replies', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => sharedPosts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  postCreatedIdx: index('shared_replies_post_created_idx').on(table.postId, table.createdAt),
  userIdx: index('shared_replies_user_idx').on(table.userId),
}))

// ---- Type exports ----

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Record = typeof records.$inferSelect
export type NewRecord = typeof records.$inferInsert
export type FavoriteHexagram = typeof favoriteHexagrams.$inferSelect
export type NewFavoriteHexagram = typeof favoriteHexagrams.$inferInsert
export type AiUsage = typeof aiUsage.$inferSelect
export type NewAiUsage = typeof aiUsage.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type SharedPost = typeof sharedPosts.$inferSelect
export type NewSharedPost = typeof sharedPosts.$inferInsert
export type SharedReply = typeof sharedReplies.$inferSelect
export type NewSharedReply = typeof sharedReplies.$inferInsert
