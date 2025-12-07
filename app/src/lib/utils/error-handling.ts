import { NextResponse } from 'next/server';

// Error types for better handling
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public details?: unknown[];

  constructor(message: string, details?: unknown[]) {
    super(message, 400);
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

// Error response formatter
export function formatErrorResponse(error: unknown, requestId?: string) {
  // Log the full error for debugging
  console.error('API Error:', {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    statusCode: error instanceof AppError ? error.statusCode : undefined,
    requestId,
    timestamp: new Date().toISOString(),
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response: Record<string, unknown> = {
    error: 'Internal server error',
    message: error instanceof Error && isDevelopment ? error.message : 'Something went wrong',
    statusCode: error instanceof AppError ? error.statusCode : 500,
  };

  // Add request ID for tracking
  if (requestId) {
    response.requestId = requestId;
  }

  // Add validation details for validation errors
  if (error instanceof ValidationError && error.details) {
    response.details = error.details;
  }

  return response;
}

// Global error handler wrapper
type Handler<TArgs extends unknown[] = unknown[]> = (
  request: Request,
  ...args: TArgs
) => Promise<Response> | Response;

export function withErrorHandler<TArgs extends unknown[]>(handler: Handler<TArgs>) {
  return async (request: Request, ...args: TArgs) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      const requestId = generateRequestId();
      const errorResponse = formatErrorResponse(error, requestId);
      
      return NextResponse.json(errorResponse, {
        status: error instanceof AppError ? error.statusCode : 500,
        headers: {
          'X-Request-ID': requestId,
          'Cache-Control': 'no-store',
        },
      });
    }
  };
}

// Utility to generate request IDs for tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Async error handler for background processes
export function handleAsyncError(error: Error, context: string) {
  console.error(`Async error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // In production, you might want to send this to your monitoring service
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // This would integrate with Sentry or similar service
    // For now, just log it
  }
}
