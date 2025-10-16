"use client";
import { useState, useMemo, useEffect } from "react";
import DashboardHeader from "@/components/DoctorPortal/home/DashboardHeader";
import StatCard from "@/components/DoctorPortal/home/StatCards";
import { patients } from "@/data/patients";
import TranscriptModal from "@/components/DoctorPortal/home/TranscriptModal";
import PatientCard from "@/components/DoctorPortal/home/PatientCard";
import { User, FileText, Layers } from "lucide-react";
import { getDoctorProfile, listDoctorPatients } from "@/data/api-doctor";

export default function DoctorPortalPage() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [doctor, setDoctor] = useState(null);
  const [doctorPatients, setDoctorPatients] = useState(patients);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const profile = await getDoctorProfile();
        if (!mounted) return;
        setDoctor(profile);
      } catch (_) {}
      try {
        const rows = await listDoctorPatients();
        if (!mounted) return;
        // Map backend rows to UI shape minimally (id, name, specialty optional)
        const mapped = Array.isArray(rows)
          ? rows.map((r) => ({
              id: r.user_id,
              name: r.username || r.email || `Patient ${r.user_id}`,
              specialty: "All",
              transcripts: [],
            }))
          : patients;
        setDoctorPatients(mapped);
      } catch (_) {
        setDoctorPatients(patients);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const specialties = useMemo(
    () => ["All", ...new Set((doctorPatients || []).map((p) => p.specialty))],
    [doctorPatients]
  );

  const filteredPatients =
    selectedSpecialty === "All"
      ? doctorPatients
      : (doctorPatients || []).filter((p) => p.specialty === selectedSpecialty);

  const stats = useMemo(
    () => [
      {
        title: "Total Patients",
        value: (doctorPatients || []).length,
        icon: User,
        iconColor: "text-[#ecab1c]",
      },
      {
        title: "Total Transcripts",
        value: (doctorPatients || []).reduce((sum, p) => sum + (p.transcripts?.length || 0), 0),
        icon: FileText,
        iconColor: "text-[#ecab1c]",
      },
      {
        title: "Specialties",
        value: Math.max(0, specialties.length - 1),
        icon: Layers,
        iconColor: "text-[#ecab1c]",
      },
    ],
    [doctorPatients, specialties]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[#004dd6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader user={{
          name: doctor?.username || doctor?.email || "Doctor",
          firstLogin: false,
          patientCount: (doctorPatients || []).length,
          transcriptCount: (doctorPatients || []).reduce((sum, p) => sum + (p.transcripts?.length || 0), 0),
        }} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, idx) => (
            <StatCard
              key={idx}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              iconBg={stat.iconBg}
              iconColor={stat.iconColor}
            />
          ))}
        </div>

        {/* Patients List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Patients ({filteredPatients.length})
            </h2>
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            >
              {specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>

          {/* Render Patient Cards */}
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <PatientCard
                key={patient.id}
                {...patient}
                onViewTranscript={() => setSelectedPatient(patient)}
              />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              No patients found for the selected specialty.
            </div>
          )}

          {/* Transcript Modal */}
          <TranscriptModal
            isOpen={!!selectedPatient}
            onClose={() => setSelectedPatient(null)}
            patient={selectedPatient || {}}
          />
        </div>
      </div>
    </div>
  );
}