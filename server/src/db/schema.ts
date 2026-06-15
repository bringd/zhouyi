import { pgTable, uuid, text, timestamp, integer, jsonb, varchar, index, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Users table.
 *
 * MVP auth model: session-cookie-only ("guest" users). Every visitor gets a
 * row keyed off the session UUID, with no email/password. We still capture
 * passive request signals (UA, language, referer, IP, last-seen, visit
 * count) so the operator can see who's using the site without requiring
 * registration. When real auth lands (future), guests can be promoted to
 * real accounts without losing the session/observation data.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: varchar('nickname', { length: 50 }),

  // Geo / locale — populated by the client (browser Intl) when available;
  // server cannot derive these from headers alone.
  region: varchar('region', { length: 100 }),
  timezone: varchar('timezone', { length: 100 }),

  // Passive observation signals. Captured on first request, refreshed on
  // every subsequent request. Defaults are non-null so existing rows
  // backfill cleanly through the 0001 migration.
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  visitCount: integer('visit_count').notNull().default(1),
  userAgent: text('user_agent').notNull().default(''),
  acceptLanguage: varchar('accept_language', { length: 50 }).notNull().default(''),
  firstReferer: text('first_referer'),
  lastReferer: text('last_referer'),
  ipAddress: varchar('ip_address', { length: 45 }).notNull().default(''),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  lastSeenIdx: index('users_last_seen_idx').on(table.lastSeenAt),
}))

/**
 * User records (divination history).
 * Stores the JSON-serialized record from frontend.
 */
export const records = pgTable('records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),  // 'three-number' | 'daily'
  question: text('question'),
  numbers: jsonb('numbers').$type<[number, number, number] | null>(),
  region: varchar('region', { length: 100 }),
  timezone: varchar('timezone', { length: 100 }),
  mainHexagramId: integer('main_hexagram_id').notNull(),
  movingLine: integer('moving_line').notNull(),
  changedHexagramId: integer('changed_hexagram_id').notNull(),
  aiInterpretation: text('ai_interpretation'),
  userNote: text('user_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userCreatedIdx: index('records_user_created_idx').on(table.userId, table.createdAt),
  userTypeIdx: index('records_user_type_idx').on(table.userId, table.type),
}))

/**
 * Favorite hexagrams (a user can "star" hexagrams they like).
 */
export const favoriteHexagrams = pgTable('favorite_hexagrams', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  hexagramId: integer('hexagram_id').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userHexIdx: uniqueIndex('fav_user_hex_idx').on(table.userId, table.hexagramId),
}))

/**
 * AI usage tracking for rate limiting.
 * One row per AI call. Used by the B4 limiter.
 */
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),  // IPv6 max length
  date: varchar('date', { length: 10 }).notNull(),  // 'YYYY-MM-DD' for daily bucketing
  hexagramId: integer('hexagram_id'),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ipDateIdx: index('ai_usage_ip_date_idx').on(table.ipAddress, table.date),
  userDateIdx: index('ai_usage_user_date_idx').on(table.userId, table.date),
}))

/**
 * Sessions (for JWT refresh / revocation).
 * Optional for MVP — only needed if we add refresh tokens in B3.
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('sessions_user_idx').on(table.userId),
  refreshIdx: uniqueIndex('sessions_refresh_idx').on(table.refreshTokenHash),
}))

// Type exports for use in routes
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
