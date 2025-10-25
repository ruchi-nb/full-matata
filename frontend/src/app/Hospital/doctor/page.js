'use client';

import { useState, useMemo, useEffect } from "react";
import { listHospitalDoctors, listHospitalNurses, listHospitalPatients } from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";
import HosSidebar from "@/components/Hospital/Sidebar";
import DoctorsManagementHeader from "@/components/Hospital/Doctor/ManagementHeader";
import DoctorStats from "@/components/Hospital/Doctor/DoctorStats";
import DoctorFilters from "@/components/Hospital/Doctor/DoctorFilters";
import DoctorTable from "@/components/Hospital/Doctor/DoctorTable";

export default function Page1() {
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, getHospitalId } = useUser();

  // Load ALL users from backend (doctors, patients, nurses, etc.)
  useEffect(() => {
    async function loadAllUsers() {
      try {
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        console.log("🔍 Loading all users for hospital:", hospitalId);
        
        // Fetch all user types in parallel using proper API functions
        const [doctorsList, nursesList, patientsList] = await Promise.all([
          listHospitalDoctors(hospitalId).catch(err => { console.error("Doctors error:", err); return []; }),
          listHospitalNurses(hospitalId).catch(err => { console.error("Nurses error:", err); return []; }),
          listHospitalPatients(hospitalId).catch(err => { console.error("Patients error:", err); return []; })
        ]);
        
        console.log("✅ Fetched - Doctors:", doctorsList.length, "Nurses:", nursesList.length, "Patients:", patientsList.length);
        
        // Combine all users and add role information
        const allUsers = [
          ...doctorsList.map(u => ({ ...u, roleType: 'Doctor/Staff' })),
          ...nursesList.map(u => ({ ...u, roleType: 'Nurse' })),
          ...patientsList.map(u => ({ ...u, roleType: 'Patient' }))
        ];
        
        console.log("✅ Loaded all users:", allUsers);
        setDoctors(allUsers);
      } catch (error) {
        console.error("Failed to load users:", error);
        setDoctors([]);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadAllUsers();
    }
  }, [user, getHospitalId]);

  // Filter doctors
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchesSearch =
        doc.username?.toLowerCase().includes(search.toLowerCase()) ||
        doc.email?.toLowerCase().includes(search.toLowerCase()) ||
        doc.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        doc.last_name?.toLowerCase().includes(search.toLowerCase());
      
      const matchesSpecialty =
        specialtyFilter === "all" || 
        doc.specialties?.some(s => s.name === specialtyFilter);

      return matchesSearch && matchesSpecialty;
    });
  }, [doctors, search, specialtyFilter]);

  const handleView = (doctor) => console.log("Viewing profile:", doctor);
  const handlePause = (doctor) => console.log("Pausing doctor:", doctor);
  const handleDelete = async (doctor) => {
    console.log("Deleted doctor:", doctor);
    // Reload doctors after deletion
    try {
      const hospitalId = getHospitalId();
      if (hospitalId) {
        const doctorsList = await listHospitalDoctors(hospitalId);
        setDoctors(doctorsList || []);
      }
    } catch (error) {
      console.error("Failed to reload doctors:", error);
    }
  };

  return (
    <>
    <HosSidebar />
    <div className="flex h-screen bg-[#E6EEF8]">
      <div className="hidden lg:block h-full w-[17rem] flex-shrink-0">
        <HosSidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto ">
          <div className="p-6 pl-16 lg:pl-6 max-w-7xl mx-auto">
            <DoctorsManagementHeader />
            <DoctorStats />

            {/* Filters */}
            <DoctorFilters
              search={search}
              onSearchChange={setSearch}
              specialty={specialtyFilter}
              onSpecialtyChange={setSpecialtyFilter}
              role="all"
              onRoleChange={() => {}} // Placeholder - role filtering not used on doctor page
              filteredCount={filteredDoctors.length}
              totalCount={doctors.length}
            />

            {/* Table */}
            <DoctorTable
              doctors={filteredDoctors}
              loading={loading}
              onView={handleView}
              onPause={handlePause}
              onDelete={handleDelete}
            />
          </div>
        </main>
      </div>
    </div>
    </>
  );
}
