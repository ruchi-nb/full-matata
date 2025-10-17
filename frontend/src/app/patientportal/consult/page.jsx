// File: app/patientportal/consult/page.jsx
"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { doctors } from '@/data/doctors';
import Consult from '@/components/PatientPortal/home/Consult';
import Navbar from '@/components/Landing/Navbar';
import Footer from '@/components/Landing/Footer';
import { LifeLine } from "react-loading-indicators";
import { getStoredTokens, clearTokens, logout } from "@/data/api";

const portalNavItems = [
  { type: "link", path: "/patientportal", label: "Home" },
  { type: "link", path: "/patientportal/mydoctors", label: "My Doctors" },
  { type: "link", path: "/patientportal/settings", label: "Settings" },
  { type: "logout", label: "Logout", variant: "outline", color: "red" },
];

export default function ConsultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const doctorId = searchParams.get('doctorId');
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Authentication check
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

  // Find doctor
  useEffect(() => {
    if (doctorId) {
      const foundDoctor = doctors.find(d => d.id === doctorId);
      setDoctor(foundDoctor);
    }
    setLoading(false);
  }, [doctorId]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearTokens();
      localStorage.removeItem("isLoggedIn");
      router.push("/");
    }
  };

  const handleBack = () => {
    router.push('/patientportal/doctors');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfeff]">
        <Navbar onLogout={handleLogout} navItems={portalNavItems} />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <LifeLine color="#3b82f6" size="large" text="Loading consultation..." textColor="#6b7280" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-[#fdfeff]">
        <Navbar onLogout={handleLogout} navItems={portalNavItems} />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Doctor Not Found</h2>
            <button
              onClick={handleBack}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Back to Doctors
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfeff]">
      <Consult doctor={doctor} onBack={handleBack} />
    </div>
  );
}