import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User, { IUser, UserRole, UserStatus } from '../models/User';

// Extended Request interface for authenticated requests
export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
  deviceId?: string;
}

// Request/Response interfaces
interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
  clinics?: string[];
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

// Response interfaces
interface AuthResponse {
  success: boolean;
  data?: {
    user: Partial<IUser>;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  message?: string;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

export class AuthController {
  /**
   * User Registration
   */
  static async register(req: Request, res: Response): Promise<Response<AuthResponse>> {
    try {
      const {
        username,
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        phone,
        role = UserRole.STAFF,
        clinics = []
      }: RegisterRequest = req.body;

      // Validation
      if (!username || !email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required fields',
            code: 'MISSING_FIELDS',
            details: 'Username, email, password, firstName, and lastName are required'
          }
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Passwords do not match',
            code: 'PASSWORD_MISMATCH'
          }
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Password must be at least 8 characters long',
            code: 'PASSWORD_TOO_SHORT'
          }
        });
      }

      // Check if user already exists
      const existingUserByEmail = await User.findByEmail(email);
      if (existingUserByEmail) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'User with this email already exists',
            code: 'EMAIL_EXISTS'
          }
        });
      }

      const existingUserByUsername = await User.findByUsername(username);
      if (existingUserByUsername) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'Username already taken',
            code: 'USERNAME_EXISTS'
          }
        });
      }

      // Create user
      const userData = {
        username,
        email,
        password,
        profile: {
          firstName,
          lastName,
          email,
          phone
        },
        role,
        status: UserStatus.PENDING,
        permissions: {
          canManageUsers: false,
          canManageClinic: false,
          canViewReports: false,
          canManageAppointments: false,
          canManageOrders: false,
          canManagePayments: false,
          canAccessAllClinics: role === UserRole.ADMIN || role === UserRole.MANAGER,
          allowedClinics: role === UserRole.ADMIN || role === UserRole.MANAGER ? [] : clinics
        }
      };

      const user = new User(userData);
      
      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      
      await user.save();

      // TODO: Send verification email
      // await EmailService.sendVerificationEmail(user.email, verificationToken);

      return res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          user: user.toSafeObject(),
          accessToken: '',
          refreshToken: '',
          expiresIn: 0
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Registration failed',
          code: 'REGISTRATION_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      });
    }
  }

  /**
   * User Login
   */
  static async login(req: Request, res: Response): Promise<Response<AuthResponse>> {
    try {
      const { email, password, deviceId, rememberMe = false }: LoginRequest = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Email and password are required',
            code: 'MISSING_CREDENTIALS'
          }
        });
      }

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          }
        });
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        return res.status(423).json({
          success: false,
          error: {
            message: 'Account is temporarily locked due to too many failed login attempts',
            code: 'ACCOUNT_LOCKED'
          }
        });
      }

      // Check if account is active
      if (user.status !== UserStatus.ACTIVE) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Account is not active. Please contact administrator.',
            code: 'ACCOUNT_INACTIVE'
          }
        });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        await user.incrementLoginAttempts();
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          }
        });
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Generate tokens
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      // Add session
      const sessionData = {
        deviceId: deviceId || crypto.randomUUID(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };
      user.addSession(sessionData);

      // Update last login
      user.lastLogin = new Date();
      user.lastActivity = new Date();
      
      await user.save();

      // Set HTTP-only cookies for both access and refresh tokens
      const accessTokenCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      };

      const refreshTokenCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 days or 1 day
        path: '/'
      };

      res.cookie('accessToken', accessToken, accessTokenCookieOptions);
      res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toSafeObject(),
          accessToken,
          refreshToken,
          expiresIn: 15 * 60 // 15 minutes in seconds
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Login failed',
          code: 'LOGIN_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      });
    }
  }

  /**
   * Refresh Access Token
   */
  static async refreshToken(req: Request, res: Response): Promise<Response<AuthResponse>> {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;
      const cookieRefreshToken = req.cookies?.refreshToken;

      const token = refreshToken || cookieRefreshToken;

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Refresh token is required',
            code: 'MISSING_REFRESH_TOKEN'
          }
        });
      }

      // Verify refresh token
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!);
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN'
          }
        });
      }

      // Find user and validate refresh token
      const user = await User.findById(decoded.userId);
      if (!user || !user.refreshTokens.includes(token)) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN'
          }
        });
      }

      // Check if user is still active
      if (user.status !== UserStatus.ACTIVE) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Account is not active',
            code: 'ACCOUNT_INACTIVE'
          }
        });
      }

      // Generate new access token
      const newAccessToken = user.generateAccessToken();

      // Update last activity
      user.lastActivity = new Date();
      await user.save();

      // Set HTTP-only cookie for new access token
      const accessTokenCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      };

      res.cookie('accessToken', newAccessToken, accessTokenCookieOptions);

      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: user.toSafeObject(),
          accessToken: newAccessToken,
          refreshToken: token,
          expiresIn: 15 * 60 // 15 minutes in seconds
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Token refresh failed',
          code: 'TOKEN_REFRESH_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      });
    }
  }

  /**
   * User Logout
   */
  static async logout(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      const deviceId = req.deviceId;

      if (req.user && refreshToken) {
        // Remove refresh token
        req.user.revokeRefreshToken(refreshToken);
        
        // Remove session if deviceId provided
        if (deviceId) {
          req.user.removeSession(deviceId);
        }
        
        await req.user.save();
      }

      // Clear both access and refresh token cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      return res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Logout failed',
          code: 'LOGOUT_ERROR'
        }
      });
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (req.user) {
        req.user.revokeAllSessions();
        await req.user.save();
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully'
      });

    } catch (error) {
      console.error('Logout all error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Logout from all devices failed',
          code: 'LOGOUT_ALL_ERROR'
        }
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthRequest, res: Response): Promise<Response> {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'NOT_AUTHENTICATED'
          }
        });
      }

      // Update last activity
      req.user.lastActivity = new Date();
      await req.user.save();

      return res.status(200).json({
        success: true,
        data: {
          user: req.user.toSafeObject()
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get user profile',
          code: 'GET_PROFILE_ERROR'
        }
      });
    }
  }

  /**
   * Change Password
   */
  static async changePassword(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { currentPassword, newPassword, confirmPassword }: ChangePasswordRequest = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'NOT_AUTHENTICATED'
          }
        });
      }

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'All password fields are required',
            code: 'MISSING_FIELDS'
          }
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'New passwords do not match',
            code: 'PASSWORD_MISMATCH'
          }
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'New password must be at least 8 characters long',
            code: 'PASSWORD_TOO_SHORT'
          }
        });
      }

      // Verify current password
      const isValidCurrentPassword = await req.user.comparePassword(currentPassword);
      if (!isValidCurrentPassword) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Current password is incorrect',
            code: 'INVALID_CURRENT_PASSWORD'
          }
        });
      }

      // Update password
      req.user.password = newPassword;
      req.user.revokeAllSessions(); // Force re-login on all devices
      await req.user.save();

      return res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });

    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Password change failed',
          code: 'PASSWORD_CHANGE_ERROR'
        }
      });
    }
  }

  /**
   * Forgot Password - Send reset email
   */
  static async forgotPassword(req: Request, res: Response): Promise<Response> {
    try {
      const { email }: ForgotPasswordRequest = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Email is required',
            code: 'MISSING_EMAIL'
          }
        });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.status(200).json({
          success: true,
          message: 'If the email exists, a password reset link has been sent.'
        });
      }

      // Generate password reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // TODO: Send password reset email
      // await EmailService.sendPasswordResetEmail(user.email, resetToken);

      return res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Password reset request failed',
          code: 'FORGOT_PASSWORD_ERROR'
        }
      });
    }
  }

  /**
   * Reset Password
   */
  static async resetPassword(req: Request, res: Response): Promise<Response> {
    try {
      const { token, newPassword, confirmPassword }: ResetPasswordRequest = req.body;

      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Token and password fields are required',
            code: 'MISSING_FIELDS'
          }
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Passwords do not match',
            code: 'PASSWORD_MISMATCH'
          }
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Password must be at least 8 characters long',
            code: 'PASSWORD_TOO_SHORT'
          }
        });
      }

      // Find user with valid reset token
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid or expired reset token',
            code: 'INVALID_RESET_TOKEN'
          }
        });
      }

      // Update password and clear reset token
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.revokeAllSessions(); // Force re-login on all devices

      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Password reset failed',
          code: 'RESET_PASSWORD_ERROR'
        }
      });
    }
  }

  /**
   * Verify Email
   */
  static async verifyEmail(req: Request, res: Response): Promise<Response> {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Verification token is required',
            code: 'MISSING_TOKEN'
          }
        });
      }

      // Find user with valid verification token
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid or expired verification token',
            code: 'INVALID_VERIFICATION_TOKEN'
          }
        });
      }

      // Verify email and activate account
      user.isEmailVerified = true;
      user.status = UserStatus.ACTIVE;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully. Your account is now active.'
      });

    } catch (error) {
      console.error('Email verification error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Email verification failed',
          code: 'EMAIL_VERIFICATION_ERROR'
        }
      });
    }
  }
}
