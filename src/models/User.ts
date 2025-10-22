import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

// Enums for type safety
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  PRACTITIONER = 'practitioner',
  STAFF = 'staff',
  CLIENT = 'client',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

// Interfaces
export interface IUserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
}

export interface IUserPermissions {
  canManageUsers: boolean;
  canManageClinic: boolean;
  canViewReports: boolean;
  canManageAppointments: boolean;
  canManageOrders: boolean;
  canManagePayments: boolean;
  // Granular Payment Permissions
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canEditPayments: boolean;
  canDeletePayments: boolean;
  canProcessRefunds: boolean;
  canAccessAllClinics: boolean;
  allowedClinics: string[];
}

export interface IUserSession {
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  isActive: boolean;
}

export interface IUser extends Document {
  // Authentication
  username: string;
  email: string;
  password: string;

  // Profile
  profile: IUserProfile;

  // Authorization
  role: UserRole;
  permissions: IUserPermissions;
  status: UserStatus;

  // Security
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastPasswordChange: Date;
  loginAttempts: number;
  lockUntil?: Date;

  // Sessions
  sessions: IUserSession[];
  refreshTokens: string[];

  // Audit
  lastLogin?: Date;
  lastActivity?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAccessToken(): string;
  generateRefreshToken(): string;
  generatePasswordResetToken(): string;
  generateEmailVerificationToken(): string;
  addSession(sessionData: Partial<IUserSession>): void;
  removeSession(deviceId: string): void;
  revokeAllSessions(): void;
  revokeRefreshToken(token: string): void;
  isAccountLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  updateLastActivity(): Promise<void>;
  hasPermission(permission: keyof IUserPermissions): boolean;
  canAccessClinic(clinicName: string): boolean;
  getFullName(): string;
  toSafeObject(): Partial<IUser>;
  getDefaultPermissions(role: UserRole): IUserPermissions;
}

// User Profile Schema
const UserProfileSchema = new Schema<IUserProfile>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      province: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'Canada' }
    }
  },
  { _id: false }
);

// User Permissions Schema
const UserPermissionsSchema = new Schema<IUserPermissions>(
  {
    canManageUsers: { type: Boolean, default: false },
    canManageClinic: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false },
    canManageAppointments: { type: Boolean, default: false },
    canManageOrders: { type: Boolean, default: false },
    canManagePayments: { type: Boolean, default: false },
    canAccessAllClinics: { type: Boolean, default: false },
    allowedClinics: [{ type: String, trim: true }]
  },
  { _id: false }
);

// User Session Schema
const UserSessionSchema = new Schema<IUserSession>(
  {
    deviceId: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    lastActivity: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

// Main User Schema
const UserSchema = new Schema<IUser>(
  {
    // Authentication
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_-]+$/
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },

    // Profile
    profile: { type: UserProfileSchema, required: true },

    // Authorization
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STAFF
    },
    permissions: { type: UserPermissionsSchema, required: true },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING
    },

    // Security
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    lastPasswordChange: { type: Date, default: Date.now },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    // Sessions
    sessions: [UserSessionSchema],
    refreshTokens: [{ type: String }],

    // Audit
    lastLogin: { type: Date },
    lastActivity: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
// Note: email and username indices are automatically created by unique: true
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ 'permissions.allowedClinics': 1 });
UserSchema.index({ lastLogin: -1 });
UserSchema.index({ createdAt: -1 });

