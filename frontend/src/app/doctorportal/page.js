"use client";
import { useState, useMemo, useEffect } from "react";
import DashboardHeader from "@/components/DoctorPortal/home/DashboardHeader";
import StatCard from "@/components/DoctorPortal/home/StatCards";
import TranscriptModal from "@/components/DoctorPortal/home/TranscriptModal";
import PatientCard from "@/components/DoctorPortal/home/PatientCard";
import { User, FileText } from "lucide-react";
import { getDoctorProfile, getDoctorDashboardStats } from "@/data/api-doctor";

export default function DoctorPortalPage() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [doctor, setDoctor] = useState(null);
  const [doctorPatients, setDoctorPatients] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        setLoading(true);
        
        // Fetch doctor profile
        try {
          const profile = await getDoctorProfile();
          if (!mounted) return;
          setDoctor(profile);
          console.log("✅ Doctor profile loaded:", profile);
        } catch (error) {
          console.error("Failed to load doctor profile:", error);
        }
        
        // Fetch comprehensive dashboard stats (includes patients list)
        try {
          const stats = await getDoctorDashboardStats();
          if (!mounted) return;
          
          console.log("✅ Doctor dashboard stats loaded:", stats);
          setDashboardStats(stats);
          
          // Map patients from dashboard stats to UI format
          const mapped = (stats.patients || []).map((p) => ({
            id: p.user_id,
            name: p.first_name && p.last_name 
              ? `${p.first_name} ${p.last_name}` 
              : p.username || p.email || `Patient ${p.user_id}`,
            specialty: p.specialty || "General",
            reason: p.reason || "Consultation",
            date: p.last_consultation_date || "N/A",
            time: p.last_consultation_time || "N/A",
            transcriptCount: p.consultation_count || 0,
            transcripts: [], // Transcripts loaded on-demand
            email: p.email,
            phone: p.phone
          }));
          
          setDoctorPatients(mapped);
          console.log("✅ Mapped patients:", mapped);
        } catch (error) {
          console.error("Failed to load dashboard stats:", error);
          setDoctorPatients([]);
        }
      } finally {
        setLoading(false);
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
        value: dashboardStats?.stats?.total_patients || 0,
        icon: User,
        iconColor: "text-blue-600",
      },
      {
        title: "Total Consultations",
        value: dashboardStats?.stats?.total_consultations || 0,
        icon: FileText,
        iconColor: "text-green-600",
      },
    ],
    [dashboardStats]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-[#004dd6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-lg text-gray-700">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[#004dd6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DashboardHeader user={{
          name: doctor?.username || doctor?.email || "Doctor",
          firstLogin: false,
          patientCount: dashboardStats?.stats?.total_patients || 0,
          transcriptCount: dashboardStats?.stats?.total_consultations || 0,
        }} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                My Patients
              </h2>
              <p className="text-sm text-gray-600">
                {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'} {selectedSpecialty !== "All" ? `in ${selectedSpecialty}` : 'total'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Specialty:</label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px] bg-white shadow-sm hover:border-gray-400 transition-colors"
              >
                {specialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {doctorPatients.length === 0 ? "No Patients Yet" : "No Patients Found"}
                </h3>
                <p className="text-gray-600">
                  {doctorPatients.length === 0 
                    ? "Your patients will appear here after consultations. Start your first consultation to see patient records."
                    : `No patients found with ${selectedSpecialty} specialty. Try selecting a different specialty.`}
                </p>
              </div>
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