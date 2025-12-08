import { pgTable, uuid, varchar, timestamp, integer, boolean, decimal, text, pgEnum, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

// Enums
export const uploadStatusEnum = pgEnum('upload_status', ['pending', 'uploaded', 'failed']);
export const analysisStatusEnum = pgEnum('analysis_status', ['pending', 'analyzing', 'completed', 'failed']);
export const generationStatusEnum = pgEnum('generation_status', ['pending', 'generating', 'completed', 'failed']);
export const stemStatusEnum = pgEnum('stem_status', ['pending', 'processing', 'completed', 'failed']);
export const stemTypeEnum = pgEnum('stem_type', ['vocals', 'drums', 'bass', 'other']);

// Users table - using text for id to support Better Auth's nanoid format
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  username: varchar('username', { length: 100 }),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: varchar('image', { length: 512 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Auth tables
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: varchar('account_id', { length: 255 }).notNull(),
  providerId: varchar('provider_id', { length: 255 }).notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: varchar('password', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  providerAccountUnique: uniqueIndex('accounts_provider_account_unique').on(table.providerId, table.accountId),
  userIdIdx: index('idx_accounts_user_id').on(table.userId),
}));

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  userIdIdx: index('idx_sessions_user_id').on(table.userId),
}));

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  identifierIdx: index('idx_verifications_identifier').on(table.identifier),
}));

// Uploaded tracks table
export const uploadedTracks = pgTable('uploaded_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  storageUrl: varchar('storage_url', { length: 512 }).notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  mimeType: varchar('mime_type', { length: 50 }).notNull(),
  uploadStatus: uploadStatusEnum('upload_status').notNull().default('pending'),
  analysisStatus: analysisStatusEnum('analysis_status').notNull().default('pending'),
  bpm: decimal('bpm', { precision: 5, scale: 2 }),
  keySignature: varchar('key_signature', { length: 20 }),
  camelotKey: varchar('camelot_key', { length: 10 }),
  bpmConfidence: decimal('bpm_confidence', { precision: 4, scale: 3 }),
  keyConfidence: decimal('key_confidence', { precision: 4, scale: 3 }),
  beatGrid: jsonb('beat_grid').$type<number[]>(),
  analysisVersion: varchar('analysis_version', { length: 20 }).default('phase1-v1'),
  durationSeconds: decimal('duration_seconds', { precision: 7, scale: 2 }),
  hasStems: boolean('has_stems').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Track stems table
export const trackStems = pgTable('track_stems', {
  id: uuid('id').primaryKey().defaultRandom(),
  uploadedTrackId: uuid('uploaded_track_id').notNull().references(() => uploadedTracks.id, { onDelete: 'cascade' }),
  stemType: stemTypeEnum('stem_type').notNull(),
  storageUrl: varchar('storage_url', { length: 512 }),
  status: stemStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  trackStemUnique: uniqueIndex('uq_track_stem_type').on(table.uploadedTrackId, table.stemType),
  trackIdIdx: index('idx_track_stems_track_id').on(table.uploadedTrackId),
}));

// Mashups table
export const mashups = pgTable('mashups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  targetDurationSeconds: integer('target_duration_seconds').notNull(),
  outputStorageUrl: varchar('output_storage_url', { length: 512 }),
  generationStatus: generationStatusEnum('generation_status').notNull().default('pending'),
  playbackCount: integer('playback_count').notNull().default(0),
  downloadCount: integer('download_count').notNull().default(0),
  outputFormat: varchar('output_format', { length: 10 }).notNull().default('mp3'),
  generationTimeMs: integer('generation_time_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Mashup input tracks (many-to-many relationship)
export const mashupInputTracks = pgTable('mashup_input_tracks', {
  mashupId: uuid('mashup_id').notNull().references(() => mashups.id, { onDelete: 'cascade' }),
  uploadedTrackId: uuid('uploaded_track_id').notNull().references(() => uploadedTracks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Feedback table
export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mashupId: uuid('mashup_id').notNull().references(() => mashups.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(), // 1-5 stars
  comments: text('comments'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type UploadedTrack = typeof uploadedTracks.$inferSelect;
export type NewUploadedTrack = typeof uploadedTracks.$inferInsert;
export type Mashup = typeof mashups.$inferSelect;
export type NewMashup = typeof mashups.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
