"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from 'react';
import { useUser } from '@/data/UserContext';
import {
  ArrowUpRight,
  Users,
  Clock,
  Shield,
  IndianRupee,
} from "lucide-react";

const SubscriptionOverview = () => {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, getHospitalId } = useUser();
  const router = useRouter();

  // Fetch dashboard statistics
  useEffect(() => {
    async function loadDashboardStats() {
      try {
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        const accessToken = document.cookie.split('accessToken=')[1]?.split(';')[0];
        if (!accessToken) {
          console.error("No access token found");
          setLoading(false);
          return;
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(
          `${backendUrl}/hospital-admin/hospitals/${hospitalId}/dashboard-stats`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("✅ Subscription stats loaded:", data);
          setDashboardStats(data);
        } else {
          console.error("Failed to load subscription stats:", response.statusText);
        }
      } catch (error) {
        console.error("Error loading subscription stats:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadDashboardStats();
    }
  }, [user, getHospitalId]);

  const handleclick = () => {
    router.push('/common/commingsoon')
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Subscription Overview
        </h2>
        <button 
        onClick={handleclick}
        className="flex items-center space-x-1 text-[#004dd6] hover:text-teal-700 font-medium">
          <span>Manage Subscription</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">
                User Slots Used
              </p>
              <p className="text-3xl font-bold text-slate-900 mb-2">
                {loading ? "..." : `${dashboardStats?.subscription?.user_slots_used || 0}/${dashboardStats?.subscription?.user_slots_total || 15}`}
              </p>
              <p className="text-sm font-medium text-slate-600">
                {loading ? "Loading..." : `${dashboardStats?.subscription?.user_slots_remaining || 0} slots remaining`}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-teal-50 text-teal-600">
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Consultation Hours Card */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">
                Consultation Hours
              </p>
              <p className="text-3xl font-bold text-slate-900 mb-2">
                {loading ? "..." : (dashboardStats?.subscription?.consultation_hours_monthly?.toLocaleString() || "0")}
              </p>
              <p className="text-sm font-medium text-slate-600">This month</p>
            </div>
            <div className="p-3 rounded-lg bg-sky-50 text-sky-600">
              <Clock className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Plan Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">
                Plan Status
              </p>
              <p className="text-3xl font-bold text-slate-900 mb-2">
                {loading ? "..." : (dashboardStats?.subscription?.plan_name || "Pro Plan")}
              </p>
              <p className="text-sm font-medium text-slate-600">
                {loading ? "Loading..." : `Renews in ${dashboardStats?.subscription?.renewal_days || 12} days`}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 text-slate-600">
              <Shield className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Monthly Cost Card */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 mb-1">
                Monthly Cost
              </p>
              <p className="text-3xl font-bold text-slate-900 mb-2">
                {loading ? "..." : `₹${dashboardStats?.subscription?.monthly_cost || 299}`}
              </p>
              <p className="text-sm font-medium text-slate-600">
                Next billing {loading ? "..." : "Feb 15"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-teal-50 text-teal-600">
              <IndianRupee className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionOverview;
