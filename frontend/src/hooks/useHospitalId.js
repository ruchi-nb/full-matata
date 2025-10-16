// Create: frontend/src/hooks/useHospitalId.js
import { useUser } from "@/data/UserContext";

export function useHospitalId() {
  const { user } = useUser();
  
  const hospitalId = user?.hospital_id || user?.hospital_roles?.[0]?.hospital_id;
  
  return {
    hospitalId,
    hasHospitalAccess: !!hospitalId,
    user
  };
}