import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(64, 'Password must be less than 64 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Audio file schemas
export const audioUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, 'At least one file is required').max(5, 'Maximum 5 files allowed'),
});

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(50 * 1024 * 1024),
});

export const completeUploadSchema = z.object({
  key: z.string().min(1),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  size: z.number().int().positive().max(50 * 1024 * 1024),
});

export const mashupGenerateSchema = z.object({
  inputFileIds: z.array(z.string().uuid()).min(2, 'At least 2 files are required').max(5, 'Maximum 5 files allowed'),
  durationPreset: z.enum(['1_minute', '2_minutes', '3_minutes']),
});

// Feedback schema
export const feedbackSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comments: z.string().max(500, 'Comments must be less than 500 characters').optional(),
});

// User profile schema
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
}).refine((data) => data.username || data.email || data.name, {
  message: 'At least one field must be provided',
});

// API response types
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type AudioUploadRequest = z.infer<typeof audioUploadSchema>;
export type MashupGenerateRequest = z.infer<typeof mashupGenerateSchema>;
export type FeedbackRequest = z.infer<typeof feedbackSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
