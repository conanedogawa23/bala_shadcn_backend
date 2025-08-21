import { Request, Response } from 'express';
import User, { IUser, UserRole, UserStatus } from '../models/User';
import { AuthRequest } from './AuthController';
import { Types } from 'mongoose';

// Query interfaces
interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  clinicName?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Request interfaces
interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status?: UserStatus;
  clinics?: string[];
  permissions?: Partial<any>;
}

interface UpdateUserRequest {
  username?: string;
  email?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    dateOfBirth?: Date;
    gender?: string;
    address?: any;
  };
  role?: UserRole;
  status?: UserStatus;
  permissions?: any;
}

// Response interfaces
interface UsersResponse {
  success: boolean;
  data?: {
    users: Partial<IUser>[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  message?: string;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

interface UserResponse {
  success: boolean;
  data?: {
    user: Partial<IUser>;
  };
  message?: string;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

interface UserStatsResponse {
  success: boolean;
  data?: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    usersByRole: Record<UserRole, number>;
    usersByStatus: Record<UserStatus, number>;
    usersByClinic: Record<string, number>;
    recentActivity: Array<{
      userId: string;
      username: string;
      lastActivity: Date;
      role: UserRole;
    }>;
  };
  error?: {
    message: string;
    code: string;
  };
}

export class UserController {
  /**
   * Get all users with filtering and pagination
   */
  static async getAllUsers(req: AuthRequest, res: Response): Promise<Response<UsersResponse>> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        status,
        clinicName,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      }: UserQuery = req.query;

      // Build filter query
      const filter: any = {};

      // Search in username, email, or full name
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
          { username: searchRegex },
          { email: searchRegex },
          { 'profile.firstName': searchRegex },
          { 'profile.lastName': searchRegex }
        ];
      }

      // Filter by role
      if (role) {
        filter.role = role;
      }

      // Filter by status
      if (status) {
        filter.status = status;
      }

