// Example usage of the reusable UserManagement component

// 1. Original Doctor Management (uses global_role_id)
// File: frontend/src/app/Hospital/doctor/page.js
import UserManagement from "@/components/common/UserManagement";

<UserManagement
  title="User Management"
  subtitle="Manage your AI doctor avatars and their configurations"
  buttonText="Add User"
  addButtonRoute="/Hospital/addDoctor"
  roleType="global"  // Uses global_role_id
  availableRoles={['doctor', 'nurse', 'patient', 'lab_technician']}
  availableSpecialties={['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology']}
  onAddClick={handleAddDoctor}
  showAddButton={true}
  showSpecialty={true}
  statsConfig={{
    showDoctors: true,
    showPatients: true,
    showNurses: false,
    showLabTechnicians: false
  }}
/>

// 2. Tenant-specific User Management (uses hospital_role_id)
// File: frontend/src/app/Hospital/tenant-users/page.js
import UserManagement from "@/components/common/UserManagement";

// Custom API functions for tenant-specific roles
const listTenantUsers = async (hospitalId, roleType) => {
  return request(`/api/hospitals/${hospitalId}/users?role_type=${roleType}&use_hospital_role=true`, { 
    method: "GET" 
  });
};

const listTenantDoctors = (hospitalId) => listTenantUsers(hospitalId, 'doctor');
const listTenantNurses = (hospitalId) => listTenantUsers(hospitalId, 'nurse');
const listTenantPatients = (hospitalId) => listTenantUsers(hospitalId, 'patient');
const listTenantLabTechnicians = (hospitalId) => listTenantUsers(hospitalId, 'lab_technician');

<UserManagement
  title="Tenant User Management"
  subtitle="Manage users specific to your hospital's custom roles and configurations"
  buttonText="Add Tenant User"
  addButtonRoute="/Hospital/addTenantUser"
  roleType="hospital"  // Uses hospital_role_id
  availableRoles={['doctor', 'nurse', 'patient', 'lab_technician']}
  availableSpecialties={['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology']}
  apiFunctions={{
    doctors: listTenantDoctors,
    nurses: listTenantNurses,
    patients: listTenantPatients,
    labTechnicians: listTenantLabTechnicians
  }}
  onAddClick={handleAddUser}
  onView={handleView}
  onPause={handlePause}
  onDelete={handleDelete}
  showAddButton={true}
  showSpecialty={true}
  statsConfig={{
    showDoctors: true,
    showPatients: true,
    showNurses: true,
    showLabTechnicians: true
  }}
/>

// 3. Patient-only Management
// File: frontend/src/app/Hospital/patients/page.js
<UserManagement
  title="Patient Management"
  subtitle="Manage patient records and information"
  buttonText="Add Patient"
  addButtonRoute="/Hospital/addPatient"
  roleType="global"
  availableRoles={['patient']}  // Only patients
  availableSpecialties={['General', 'Emergency', 'Outpatient']}
  showAddButton={true}
  showSpecialty={false}  // Patients don't have specialties
  statsConfig={{
    showDoctors: false,
    showPatients: true,
    showNurses: false,
    showLabTechnicians: false
  }}
/>

// 4. Staff Management (Doctors + Nurses + Lab Technicians)
// File: frontend/src/app/Hospital/staff/page.js
<UserManagement
  title="Staff Management"
  subtitle="Manage hospital staff members"
  buttonText="Add Staff Member"
  addButtonRoute="/Hospital/addStaff"
  roleType="global"
  availableRoles={['doctor', 'nurse', 'lab_technician']}  // No patients
  availableSpecialties={['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology']}
  showAddButton={true}
  showSpecialty={true}
  statsConfig={{
    showDoctors: true,
    showPatients: false,
    showNurses: true,
    showLabTechnicians: true
  }}
/>

// 5. Custom Role Management (e.g., for specific departments)
// File: frontend/src/app/Hospital/cardiology/page.js
<UserManagement
  title="Cardiology Department"
  subtitle="Manage cardiology department staff and patients"
  buttonText="Add Member"
  addButtonRoute="/Hospital/addCardiologyMember"
  roleType="hospital"  // Uses hospital-specific roles
  availableRoles={['doctor', 'nurse', 'patient']}
  availableSpecialties={['Cardiology', 'Interventional Cardiology', 'Electrophysiology']}
  showAddButton={true}
  showSpecialty={true}
  statsConfig={{
    showDoctors: true,
    showPatients: true,
    showNurses: true,
    showLabTechnicians: false
  }}
/>
