// context/PermissionsContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext();

export const PermissionsProvider = ({ children }) => {
  const [userPermissions, setUserPermissions] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [currentHospital, setCurrentHospital] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated, token } = useAuth();

  // Fetch user permissions and roles when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUserPermissions();
    } else {
      setIsLoading(false);
      setUserPermissions([]);
      setUserRoles([]);
    }
  }, [isAuthenticated, token]);

  const fetchUserPermissions = async () => {
    try {
      setIsLoading(true);
      
      // In a real app, you'd have an endpoint like /api/auth/me/permissions
      // For now, we'll simulate fetching from multiple endpoints
      const [permissionsResponse, rolesResponse] = await Promise.all([
        fetch('/api/auth/permissions', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/auth/roles', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (permissionsResponse.ok && rolesResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        const rolesData = await rolesResponse.json();
        
        setUserPermissions(permissionsData.permissions || []);
        setUserRoles(rolesData.roles || []);
        setHospitals(rolesData.hospitals || []);
        
        // Set current hospital if user has hospital roles
        if (rolesData.hospitals?.length > 0) {
          setCurrentHospital(rolesData.hospitals[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setUserPermissions([]);
      setUserRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (permission) => {
    if (isLoading || !isAuthenticated) return false;
    return userPermissions.includes(permission);
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions) => {
    return permissions.every(permission => hasPermission(permission));
  };

  const hasRole = (roleName, hospitalId = null) => {
    if (!hospitalId) {
      return userRoles.some(role => role.role_name === roleName);
    }
    return userRoles.some(role => 
      role.role_name === roleName && role.hospital_id === hospitalId
    );
  };

  const switchHospital = (hospitalId) => {
    const hospital = hospitals.find(h => h.hospital_id === hospitalId);
    if (hospital) {
      setCurrentHospital(hospital);
      // Refetch permissions for the selected hospital
      fetchHospitalPermissions(hospitalId);
    }
  };

  const fetchHospitalPermissions = async (hospitalId) => {
    try {
      const response = await fetch(`/api/hospitals/${hospitalId}/my-permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserPermissions(data.permissions || []);
        setUserRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Failed to fetch hospital permissions:', error);
    }
  };

  return (
    <PermissionsContext.Provider value={{
      userPermissions,
      userRoles,
      hospitals,
      currentHospital,
      isLoading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,
      switchHospital,
      refreshPermissions: fetchUserPermissions
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};