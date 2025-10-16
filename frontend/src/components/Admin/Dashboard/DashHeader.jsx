"use client";

import { useRouter } from "next/navigation";

export default function AddHospitalModal() { 
  const router = useRouter();

  const openModal = () => {
    router.push("/admin/AddHospital");
  };

  return (
    <div className="mb-8 flex items-center justify-between">
      {/* Left side - Title & Subtitle */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Hospital Management
        </h1>
        <p className="text-slate-600 mt-2">
          Welcome back! Manage hospitals, doctors, and AI avatar systems
        </p>
      </div>

      {/* Right side - Add Hospital Button */}
      <div>
        <button
          onClick={openModal}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white font-medium shadow-sm hover:bg-teal-700 transition-colors"
        >
          + Add Hospital
        </button>
      </div>
    </div>
  );
}
