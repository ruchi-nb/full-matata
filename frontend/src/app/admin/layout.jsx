"use client";

import { useRouter } from "next/navigation";
import { LifeLine } from "react-loading-indicators";
import { useUser } from "@/data/UserContext";
import { logout } from "@/data/api-auth";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { user, loading: userLoading, isSuperAdmin, isAuthenticated } = useUser();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  };

  // Show loading while user data is being fetched
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <LifeLine  size="large" text="Loading admin panel..." textColor="#004dd6" />
      </div>
    );
  }

  // Redirect if not authenticated or not admin
  if (!user || !isAuthenticated() || (!isSuperAdmin() && !user.global_role?.role_name?.includes("admin"))) {
    router.replace("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {children}
    </div>
  );
}