      // Filter by clinic access
      if (clinicName) {
        filter.$or = [
          { 'permissions.canAccessAllClinics': true },
          { 'permissions.allowedClinics': clinicName }
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      const sortOptions: any = { [sortBy]: sortDirection };

      // Execute queries in parallel
      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter)
      ]);

      // Calculate pagination info
      const pages = Math.ceil(total / limit);
      const hasNext = page < pages;
      const hasPrev = page > 1;

      return res.status(200).json({
        success: true,
        data: {
          users: users.map(user => ({
            ...user,
            // Add computed fields
            fullName: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
            isLocked: !!(user.lockUntil && user.lockUntil > new Date())
          })),
          pagination: {
            page,
            limit,
            total,
            pages,
            hasNext,
            hasPrev
          }
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retrieve users',
          code: 'GET_USERS_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      });
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(req: AuthRequest, res: Response): Promise<Response<UserResponse>> {
    try {
      const { id } = req.params;

      const user = await User.findById(id)
        .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: {
            ...user,
            fullName: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
            isLocked: !!(user.lockUntil && user.lockUntil > new Date())
          }
        }
      });

    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retrieve user',
          code: 'GET_USER_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      });
    }
  }

  /**
   * Create new user (Admin only)
   */
  static async createUser(req: AuthRequest, res: Response): Promise<Response<UserResponse>> {
    try {
      const {
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        role,
        status = UserStatus.PENDING,
        clinics = [],
        permissions
      }: CreateUserRequest = req.body;

      // Validation
      if (!username || !email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required fields',
            code: 'MISSING_FIELDS',
            details: 'Username, email, password, firstName, lastName, and role are required'
          }
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'User with this email or username already exists',
            code: 'USER_EXISTS'
          }
        });
      }

      // Create user data
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
        status,
        permissions: permissions || {},
        createdBy: req.user?._id
      };

      const user = new User(userData);
      
      // Set allowed clinics based on role
      if (role === UserRole.ADMIN || role === UserRole.MANAGER) {
        user.permissions.canAccessAllClinics = true;
        user.permissions.allowedClinics = [];
      } else {
        user.permissions.allowedClinics = clinics;
      }

      await user.save();

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          user: user.toSafeObject()
        }
      });

    } catch (error) {
      console.error('Create user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create user',
          code: 'CREATE_USER_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      });
    }
  }

  /**
   * Update user
   */
  static async updateUser(req: AuthRequest, res: Response): Promise<Response<UserResponse>> {
    try {
      const { id } = req.params;
      const updateData: UpdateUserRequest = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Check if email/username conflicts with existing users
      if (updateData.email || updateData.username) {
        const conflictQuery: any = { _id: { $ne: id } };
        const conflicts = [];
        
        if (updateData.email) conflictQuery.email = updateData.email;
        if (updateData.username) conflictQuery.username = updateData.username;

        const existingUser = await User.findOne(conflictQuery);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: {
              message: 'Email or username already taken by another user',
              code: 'CONFLICT'
            }
          });
        }
      }

      // Update user fields
      if (updateData.username) user.username = updateData.username;
      if (updateData.email) user.email = updateData.email;
      if (updateData.role) user.role = updateData.role;
      if (updateData.status) user.status = updateData.status;

      // Update profile
      if (updateData.profile) {
        Object.assign(user.profile, updateData.profile);
      }

      // Update permissions
      if (updateData.permissions) {
        Object.assign(user.permissions, updateData.permissions);
      }

      user.updatedBy = req.user?._id as Types.ObjectId;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: user.toSafeObject()
        }
      });

    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update user',
          code: 'UPDATE_USER_ERROR',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        }
      });
    }
  }

  /**
   * Delete user (soft delete by setting status to inactive)
   */
  static async deleteUser(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      // Prevent self-deletion
      if ((req.user?._id as Types.ObjectId)?.toString() === id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Cannot delete your own account',
            code: 'SELF_DELETE_FORBIDDEN'
          }
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Soft delete by setting status to inactive
      user.status = UserStatus.INACTIVE;
      user.revokeAllSessions(); // Logout from all devices
      user.updatedBy = req.user?._id as Types.ObjectId;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete user',
          code: 'DELETE_USER_ERROR'
        }
      });
    }
  }

  /**
   * Update user status
   */
  static async updateUserStatus(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { status }: { status: UserStatus } = req.body;

      if (!Object.values(UserStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid status value',
            code: 'INVALID_STATUS'
          }
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      user.status = status;
      
      // If suspending or deactivating, revoke all sessions
      if (status === UserStatus.SUSPENDED || status === UserStatus.INACTIVE) {
        user.revokeAllSessions();
      }

      user.updatedBy = req.user?._id as Types.ObjectId;
      await user.save();

      return res.status(200).json({
        success: true,
        message: `User status updated to ${status}`
      });

    } catch (error) {
      console.error('Update user status error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update user status',
          code: 'UPDATE_STATUS_ERROR'
        }
      });
    }
  }

  /**
   * Reset user login attempts and unlock account
   */
  static async unlockUser(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      await user.resetLoginAttempts();

      return res.status(200).json({
        success: true,
        message: 'User account unlocked successfully'
      });

    } catch (error) {
      console.error('Unlock user error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to unlock user account',
          code: 'UNLOCK_USER_ERROR'
        }
      });
    }
  }

  /**
   * Get user statistics and analytics
   */
  static async getUserStats(req: AuthRequest, res: Response): Promise<Response<UserStatsResponse>> {
    try {
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      // Execute all queries in parallel
      const [
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        usersByRole,
        usersByStatus,
        usersByClinic,
        recentActivity
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: UserStatus.ACTIVE }),
        User.countDocuments({ createdAt: { $gte: startOfMonth } }),
        
        // Users by role
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        
        // Users by status
        User.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        
        // Users by clinic (simplified)
        User.aggregate([
          { $unwind: { path: '$permissions.allowedClinics', preserveNullAndEmptyArrays: true } },
          { $group: { _id: '$permissions.allowedClinics', count: { $sum: 1 } } },
          { $match: { _id: { $ne: null } } }
        ]),
        
        // Recent activity
        User.find({ lastActivity: { $exists: true } })
          .select('username lastActivity role')
          .sort({ lastActivity: -1 })
          .limit(10)
          .lean()
      ]);

      // Format role statistics
      const roleStats: Record<UserRole, number> = {} as Record<UserRole, number>;
      Object.values(UserRole).forEach(role => {
        roleStats[role] = 0;
      });
      usersByRole.forEach((item: any) => {
        roleStats[item._id as UserRole] = item.count;
      });

      // Format status statistics
      const statusStats: Record<UserStatus, number> = {} as Record<UserStatus, number>;
      Object.values(UserStatus).forEach(status => {
        statusStats[status] = 0;
      });
      usersByStatus.forEach((item: any) => {
        statusStats[item._id as UserStatus] = item.count;
      });

      // Format clinic statistics
      const clinicStats: Record<string, number> = {};
      usersByClinic.forEach((item: any) => {
        clinicStats[item._id] = item.count;
      });

      return res.status(200).json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          newUsersThisMonth,
          usersByRole: roleStats,
          usersByStatus: statusStats,
          usersByClinic: clinicStats,
          recentActivity: recentActivity.map((user: any) => ({
            userId: user._id,
            username: user.username,
            lastActivity: user.lastActivity,
            role: user.role
          }))
        }
      });

    } catch (error) {
      console.error('Get user stats error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retrieve user statistics',
          code: 'GET_STATS_ERROR'
        }
      });
    }
  }
}
