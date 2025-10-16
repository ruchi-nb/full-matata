// hooks/usePermissionCheck.js
import { usePermissions } from '../context/PermissionsContext';

export const usePermissionCheck = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, userRole, isRole } = usePermissions();

  const canViewPatientRecords = () => {
    return hasAnyPermission([
      'doctor.medical_records.view',
      'nurse.medical_records.view',
      'admin.medical_records.view'
    ]);
  };

  const canEditPatientRecords = () => {
    return hasPermission('doctor.medical_records.edit') || 
           hasPermission('admin.medical_records.edit');
  };

  const isMedicalStaff = () => {
    return isRole('doctor') || isRole('nurse');
  };

  return {
    canViewPatientRecords,
    canEditPatientRecords,
    isMedicalStaff,
    // Export base methods as well
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    userRole,
    isRole
  };
};