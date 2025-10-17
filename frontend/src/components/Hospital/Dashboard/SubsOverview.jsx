"use client";

import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Users,
  Clock,
  Shield,
  IndianRupee,
} from "lucide-react";

const SubscriptionOverview = () => {

  const router = useRouter();

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
              <p className="text-3xl font-bold text-slate-900 mb-2">8/15</p>
              <p className="text-sm font-medium text-slate-600">
                7 slots remaining
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
              <p className="text-3xl font-bold text-slate-900 mb-2">1,247</p>
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
              <p className="text-3xl font-bold text-slate-900 mb-2">Pro Plan</p>
              <p className="text-sm font-medium text-slate-600">
                Renews in 12 days
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
              <p className="text-3xl font-bold text-slate-900 mb-2">₹299</p>
              <p className="text-sm font-medium text-slate-600">
                Next billing Feb 15
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
