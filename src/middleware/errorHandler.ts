import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  let err = error;

  // Convert non-AppError instances to AppError
  if (!(error instanceof AppError)) {
    err = handleSpecificErrors(error);
  }

  const appError = err as AppError;

  // Log error
  logError(appError, req);

  // Send error response
  res.status(appError.statusCode || 500).json({
    success: false,
    error: {
      code: appError.code || 'INTERNAL_ERROR',
      message: appError.isOperational ? appError.message : 'Something went wrong',
      ...(appError.details && { details: appError.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: appError.stack })
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

function handleSpecificErrors(error: Error): AppError {
  // MongoDB validation errors
  if (error.name === 'ValidationError') {
    const mongoError = error as any;
    const errors = Object.values(mongoError.errors).map((err: any) => ({
      field: err.path,
      message: err.message
    }));
    return new AppError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  // MongoDB duplicate key error
  if ((error as any).code === 11000) {
    const field = Object.keys((error as any).keyValue)[0];
    return new AppError(`${field} already exists`, 409, 'DUPLICATE_KEY');
  }

  // MongoDB cast error
  if (error.name === 'CastError') {
    return new AppError('Invalid ID format', 400, 'INVALID_ID');
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
  }

  // Default to internal server error
  return new AppError('Internal server error', 500, 'INTERNAL_ERROR', false);
}

function logError(error: AppError, req: Request) {
  const errorInfo = {
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    stack: error.stack,
    path: req.originalUrl,
    method: req.method,
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  };

  if (error.statusCode >= 500) {
    logger.error('Server Error:', errorInfo);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error:', errorInfo);
  } else {
    logger.info('Request Error:', errorInfo);
  }
}
