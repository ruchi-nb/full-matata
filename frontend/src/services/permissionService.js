// services/permissionService.js
import { authFetch } from './authService';

// Admin API calls (for hospital_admin roles)
export const adminPermissionService = {
  // Permission catalog
  getPermissionsCatalog: async () => {
    const response = await authFetch('/api/permissions/catalog');
    return response.json();
  },

  // Hospital roles management
  getHospitalRoles: async (hospitalId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/roles`);
    return response.json();
  },

  createHospitalRole: async (hospitalId, roleData) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleData)
    });
    return response.json();
  },

  updateHospitalRole: async (hospitalId, roleId, roleData) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/roles/${roleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleData)
    });
    return response.json();
  },

  deleteHospitalRole: async (hospitalId, roleId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/roles/${roleId}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  // Role permissions management
  getRolePermissions: async (hospitalId, roleId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/roles/${roleId}/permissions`);
    return response.json();
  },

  setRolePermissions: async (hospitalId, roleId, permissionNames) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/roles/${roleId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_names: permissionNames })
    });
    return response.json();
  },

  // User-role assignments
  getUserRoles: async (hospitalId, userId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/users/${userId}/roles`);
    return response.json();
  },

  assignUserRole: async (hospitalId, userId, roleId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/users/${userId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId })
    });
    return response.json();
  },

  updateUserRole: async (hospitalId, userId, roleId, isActive) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/users/${userId}/roles/${roleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
    return response.json();
  },

  removeUserRole: async (hospitalId, userId, roleId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/users/${userId}/roles/${roleId}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  getUsersWithRole: async (hospitalId, roleId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/roles/${roleId}/users`);
    return response.json();
  }
};

// User permission API calls
export const userPermissionService = {
  getMyPermissions: async () => {
    const response = await authFetch('/api/auth/my-permissions');
    return response.json();
  },

  getMyHospitalRoles: async () => {
    const response = await authFetch('/api/auth/my-roles');
    return response.json();
  }
};