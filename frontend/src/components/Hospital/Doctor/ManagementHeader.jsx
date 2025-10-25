"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
  
const DoctorsManagementHeader = () => {
  const router = useRouter();
  
  const handleAddDoctor = () => {
    console.log('Add Doctor button clicked');
    router.push("/Hospital/addDoctor");
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
      <div className="flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          Manage all users in your hospital - doctors, nurses, patients, and staff
        </p>
      </div>
      <button
        onClick={handleAddDoctor}
        className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
      >
        <Plus className="h-4 w-4" />
        <span>Add User </span>
      </button>
    </div>
  );
};

export default DoctorsManagementHeader;