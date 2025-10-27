"use client";

import { useRouter } from "next/navigation";
import OutlineButton from "@/components/common/OutlineButton";

export default function AddHospitalModal() { 
  const router = useRouter();

  const openModal = () => {
    router.push("/admin/AddHospital");
  };

  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Left side - Title & Subtitle */}
      <div className="flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Hospital Management
        </h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base">
          Welcome back! Manage hospitals, doctors, and AI avatar systems
        </p>
      </div>

      {/* Right side - Add Hospital Button */}
      <div className="flex-shrink-0">
        <OutlineButton
          onClick={openModal}
          color="blue"
          size="medium"
          className="flex items-center gap-2"
        >
          +   Add Hospital
        </OutlineButton>
      </div>
    </div>
  );
}
