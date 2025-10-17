"use client";

import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
  
const DoctorsManagementHeader = ({ onRefresh }) => {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  const handleAddDoctor = () => {
    console.log('Add Doctor button clicked');
    router.push("/Hospital/addDoctor");
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
        console.log('Data refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh data:', error);
      } finally {
        setRefreshing(false);
      }
    }
  };

  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-2">
          Manage your AI doctor avatars and their configurations
        </p>
      </div>
      <div className="flex items-center space-x-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
        <button
          onClick={handleAddDoctor}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add User </span>
        </button>
      </div>
    </div>
  );
};

export default DoctorsManagementHeader;