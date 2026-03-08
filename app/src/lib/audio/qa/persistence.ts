/**
 * QA Persistence Service
 * 
 * Persists QA results and manages retry state.
 */

import { db } from '@/lib/db';
import { qaRecords } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { AutomationQAResults, QADatabaseRecord } from '@/lib/audio/types/qa';
import { nanoid } from 'nanoid';

/**
 * Create a new QA record
 */
export async function createQARecord(
  jobId: string,
  userId: string,
  results: AutomationQAResults,
  mashupId?: string
): Promise<string> {
  const id = nanoid();
  
  await db.insert(qaRecords).values({
    id,
    jobId,
    mashupId: mashupId || null,
    userId,
    results,
    passed: results.passed,
    retryCount: 0,
    retryReasons: [],
  });
  
  return id;
}

/**
 * Update QA record with retry information
 */
export async function updateQARecordRetry(
  qaRecordId: string,
  retryReason: string
): Promise<void> {
  const existing = await db
    .select({ retryCount: qaRecords.retryCount, retryReasons: qaRecords.retryReasons })
    .from(qaRecords)
    .where(eq(qaRecords.id, qaRecordId))
    .limit(1);
  
  if (existing.length === 0) return;
  
  const currentCount = existing[0].retryCount;
  const currentReasons = (existing[0].retryReasons as string[]) || [];
  
  await db
    .update(qaRecords)
    .set({
      retryCount: currentCount + 1,
      retryReasons: [...currentReasons, retryReason],
    })
    .where(eq(qaRecords.id, qaRecordId));
}

/**
 * Mark QA record as reviewed
 */
export async function reviewQARecord(
  qaRecordId: string,
  reviewerId: string,
  notes?: string
): Promise<void> {
  await db
    .update(qaRecords)
    .set({
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
    })
    .where(eq(qaRecords.id, qaRecordId));
}

/**
 * Get QA record by ID
 */
export async function getQARecord(qaRecordId: string): Promise<QADatabaseRecord | null> {
  const records = await db
    .select()
    .from(qaRecords)
    .where(eq(qaRecords.id, qaRecordId))
    .limit(1);
  
  if (records.length === 0) return null;
  
  const r = records[0];
  return {
    id: r.id,
    jobId: r.jobId,
    mashupId: r.mashupId,
    userId: r.userId,
    results: r.results as AutomationQAResults,
    passed: r.passed,
    retryCount: r.retryCount,
    retryReasons: r.retryReasons as string[],
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Get QA records for a mashup
 */
export async function getQARecordsForMashup(
  mashupId: string
): Promise<QADatabaseRecord[]> {
  const records = await db
    .select()
    .from(qaRecords)
    .where(eq(qaRecords.mashupId, mashupId))
    .orderBy(desc(qaRecords.createdAt));
  
  return records.map(r => ({
    id: r.id,
    jobId: r.jobId,
    mashupId: r.mashupId,
    userId: r.userId,
    results: r.results as AutomationQAResults,
    passed: r.passed,
    retryCount: r.retryCount,
    retryReasons: r.retryReasons as string[],
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Get QA statistics for admin dashboard
 */
export async function getQAStatistics(): Promise<{
  totalRecords: number;
  passedCount: number;
  failedCount: number;
  retryCount: number;
  needsReviewCount: number;
  averageRetryCount: number;
}> {
  const [totalResult, passedResult, failedResult, retryResult, needsReviewResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(qaRecords),
    db.select({ count: sql<number>`count(*)` }).from(qaRecords).where(eq(qaRecords.passed, true)),
    db.select({ count: sql<number>`count(*)` }).from(qaRecords).where(eq(qaRecords.passed, false)),
    db.select({ total: sql<number>`sum(${qaRecords.retryCount})` }).from(qaRecords),
    db.select({ count: sql<number>`count(*)` }).from(qaRecords).where(sql`${qaRecords.passed} = false AND ${qaRecords.retryCount} >= 3`),
  ]);
  
  const totalRecords = Number(totalResult[0]?.count ?? 0);
  const totalRetries = Number(retryResult[0]?.total ?? 0);
  
  return {
    totalRecords,
    passedCount: Number(passedResult[0]?.count ?? 0),
    failedCount: Number(failedResult[0]?.count ?? 0),
    retryCount: totalRetries,
    needsReviewCount: Number(needsReviewResult[0]?.count ?? 0),
    averageRetryCount: totalRecords > 0 ? totalRetries / totalRecords : 0,
  };
}

/**
 * Get recent QA failures for admin review
 */
export async function getRecentQAFailures(
  limit = 50
): Promise<Array<QADatabaseRecord & { userEmail?: string }>> {
  const records = await db
    .select({
      qa: qaRecords,
      userEmail: sql<string>`users.email`,
    })
    .from(qaRecords)
    .leftJoin(sql`users`, eq(sql`users.id`, qaRecords.userId))
    .where(eq(qaRecords.passed, false))
    .orderBy(desc(qaRecords.createdAt))
    .limit(limit);
  
  return records.map(r => ({
    id: r.qa.id,
    jobId: r.qa.jobId,
    mashupId: r.qa.mashupId,
    userId: r.qa.userId,
    results: r.qa.results as AutomationQAResults,
    passed: r.qa.passed,
    retryCount: r.qa.retryCount,
    retryReasons: r.qa.retryReasons as string[],
    createdAt: r.qa.createdAt.toISOString(),
    userEmail: r.userEmail,
  }));
}
