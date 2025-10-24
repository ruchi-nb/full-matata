"use client";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Landing/Navbar";
import Footer from "@/components/Landing/Footer";
import { clearTokens } from "@/data/api";
import { logout as apiLogout } from "@/data/api-auth";

const portalNavItems = [
  { type: "link", path: "/doctorportal", label: "Home" },
  { type: "link", path: "/doctorportal/transcripts", label: "Transcripts" },
  { type: "link", path: "/doctorportal/settings", label: "Settings" },
  { type: "logout", label: "Logout", variant: "outline", color: "red" },
];

export default function DoctorPortalLayout({ children }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (_) {}
    clearTokens();
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userRole");
    router.push("/");
  };

  return (
    <div className="min-h-screen ">
      <Navbar 
        onLogout={handleLogout} 
        navItems={portalNavItems} 
      />
      <main className="flex-1 mt-10">{children}</main>
      <Footer />
    </div>
  );
}