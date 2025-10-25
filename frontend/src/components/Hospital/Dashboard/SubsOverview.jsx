"use client";

import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Shield,
  IndianRupee,
} from "lucide-react";

const SubscriptionOverview = () => {
  const router = useRouter();

  const handleclick = () => {
    router.push('/common/commingsoon')
  }

  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
          Subscription Overview
        </h2>
        <button 
        onClick={handleclick}
        className="flex items-center space-x-1 text-[#004dd6] hover:text-teal-700 font-medium text-sm sm:text-base">
          <span>Manage Subscription</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Plan Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">
                Plan Status
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
                Coming Soon
              </p>
              <p className="text-xs sm:text-sm font-medium text-slate-600">
                Feature in development
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-slate-50 text-slate-600 flex-shrink-0">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Monthly Cost Card */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">
                Monthly Cost
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">
                Coming Soon
              </p>
              <p className="text-xs sm:text-sm font-medium text-slate-600">
                Feature in development
              </p>
            </div>
            <div className="p-2 sm:p-3 rounded-lg bg-teal-50 text-teal-600 flex-shrink-0">
              <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionOverview;
