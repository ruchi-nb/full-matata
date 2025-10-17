// components/HospitalSelector.js
import { usePermissions } from '../context/PermissionsContext';

const HospitalSelector = () => {
  const { hospitals, currentHospital, switchHospital, isLoading } = usePermissions();

  if (isLoading || hospitals.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Hospital:</span>
      <select
        value={currentHospital?.hospital_id || ''}
        onChange={(e) => switchHospital(parseInt(e.target.value))}
        className="border rounded px-3 py-1 text-sm"
      >
        {hospitals.map(hospital => (
          <option key={hospital.hospital_id} value={hospital.hospital_id}>
            {hospital.hospital_name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default HospitalSelector;