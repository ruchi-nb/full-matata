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
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-2">
          Manage your AI doctor avatars and their configurations
        </p>
      </div>
      <button
        onClick={handleAddDoctor}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
      >
        <Plus className="h-4 w-4" />
        <span>Add User </span>
      </button>
    </div>
  );
};

export default DoctorsManagementHeader;