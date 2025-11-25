import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole, IUserPermissions } from '../models/User';
import { ClinicModel } from '../models/Clinic';
import { AuthRequest } from '../controllers/AuthController';
import { Types } from 'mongoose';

// JWT Payload interface
interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: IUserPermissions;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

// Error response interface
interface AuthErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
  };
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response<AuthErrorResponse>> => {
  try {
    // Extract token from Authorization header (tokens now stored in localStorage, not cookies)
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Access token is required - please include Bearer token in Authorization header',
          code: 'MISSING_ACCESS_TOKEN',
          statusCode: 401
        }
      });
    }

    // Verify JWT token
    let decoded: JWTPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JWTPayload;
    } catch (jwtError: any) {
      const errorMessage = jwtError.name === 'TokenExpiredError' 
        ? 'Access token has expired'
        : 'Invalid access token';
      
      const errorCode = jwtError.name === 'TokenExpiredError'
        ? 'TOKEN_EXPIRED'
        : 'INVALID_TOKEN';

      return res.status(401).json({
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
          statusCode: 401
        }
      });
    }

    // Find user by ID
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
          statusCode: 401
        }
      });
    }

    // Check if user is still active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Account is not active',
          code: 'ACCOUNT_INACTIVE',
          statusCode: 403
        }
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        error: {
          message: 'Account is locked',
          code: 'ACCOUNT_LOCKED',
          statusCode: 423
        }
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = (user._id as Types.ObjectId).toString();

    // Extract device ID from headers or token
    req.deviceId = req.headers['x-device-id'] as string || decoded.userId;

    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Authentication failed',
        code: 'AUTH_MIDDLEWARE_ERROR',
        statusCode: 500
      }
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user to request if token is valid, but doesn't require authentication
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JWTPayload;
        const user = await User.findById(decoded.userId).select('-password -refreshTokens');
        
        if (user && user.status === 'active' && !user.isAccountLocked()) {
          req.user = user;
          req.userId = (user._id as Types.ObjectId).toString();
          req.deviceId = req.headers['x-device-id'] as string || decoded.userId;
        }
      } catch (jwtError) {
        // Silently ignore JWT errors for optional authentication
      }
    }

    next();
  } catch (error) {
    // Silently ignore errors for optional authentication
    next();
  }
};

/**
 * Role-based Authorization Middleware
 * Requires specific user roles
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response<AuthErrorResponse> => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          statusCode: 403
        }
      });
    }

    next();
  };
};

/**
 * Permission-based Authorization Middleware
 * Requires specific user permissions
 */
export const requirePermission = (...requiredPermissions: (keyof IUserPermissions)[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response<AuthErrorResponse> => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401
        }
      });
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => 
      req.user!.hasPermission(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          statusCode: 403
        }
      });
    }

    next();
  };
};

/**
 * Clinic Access Authorization Middleware
 * Ensures user can access the specified clinic
 */
export const requireClinicAccess = (clinicParam: string = 'clinicName') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response<AuthErrorResponse> => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401
        }
      });
    }

    const clinicName = req.params[clinicParam] || req.body.clinicName || req.query.clinicName as string;

    if (!clinicName) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Clinic name is required',
          code: 'CLINIC_NAME_REQUIRED',
          statusCode: 400
        }
      });
    }

    if (!req.user.canAccessClinic(clinicName)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Access denied to clinic: ${clinicName}`,
          code: 'CLINIC_ACCESS_DENIED',
          statusCode: 403
        }
      });
    }

    next();
  };
};

/**
 * Admin-only Authorization Middleware
 * Shorthand for admin role requirement
 */
export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Manager or Admin Authorization Middleware
 * Allows managers and admins
 */
export const requireManager = authorize(UserRole.ADMIN, UserRole.MANAGER);

/**
 * Staff or higher Authorization Middleware
 * Allows staff, practitioners, managers, and admins
 */
export const requireStaff = authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.PRACTITIONER, UserRole.STAFF);

/**
 * Self or Admin Authorization Middleware
 * Allows users to access their own data or admins to access any data
 */
export const requireSelfOrAdmin = (userIdParam: string = 'userId') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response<AuthErrorResponse> => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401
        }
      });
    }

    const targetUserId = req.params[userIdParam] || req.body.userId || req.query.userId as string;
    const isAdmin = req.user.role === UserRole.ADMIN;
    const isSelf = (req.user._id as Types.ObjectId).toString() === targetUserId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED',
          statusCode: 403
        }
      });
    }

    next();
  };
};

/**
 * Activity Tracking Middleware
 * Updates user's last activity timestamp
 */
export const trackActivity = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Only track activity for authenticated users
  if (req.user) {
    try {
      // Update last activity without waiting
      setImmediate(async () => {
        try {
          await req.user!.updateLastActivity();
        } catch (error) {
          console.error('Failed to update user activity:', error);
        }
      });
    } catch (error) {
      // Don't fail the request if activity tracking fails
      console.error('Activity tracking error:', error);
    }
  }
  
  next();
};

/**
 * Verify Clinic Name Middleware
 * Validates that clinic name exists in the system
 */
export const verifyClinicExists = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const clinicName = req.params.clinicName || req.body.clinicName || req.query.clinicName as string;

    if (!clinicName) {
      return next(); // Skip validation if no clinic name provided
    }

    // Verify clinic exists
    const clinic = await ClinicModel.findOne({ name: clinicName });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Clinic '${clinicName}' not found`,
          code: 'CLINIC_NOT_FOUND',
          statusCode: 404
        }
      });
    }

    next();
  } catch (error) {
    console.error('Clinic verification error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify clinic',
        code: 'CLINIC_VERIFICATION_ERROR',
        statusCode: 500
      }
    });
  }
};

// Export all middleware functions
export default {
  authenticate,
  optionalAuthenticate,
  authorize,
  requirePermission,
  requireClinicAccess,
  requireAdmin,
  requireManager,
  requireStaff,
  requireSelfOrAdmin,
  trackActivity,
  verifyClinicExists
};
