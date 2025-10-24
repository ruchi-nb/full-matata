// File: app/patientportal/layout.js
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Landing/Navbar";
import Footer from "@/components/Landing/Footer";
import { logout } from "@/data/api-auth";
import { clearTokens } from "@/data/api";

const portalNavItems = [
  { type: "link", path: "/patientportal", label: "Home" },
  { type: "link", path: "/patientportal/mydoctors", label: "My Doctors" },
  { type: "link", path: "/patientportal/transcripts", label: "Transcripts" },
  { type: "link", path: "/patientportal/settings", label: "Settings" },
  { type: "logout", label: "Logout", variant: "outline", color: "red" },
];

export default function PatientPortalLayout({ children }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#fdfeff] flex flex-col">
      <Navbar onLogout={handleLogout} navItems={portalNavItems} />
      <div className="flex-1">
        {children}
      </div>
      <Footer />
    </div>
  );
}