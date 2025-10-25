"use client";

import { useRouter } from "next/navigation";

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
        Manage hospitals and their information
        </p>
      </div>

      {/* Right side - Add Hospital Button */}
      <div className="flex-shrink-0">
        <button
          onClick={openModal}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-teal-600 text-white font-medium shadow-sm hover:bg-teal-700 transition-colors text-sm sm:text-base"
        >
          + Add Hospital
        </button>
      </div>
    </div>
  );
}
