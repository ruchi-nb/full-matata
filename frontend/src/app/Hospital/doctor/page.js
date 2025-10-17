'use client';

import HosSidebar from "@/components/Hospital/Sidebar";
import DoctorsManagementHeader from "@/components/Hospital/Doctor/ManagementHeader";
import DoctorStats from "@/components/Hospital/Doctor/DoctorStats";
import DoctorTable from "@/components/Hospital/Doctor/DoctorTable";
import { getHospitalUsers, getHospitalRoles } from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";
import { useState, useCallback } from "react";

export default function Page1() {
  const { user } = useUser();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleView = (user) => console.log("Viewing profile:", user);
  const handleDelete = (user) => console.log("Deleting user:", user);

  // Refresh function that triggers a re-render of all components
  const handleRefresh = useCallback(async () => {
    console.log("🔄 Manual refresh triggered");
    // Increment refresh trigger to force re-render of all components
    setRefreshTrigger(prev => prev + 1);
    
    // Also trigger a small delay to ensure the refresh is visible
    return new Promise(resolve => {
      setTimeout(resolve, 500);
    });
  }, []);

  return (
    <div className="flex h-screen bg-[#E6EEF8]">
      <div className="h-full w-[17rem] flex-shrink-0">
        <HosSidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <DoctorsManagementHeader onRefresh={handleRefresh} />
            <DoctorStats key={refreshTrigger} />
            <DoctorTable
              key={refreshTrigger}
              onView={handleView}
              onDelete={handleDelete}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
