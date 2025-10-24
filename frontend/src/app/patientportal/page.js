// File: app/patientportal/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HeroSection from "@/components/PatientPortal/home/HeroSection";
import DoctorsListSection from "@/components/PatientPortal/home/DoctorsListSection";
import { LifeLine } from "react-loading-indicators";
import { getStoredTokens, clearTokens } from "@/data/api";

export default function PatientPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const { accessToken } = getStoredTokens();
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    
    if (accessToken && isLoggedIn) {
      setIsAuthenticated(true);
    } else {
      // Clear any invalid tokens
      clearTokens();
      localStorage.removeItem("isLoggedIn");
      // Redirect to home page
      router.push("/");
    }
    
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    console.log("🔍 PatientPortal Page - Current tokens:", getStoredTokens());
    console.log("🔍 PatientPortal Page - isLoggedIn:", localStorage.getItem("isLoggedIn"));
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-[#fdfeff] flex items-center justify-center">
        <div className="text-center">
          <LifeLine
            color="#b9d0f5"
            size="large"
            text="Medicare"
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
    <main>
      <HeroSection />
      <DoctorsListSection />
    </main>
  );
}