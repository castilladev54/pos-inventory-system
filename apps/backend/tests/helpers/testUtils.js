import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { User } from '../../models/User.js';
import { Branch } from '../../models/Branch.js';
import { getAuthHeadersForUser } from './auth.js';

/**
 * Creates a test admin user in the database.
 * @param {string} [emailPrefix='user'] 
 * @returns {Promise<{ user: any, userId: string, authHeaders: { Authorization: string } }>}
 */
export const createAdminUser = async (emailPrefix = 'user') => {
  const testEmail = `${emailPrefix}${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const hashedPassword = await bcryptjs.hash('password123', 10);
  const user = await User.create({
    email: testEmail,
    password: hashedPassword,
    name: 'Test Admin',
    role: 'admin'
  });
  const userId = user._id.toString();
  const authHeaders = getAuthHeadersForUser(user._id, user.role);

  return { user, userId, authHeaders };
};

/**
 * Creates a branch belonging to a user/tenant.
 * @param {string | mongoose.Types.ObjectId} ownerId 
 * @param {object} [options={}] 
 * @returns {Promise<{ branch: any, branchId: mongoose.Types.ObjectId }>}
 */
export const createBranch = async (ownerId, options = {}) => {
  const branch = await Branch.create({
    name: options.name || 'Test Branch',
    address: options.address || 'Test Address',
    owner_id: ownerId,
    is_active: options.is_active ?? true,
    max_debt_limit: options.max_debt_limit ?? -20,
    ...options
  });
  const branchId = branch._id;
  return { branch, branchId };
};

/**
 * Centralized generation of test JWT.
 */
export const generateJwt = (userId, role = 'admin', options = {}) => {
  return getAuthHeadersForUser(userId, role, options);
};