// Virtual for account locked status
UserSchema.virtual('isLocked').get(function (this: IUser) {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Virtual for full name
UserSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.profile.firstName} ${this.profile.lastName}`.trim();
});

// Pre-save middleware
UserSchema.pre<IUser>('save', async function (next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.lastPasswordChange = new Date();
  }

  // Set default permissions based on role
  if (this.isModified('role') || this.isNew) {
    this.permissions = this.getDefaultPermissions(this.role);
  }

  next();
});

// Instance Methods
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generateAccessToken = function (): string {
  const payload = {
    userId: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    permissions: this.permissions
  };

  const secret = process.env.JWT_ACCESS_SECRET!;
  return jwt.sign(payload, secret, {
    expiresIn: '15m',
    issuer: 'visio-health',
    audience: 'visio-health-client'
  });
};

UserSchema.methods.generateRefreshToken = function (): string {
  const payload = {
    userId: this._id,
    tokenType: 'refresh'
  };

  const secret = process.env.JWT_REFRESH_SECRET!;
  const token = jwt.sign(payload, secret, {
    expiresIn: '7d',
    issuer: 'visio-health',
    audience: 'visio-health-client'
  });

  this.refreshTokens.push(token);
  return token;
};

UserSchema.methods.generatePasswordResetToken = function (): string {
  const token = jwt.sign(
    { userId: this._id, purpose: 'password-reset' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '1h' }
  );

  this.passwordResetToken = token;
  this.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

  return token;
};

UserSchema.methods.generateEmailVerificationToken = function (): string {
  const token = jwt.sign(
    { userId: this._id, purpose: 'email-verification' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '24h' }
  );

  this.emailVerificationToken = token;
  this.emailVerificationExpires = new Date(Date.now() + 86400000); // 24 hours

  return token;
};

UserSchema.methods.addSession = function (
  sessionData: Partial<IUserSession>
): void {
  const session: IUserSession = {
    deviceId: sessionData.deviceId || '',
    ipAddress: sessionData.ipAddress || '',
    userAgent: sessionData.userAgent || '',
    lastActivity: new Date(),
    isActive: true
  };

  // Remove existing session for same device
  if (session.deviceId) {
    this.sessions = this.sessions.filter(
      (s: IUserSession) => s.deviceId !== session.deviceId
    );
  }

  this.sessions.push(session);

  // Keep only last 5 sessions
  if (this.sessions.length > 5) {
    this.sessions = this.sessions.slice(-5);
  }
};

UserSchema.methods.removeSession = function (deviceId: string): void {
  this.sessions = this.sessions.filter(
    (s: IUserSession) => s.deviceId !== deviceId
  );
};

UserSchema.methods.revokeAllSessions = function (): void {
  this.sessions = [];
  this.refreshTokens = [];
};

UserSchema.methods.revokeRefreshToken = function (token: string): void {
  this.refreshTokens = this.refreshTokens.filter((t: string) => t !== token);
};

UserSchema.methods.isAccountLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

UserSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates: any = { $inc: { loginAttempts: 1 } };

  // If we've reached max attempts and it's not locked yet, lock the account
  if (this.loginAttempts + 1 >= maxAttempts && !this.isAccountLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }

  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

UserSchema.methods.updateLastActivity = async function (): Promise<void> {
  this.lastActivity = new Date();
  return this.save();
};

UserSchema.methods.hasPermission = function (
  permission: keyof IUserPermissions
): boolean {
  return this.permissions[permission] === true;
};

UserSchema.methods.canAccessClinic = function (clinicName: string): boolean {
  if (this.permissions.canAccessAllClinics) {
    return true;
  }
  return this.permissions.allowedClinics.includes(clinicName);
};

UserSchema.methods.getFullName = function (): string {
  return `${this.profile.firstName} ${this.profile.lastName}`.trim();
};

UserSchema.methods.toSafeObject = function (): Partial<IUser> {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshTokens;
  delete userObject.passwordResetToken;
  delete userObject.emailVerificationToken;
  delete userObject.sessions;
  return userObject;
};

UserSchema.methods.getDefaultPermissions = function (
  role: UserRole
): IUserPermissions {
  const basePermissions: IUserPermissions = {
    canManageUsers: false,
    canManageClinic: false,
    canViewReports: false,
    canManageAppointments: false,
    canManageOrders: false,
    canManagePayments: false,
    // Granular Payment Permissions
    canViewPayments: false,
    canCreatePayments: false,
    canEditPayments: false,
    canDeletePayments: false,
    canProcessRefunds: false,
    canAccessAllClinics: false,
    allowedClinics: []
  };

  switch (role) {
  case UserRole.ADMIN:
    return {
      ...basePermissions,
      canManageUsers: true,
      canManageClinic: true,
      canViewReports: true,
      canManageAppointments: true,
      canManageOrders: true,
      canManagePayments: true,
      // Full payment permissions for Admin
      canViewPayments: true,
      canCreatePayments: true,
      canEditPayments: true,
      canDeletePayments: true,
      canProcessRefunds: true,
      canAccessAllClinics: true
    };

  case UserRole.MANAGER:
    return {
      ...basePermissions,
      canManageClinic: true,
      canViewReports: true,
      canManageAppointments: true,
      canManageOrders: true,
      canManagePayments: true,
      // Most payment permissions for Manager (except delete)
      canViewPayments: true,
      canCreatePayments: true,
      canEditPayments: true,
      canDeletePayments: false,
      canProcessRefunds: true,
      canAccessAllClinics: true
    };

  case UserRole.PRACTITIONER:
    return {
      ...basePermissions,
      canViewReports: true,
      canManageAppointments: true,
      canManageOrders: true,
      // Limited payment permissions for Practitioner
      canViewPayments: true,
      canCreatePayments: true,
      canEditPayments: false,
      canDeletePayments: false,
      canProcessRefunds: false
    };

  case UserRole.STAFF:
    return {
      ...basePermissions,
      canManageAppointments: true,
      canManageOrders: true,
      // Basic payment permissions for Staff
      canViewPayments: true,
      canCreatePayments: false,
      canEditPayments: false,
      canDeletePayments: false,
      canProcessRefunds: false
    };

  case UserRole.CLIENT:
    return basePermissions;

  default:
    return basePermissions;
  }
};

// Interface for static methods
interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
  findByUsername(username: string): Promise<IUser | null>;
  findActiveUsers(): Promise<IUser[]>;
  findByRole(role: UserRole): Promise<IUser[]>;
  findByClinic(clinicName: string): Promise<IUser[]>;
}

// Static Methods
UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findByUsername = function (username: string) {
  return this.findOne({ username });
};

UserSchema.statics.findActiveUsers = function () {
  return this.find({ status: UserStatus.ACTIVE });
};

UserSchema.statics.findByRole = function (role: UserRole) {
  return this.find({ role });
};

UserSchema.statics.findByClinic = function (clinicName: string) {
  return this.find({
    $or: [
      { 'permissions.canAccessAllClinics': true },
      { 'permissions.allowedClinics': clinicName }
    ]
  });
};

// Export the model
const User = mongoose.model<IUser, IUserModel>('User', UserSchema);
export default User;
