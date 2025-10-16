// components/AdminDashboard.js
import { useState, useEffect } from 'react';
import { usePermissions, HospitalAdminWrapper } from './PermissionWrapper';
import { adminPermissionService } from '../services/permissionService';

const AdminDashboard = () => {
  const { currentHospital, hasRole } = usePermissions();
  const [hospitalRoles, setHospitalRoles] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentHospital) {
      loadHospitalData();
    }
  }, [currentHospital]);

  const loadHospitalData = async () => {
    if (!currentHospital) return;
    
    setLoading(true);
    try {
      const [roles, permissions] = await Promise.all([
        adminPermissionService.getHospitalRoles(currentHospital.hospital_id),
        adminPermissionService.getPermissionsCatalog()
      ]);
      
      setHospitalRoles(roles);
      setPermissionsCatalog(permissions);
    } catch (error) {
      console.error('Failed to load hospital data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (roleData) => {
    try {
      await adminPermissionService.createHospitalRole(currentHospital.hospital_id, roleData);
      loadHospitalData(); // Refresh data
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleUpdateRolePermissions = async (roleId, permissionNames) => {
    try {
      await adminPermissionService.setRolePermissions(
        currentHospital.hospital_id, 
        roleId, 
        permissionNames
      );
    } catch (error) {
      console.error('Failed to update role permissions:', error);
    }
  };

  if (!currentHospital) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">No Hospital Access</h2>
        <p>You don't have admin access to any hospitals.</p>
      </div>
    );
  }

  return (
    <HospitalAdminWrapper hospitalId={currentHospital.hospital_id}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            Hospital Admin - {currentHospital.hospital_name}
          </h1>
        </div>

        {/* Roles Management */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Roles Management</h2>
          {loading ? (
            <div>Loading roles...</div>
          ) : (
            <div className="space-y-4">
              {hospitalRoles.map(role => (
                <RoleCard 
                  key={role.hospital_role_id}
                  role={role}
                  onUpdatePermissions={handleUpdateRolePermissions}
                  permissionsCatalog={permissionsCatalog}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold">Total Roles</h3>
            <p className="text-2xl">{hospitalRoles.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold">Available Permissions</h3>
            <p className="text-2xl">{permissionsCatalog.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold">Hospital ID</h3>
            <p className="text-xl">{currentHospital.hospital_id}</p>
          </div>
        </div>
      </div>
    </HospitalAdminWrapper>
  );
};

// Role management component
const RoleCard = ({ role, onUpdatePermissions, permissionsCatalog }) => {
  const [rolePermissions, setRolePermissions] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadRolePermissions();
  }, [role]);

  const loadRolePermissions = async () => {
    try {
      const permissions = await adminPermissionService.getRolePermissions(
        role.hospital_id, 
        role.hospital_role_id
      );
      setRolePermissions(permissions);
    } catch (error) {
      console.error('Failed to load role permissions:', error);
    }
  };

  const handlePermissionToggle = async (permissionName, checked) => {
    let newPermissions;
    
    if (checked) {
      newPermissions = [...rolePermissions.map(p => p.permission_name), permissionName];
    } else {
      newPermissions = rolePermissions
        .map(p => p.permission_name)
        .filter(name => name !== permissionName);
    }

    try {
      await onUpdatePermissions(role.hospital_role_id, newPermissions);
      setRolePermissions(permissionsCatalog.filter(p => newPermissions.includes(p.permission_name)));
    } catch (error) {
      console.error('Failed to update permissions:', error);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{role.role_name}</h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
        >
          {isEditing ? 'Save' : 'Edit Permissions'}
        </button>
      </div>
      
      <p className="text-gray-600">{role.description}</p>
      
      {isEditing && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Permissions:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {permissionsCatalog.map(permission => (
              <label key={permission.permission_id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rolePermissions.some(rp => rp.permission_id === permission.permission_id)}
                  onChange={(e) => handlePermissionToggle(permission.permission_name, e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">{permission.permission_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;