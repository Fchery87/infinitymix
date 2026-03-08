/**
 * Execution Module
 * 
 * Bridges the planner (Phase 3) with preview/render (Phase 4).
 * Provides contract conversion and job progress tracking.
 */

// Contract conversion
export {
  convertPlannedTransitionToContract,
  convertPlannedTransitionsToContracts,
  validateTransitionContract,
  getContractForTransition,
} from './contract-converter';

// Job progress
export {
  createJobProgress,
  updateJobProgress,
  getJobProgress,
  getUserJobs,
  cancelJob,
} from './job-progress';

// Types
export type { JobStatus, JobProgress, JobProgressUpdate } from './job-progress';
