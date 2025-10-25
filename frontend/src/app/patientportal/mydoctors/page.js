// File: app/patientportal/mydoctors/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LifeLine } from "react-loading-indicators";
import { getStoredTokens, clearTokens } from "@/data/api";
import { getMyDoctors } from "@/services/patientService";
import { Stethoscope, Calendar, User } from "lucide-react";

export default function MydoctorsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { accessToken } = getStoredTokens();
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    
    if (accessToken && isLoggedIn) {
      setIsAuthenticated(true);
    } else {
      clearTokens();
      localStorage.removeItem("isLoggedIn");
      router.push("/");
    }
    
    const timer = setTimeout(() => {
      setAuthLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyDoctors();
    }
  }, [isAuthenticated]);

  const fetchMyDoctors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMyDoctors();
      setDoctors(response.doctors || []);
    } catch (err) {
      console.error("Error fetching doctors:", err);
      setError(err.message || "Failed to load doctors");
      if (err.message.includes("Session expired")) {
      router.push("/");
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-[#fdfeff] flex items-center justify-center">
        <div className="text-center">
          <LifeLine
            color="#b9d0f5"
            size="large"
            text="Loading..."
            textColor="#b9d0f5"
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-[#fdfeff] flex items-center justify-center">
        <div className="text-center">
          <LifeLine
            color="#b9d0f5"
            size="large"
            text="Redirecting..."
            textColor="#b9d0f5"
          />
        </div>
      </div>
    );
  }

  const handleConsultDoctor = (doctor) => {
    // Store doctor info in sessionStorage for consultation page
    sessionStorage.setItem('selectedDoctor', JSON.stringify({
      doctor_id: doctor.user_id,
      doctor_name: `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() || doctor.username,
      specialty: doctor.specialty,
      email: doctor.email
    }));
    
    // Navigate to consultation with default provider and language
    router.push(`/consultation?doctor_id=${doctor.user_id}&provider=sarvam&language=hi`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white pt-20 sm:pt-24 pb-4 sm:pb-6 md:pb-8">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <div className="bg-blue-600 p-2 sm:p-3 rounded-lg">
              <Stethoscope size={24} className="text-white sm:w-8 sm:h-8" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">My Doctors</h1>
              <p className="text-sm sm:text-base text-gray-600">Doctors you have consulted with</p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <LifeLine
              color="#2563eb"
              size="large"
              text="Loading doctors..."
              textColor="#2563eb"
            />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6">
            <p className="font-medium">Error loading doctors</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchMyDoctors}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && doctors.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 md:p-12 text-center">
            <Stethoscope size={48} className="mx-auto text-gray-300 mb-4 sm:w-16 sm:h-16" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">
              No Consultations Yet
            </h3>
            <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">
              You haven't consulted with any doctors yet. Start your first consultation from the home page.
            </p>
            <button
              onClick={() => router.push('/patientportal')}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition"
            >
              Find Doctors
            </button>
          </div>
        )}

        {/* Doctors List */}
        {!loading && !error && doctors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {doctors.map((doctor) => (
              <div
                key={doctor.user_id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col"
              >
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-5 md:p-6 text-white">
                  <div className="flex items-start gap-2 sm:gap-3 mb-2">
                    <User size={20} className="flex-shrink-0 mt-1 sm:w-6 sm:h-6" />
                    <h3 className="text-base sm:text-lg md:text-xl font-bold leading-tight break-words">
                      {doctor.first_name && doctor.last_name
                        ? `Dr. ${doctor.first_name} ${doctor.last_name}`
                        : doctor.username}
                    </h3>
                  </div>
                  {doctor.specialty && (
                    <p className="text-blue-100 text-xs sm:text-sm">{doctor.specialty}</p>
                  )}
                </div>

                <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                  {/* Specialties */}
                  {doctor.specialties && doctor.specialties.length > 0 && (
                    <div className="mb-3 sm:mb-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                        Specialties
                      </p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {doctor.specialties.map((specialty) => (
                          <span
                            key={specialty.specialty_id}
                            className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-700 text-xs sm:text-sm rounded-full"
                          >
                            {specialty.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Consultation Stats */}
                  <div className="mb-3 sm:mb-4 space-y-1.5 sm:space-y-2">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={14} className="flex-shrink-0 sm:w-4 sm:h-4" />
                      <span className="text-xs sm:text-sm">
                        {doctor.consultation_count} consultation{doctor.consultation_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {doctor.last_consultation_date && (
                      <p className="text-xs text-gray-500 pl-6">
                        Last visit: {new Date(doctor.last_consultation_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Contact Info */}
                  {doctor.email && (
                    <div className="mb-3 sm:mb-4">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-xs sm:text-sm text-gray-700 break-all">{doctor.email}</p>
                    </div>
                  )}

                  {doctor.phone && (
                    <div className="mb-3 sm:mb-4">
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-xs sm:text-sm text-gray-700">{doctor.phone}</p>
                    </div>
                  )}

                  {/* Consult Button */}
                  <button
                    onClick={() => handleConsultDoctor(doctor)}
                    className="w-full py-2.5 sm:py-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition font-semibold mt-auto"
                  >
                    Consult Again
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </main>
  );
}