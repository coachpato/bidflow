/**
 * Role Management Utilities
 * Maps session.role (string) to ROLES enum (numeric) and provides role checking
 */

import { ROLES, ROLE_NAMES } from '@/lib/status-machine'

/**
 * Convert session role string to numeric role value
 * @param {string} roleString - Role from session (e.g., 'staff', 'manager', 'admin')
 * @returns {number} Numeric role value (ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN)
 */
export function roleStringToValue(roleString) {
  if (!roleString) {
    return ROLES.STAFF // Default to staff if no role provided
  }

  const normalizedRole = roleString.toLowerCase().trim()

  switch (normalizedRole) {
    case 'admin':
      return ROLES.ADMIN
    case 'manager':
      return ROLES.MANAGER
    case 'staff':
    case 'user':
      return ROLES.STAFF
    default:
      return ROLES.STAFF // Safe default
  }
}

/**
 * Convert numeric role value to role name string
 * @param {number} roleValue - Numeric role value
 * @returns {string} Role name (e.g., 'Admin', 'Manager', 'Staff')
 */
export function roleValueToName(roleValue) {
  return ROLE_NAMES[roleValue] || 'Unknown'
}

/**
 * Get user role from session object
 * Safely extracts and converts session.role to numeric value
 * @param {object} session - Auth session object
 * @returns {number} User's numeric role (defaults to ROLES.STAFF if missing)
 */
export function getUserRoleFromSession(session) {
  if (!session || !session.role) {
    return ROLES.STAFF
  }
  return roleStringToValue(session.role)
}

/**
 * Check if user has at least a specific role
 * @param {number} userRole - User's numeric role
 * @param {number} requiredRole - Required role (ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN)
 * @returns {boolean} True if user's role meets or exceeds required role
 */
export function userHasRole(userRole, requiredRole) {
  return userRole >= requiredRole
}

/**
 * Check if user is an admin
 * @param {number} userRole - User's numeric role
 * @returns {boolean} True if user is admin
 */
export function isUserAdmin(userRole) {
  return userRole === ROLES.ADMIN
}

/**
 * Check if user is a manager or admin
 * @param {number} userRole - User's numeric role
 * @returns {boolean} True if user is manager or higher
 */
export function isUserManager(userRole) {
  return userRole >= ROLES.MANAGER
}

/**
 * Get role comparison description
 * Useful for error messages
 * @param {number} userRole - User's numeric role
 * @param {number} requiredRole - Required role
 * @returns {string} Description like "Staff cannot approve (requires Manager)"
 */
export function getRoleComparisonMessage(userRole, requiredRole) {
  const userName = roleValueToName(userRole)
  const requiredName = roleValueToName(requiredRole)

  if (userRole >= requiredRole) {
    return `${userName} can perform this action`
  }

  return `${userName} cannot perform this action. ${requiredName} or higher role required.`
}
