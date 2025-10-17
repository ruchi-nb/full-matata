'use client';

import { useState, useMemo } from "react";
import { doctors as rawDoctors } from "@/data/doctors";
import HosSidebar from "@/components/Hospital/Sidebar";
import DoctorsManagementHeader from "@/components/Hospital/Doctor/ManagementHeader";
import DoctorStats from "@/components/Hospital/Doctor/DoctorStats";
import DoctorFilters from "@/components/Hospital/Doctor/DoctorFilters";
import DoctorTable from "@/components/Hospital/Doctor/DoctorTable";

// Normalize languages field to always be an array
const doctorData = rawDoctors.map((doc) => ({
  ...doc,
  languages: typeof doc.languages === "string"
    ? doc.languages.split(",").map((l) => l.trim())
    : doc.languages,
}));

export default function Page1() {
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  // Filter doctors
  const filteredDoctors = useMemo(() => {
    return doctorData.filter((doc) => {
      const matchesSearch =
        doc.name.toLowerCase().includes(search.toLowerCase()) ||
        (doc.email?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesSpecialty =
        specialtyFilter === "all" || doc.specialty === specialtyFilter;

      return matchesSearch && matchesSpecialty;
    });
  }, [search, specialtyFilter]);

  const handleView = (doctor) => console.log("Viewing profile:", doctor);
  const handlePause = (doctor) => console.log("Pausing doctor:", doctor);
  const handleDelete = (doctor) => console.log("Deleting doctor:", doctor);

  return (
    <div className="flex h-screen bg-[#E6EEF8]">
      <div className="h-full w-[17rem]flex-shrink-0">
        <HosSidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto ">
          <div className="p-6 max-w-7xl mx-auto">
            <DoctorsManagementHeader />
            <DoctorStats />

            {/* Filters */}
            <DoctorFilters
              search={search}
              onSearchChange={setSearch}
              specialty={specialtyFilter}
              onSpecialtyChange={setSpecialtyFilter}
              filteredCount={filteredDoctors.length}
              totalCount={doctorData.length}
            />

            {/* Table */}
            <DoctorTable
              doctors={filteredDoctors}
              onView={handleView}
              onPause={handlePause}
              onDelete={handleDelete}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
