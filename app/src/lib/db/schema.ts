import { pgTable, uuid, varchar, timestamp, integer, boolean, decimal, text, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const uploadStatusEnum = pgEnum('upload_status', ['pending', 'uploaded', 'failed']);
export const analysisStatusEnum = pgEnum('analysis_status', ['pending', 'analyzing', 'completed', 'failed']);
export const generationStatusEnum = pgEnum('generation_status', ['pending', 'generating', 'completed', 'failed']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  username: varchar('username', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Uploaded tracks table
export const uploadedTracks = pgTable('uploaded_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  storageUrl: varchar('storage_url', { length: 512 }).notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  mimeType: varchar('mime_type', { length: 50 }).notNull(),
  uploadStatus: uploadStatusEnum('upload_status').notNull().default('pending'),
  analysisStatus: analysisStatusEnum('analysis_status').notNull().default('pending'),
  bpm: decimal('bpm', { precision: 5, scale: 2 }),
  keySignature: varchar('key_signature', { length: 20 }),
  durationSeconds: decimal('duration_seconds', { precision: 7, scale: 2 }),
  hasStems: boolean('has_stems').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Mashups table
export const mashups = pgTable('mashups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mashupId: uuid('mashup_id').notNull().references(() => mashups.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(), // 1-5 stars
  comments: text('comments'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UploadedTrack = typeof uploadedTracks.$inferSelect;
export type NewUploadedTrack = typeof uploadedTracks.$inferInsert;
export type Mashup = typeof mashups.$inferSelect;
export type NewMashup = typeof mashups.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
