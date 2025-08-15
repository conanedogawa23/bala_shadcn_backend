import { Request, Response, NextFunction } from 'express';

/**
 * Async error handler wrapper for Express controllers
 * Automatically catches async errors and passes them to error middleware
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
