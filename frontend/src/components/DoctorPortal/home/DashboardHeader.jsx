"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InvertedGradientButton from "@/components/common/InvertedGradientButton";
import { Settings } from "lucide-react";

const DashboardHeader = ({ user }) => {
  const router = useRouter();

  const [isFirstLogin, setIsFirstLogin] = useState(true);

  useEffect(() => {
    if (user?.firstLogin) {
      setIsFirstLogin(true);
    }
  }, [user]);

  const handleSetupClick = () => {
    router.push("/doctorportal/setup/Step1");
  };

  return (
    <div className="bg-gradient-to-r from-[#3d85c6] via-[#2563eb] to-[#004dd6] hover:from-[#003cb3] hover:via-[#1d4ed8] hover:to-[#003399] rounded-2xl p-8 mt-10 mb-8 text-white shadow-xl hover:shadow-2xl transition-all duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Hi,{" "}
          <span className="bg-gradient-to-r from-[#ffd166] via-[#ffc233] to-[#eba80e] bg-clip-text text-transparent drop-shadow-lg">
            {user?.name || "Dr. Doctor"}
          </span>
          </h1>
          <p className="text-blue-50 text-lg md:text-xl font-medium">
            Welcome to your Dashboard
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
              <span className="text-2xl font-bold text-white">{user?.patientCount || 0}</span>
              <span className="text-blue-100 ml-2">Patients</span>
            </div>
            <div className="flex items-center bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
              <span className="text-2xl font-bold text-white">{user?.transcriptCount || 0}</span>
              <span className="text-blue-100 ml-2">Consultations</span>
            </div>
          </div>
        </div>

        {/* Complete Setup Button - Commented Out */}
        {/* {isFirstLogin && (
          <div className="mt-4 md:mt-0">
            <InvertedGradientButton
              onClick={handleSetupClick}
              color="amber"
              className="shadow-lg hover:shadow-xl transition-shadow"
            >
              <Settings className="w-5 h-5 mr-2" />
              Complete Setup
            </InvertedGradientButton>
          </div>
        )} */}
      </div>
    </div>
  );
};

export default DashboardHeader;