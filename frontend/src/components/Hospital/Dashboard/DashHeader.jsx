"use client";

import { useState, useEffect } from "react";
import { getHospitalProfile } from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";
import { useRouter } from "next/navigation";

export default function DashboardHeader() {
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, logout, getHospitalId } = useUser();
  const router = useRouter();

  useEffect(() => {
    async function loadHospitalProfile() {
      try {
        // Get hospital_id using the enhanced getHospitalId function
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        const profile = await getHospitalProfile(hospitalId);
        setHospital(profile);
      } catch (error) {
        console.error("Failed to load hospital profile:", error);
      } finally {
        setLoading(false);
      }
    }

    // Only load if user is available
    if (user) {
      loadHospitalProfile();
    }
  }, [user, getHospitalId]);

  const handleLogout = () => {
    logout();
    // Optional: Redirect to login page or home page after logout
    // window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="opacity-50">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 flex justify-between items-start">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {hospital?.hospital_name ? `${hospital.hospital_name} Dashboard` : "Dashboard Overview"}
        </h1>
        <p className="text-slate-600 mt-2">
          Welcome back! Here's what's happening with your AI doctor platform today.
        </p>
        {hospital?.hospital_email && (
          <p className="text-sm text-slate-500 mt-1">
            {hospital.hospital_email}
          </p>
        )}
      </div>
    </div>
  );
}