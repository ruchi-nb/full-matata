"use client";

import { useState, useEffect } from "react";
import { 
  Building2, 
  CheckCircle2, 
  UserCog, 
  Bot
} from "lucide-react";
import { getAllHospitals, getAllDoctors } from "@/data/api";

const Overview = () => {
  const [stats, setStats] = useState({
    totalHospitals: 0,
    activeHospitals: 0,
    totalDoctors: 0,
    activeAvatars: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Fetch hospitals and doctors data
        const [hospitalsData, doctorsData] = await Promise.all([
          getAllHospitals(),
          getAllDoctors()
        ]);

        console.log('📊 Fetched hospitals data:', hospitalsData);
        console.log('📊 Fetched doctors data:', doctorsData);

        // Calculate stats - handle both backend and transformed formats
        const totalHospitals = hospitalsData?.length || 0;
        
        // Handle both is_active (backend) and status (transformed) formats
        const activeHospitals = hospitalsData?.filter(h => {
          if (h.is_active !== undefined) return h.is_active;
          if (h.status !== undefined) return h.status === 'Active';
          return true; // Default to active if no status field
        }).length || 0;
        
        const totalDoctors = doctorsData?.length || 0;
        
        // Calculate active avatars by summing from all hospitals
        const activeAvatars = hospitalsData?.reduce((sum, hospital) => {
          return sum + (hospital.active_avatars || 0);
        }, 0) || 0;

        console.log('📊 Calculated stats:', {
          totalHospitals,
          activeHospitals,
          totalDoctors,
          activeAvatars
        });

        setStats({
          totalHospitals,
          activeHospitals,
          totalDoctors,
          activeAvatars
        });
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Overview</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 opacity-50">
              <div className="h-16 sm:h-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Overview
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Hospitals */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Total Hospitals</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">{stats.totalHospitals}</p>
              <p className="text-xs sm:text-sm font-medium text-slate-600 truncate"># hospitals onboarded</p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-sky-50 text-sky-600 flex-shrink-0">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Active Hospitals */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Active Hospitals</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">{stats.activeHospitals}</p>
              <p className="text-xs sm:text-sm font-medium text-slate-600 truncate"># hospitals active</p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-sky-50 text-sky-600 flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Total Doctors */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Total Doctors</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">{stats.totalDoctors}</p>
              <p className="text-xs sm:text-sm font-medium text-slate-600 truncate"># doctors registered</p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-sky-50 text-sky-600 flex-shrink-0">
              <UserCog className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Active Avatars */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Active Avatars</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">{stats.activeAvatars}</p>
              <p className="text-xs sm:text-sm font-medium text-slate-600 truncate"># avatars live</p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-sky-50 text-sky-600 flex-shrink-0">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
