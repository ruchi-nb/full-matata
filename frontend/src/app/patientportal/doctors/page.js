// File: app/patientportal/doctors/page.js
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DoctorListing from '@/components/PatientPortal/home/DoctorModal';
import { MoveRight } from 'lucide-react';
import { LifeLine } from "react-loading-indicators";
import { getStoredTokens, clearTokens } from "@/data/api";

export default function DoctorsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  const handleBack = () => {
    router.push('/patientportal');
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

  return (
    <div className="pt-16 mt-10 bg-[#b9d0f5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={handleBack}
          className="flex items-center space-x-2 font-semibold text-lg sm:text-xl mb-4"
        >
          <MoveRight className="transform rotate-180 text-[#fbbf24]" />
          <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] hover:from-[#fcd34d] hover:to-[#d97706] bg-clip-text text-transparent">
            Back to Dashboard
          </span>
        </button>
      </div>
      <DoctorListing />
    </div>
  );
}