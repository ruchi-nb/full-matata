// Create: frontend/src/hooks/useHospitalId.js
import { useUser } from "@/data/UserContext";

export function useHospitalId() {
  const { user, getHospitalId } = useUser();
  
  const hospitalId = getHospitalId();
  
  return {
    hospitalId,
    hasHospitalAccess: !!hospitalId,
    user
  };
}