// File: app/patientportal/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HeroSection from "@/components/PatientPortal/home/HeroSection";
import SpecialtiesSection from "@/components/PatientPortal/home/SpecialtiesSection";
import Navbar from "@/components/Landing/Navbar";
import Footer from "@/components/Landing/Footer";
import { LifeLine } from "react-loading-indicators";
import { getStoredTokens, clearTokens } from "@/data/api";
import { logout } from "@/data/api-auth";

const portalNavItems = [
  { type: "link", path: "/patientportal", label: "Home" },
  { type: "link", path: "/patientportal/mydoctors", label: "My Doctors" },
  { type: "link", path: "/patientportal/settings", label: "Settings" },
  { type: "logout", label: "Logout", variant: "outline", color: "red" },
];

export default function PatientPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearTokens();
      localStorage.removeItem("isLoggedIn");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    }
  };

  useEffect(() => {
    console.log("🔍 PatientPortal Page - Current tokens:", getStoredTokens());
    console.log("🔍 PatientPortal Page - isLoggedIn:", localStorage.getItem("isLoggedIn"));
  }, []);

  if (loading || loggingOut) {
    return (
      <div className="h-screen bg-[#fdfeff] flex items-center justify-center">
        <div className="text-center">
          <LifeLine
            color="#b9d0f5"
            size="large"
            text={loggingOut ? "Logging out..." : "Medicare"}
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
    <div className="min-h-screen bg-[#fdfeff]">
      <Navbar onLogout={handleLogout} navItems={portalNavItems} />
      <main>
        <HeroSection />
        <SpecialtiesSection />
      </main>
      <Footer />
    </div>
  );
}