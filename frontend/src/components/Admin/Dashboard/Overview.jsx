"use client";

import { useState, useEffect } from "react";
import { 
  Building2, 
  UserCog, 
  Bot,
  Users,
  Calendar
} from "lucide-react";
import { getAllHospitals, getAllDoctors } from "@/data/api";

const Overview = () => {
  const [stats, setStats] = useState({
    totalHospitals: 0,
    totalDoctors: 0,
    totalPatients: 0,
    totalConsultations: 0,
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

        // Calculate stats
        const totalHospitals = hospitalsData?.length || 0;
        const totalDoctors = doctorsData?.length || 0;
        
        // Hardcoded stats for patients and consultations
        const totalPatients = 1247;
        const totalConsultations = 3842;

        setStats({
          totalHospitals,
          totalDoctors,
          totalPatients,
          totalConsultations,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 opacity-50">
              <div className="h-20 bg-gray-200 rounded"></div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Hospitals */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">Total Hospitals</p>
              <p className="text-3xl font-bold text-slate-900 mb-2">{stats.totalHospitals}</p>
              <p className="text-sm font-medium text-slate-600"># hospitals onboarded</p>
            </div>
            <div className="p-3 rounded-lg bg-teal-50 text-teal-600">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Total Doctors */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">Total Doctors</p>
              <p className="text-3xl font-bold text-slate-900 mb-2">{stats.totalDoctors}</p>
              <p className="text-sm font-medium text-slate-600"># doctors registered</p>
            </div>
            <div className="p-3 rounded-lg bg-sky-50 text-sky-600">
              <UserCog className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Total Patients */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">Total Patients</p>
              <p className="text-3xl font-bold text-slate-900 mb-2">{stats.totalPatients}</p>
              <p className="text-sm font-medium text-slate-600"># patients registered</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Total Consultations */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">Total Consultations</p>
              <p className="text-3xl font-bold text-slate-900 mb-2">{stats.totalConsultations}</p>
              <p className="text-sm font-medium text-slate-600"># consultations completed</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <Calendar className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
