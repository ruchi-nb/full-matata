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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-gradient-to-r from-[#3d85c6] to-[#004dd6] hover:from-[#003cb3] rounded-2xl p-8 mb-8 text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Hi,{" "}
            <span className="bg-gradient-to-r from-[#ffd166] to-[#eba80e] bg-clip-text text-transparent">
              {user?.name || "Dr. Doctor"}
            </span> , Welcome to Dashboard
            </h1>
            <p className="text-blue-100 text-lg">
              {user?.patientCount || "6"} patients • {user?.transcriptCount || "3"} transcripts available
            </p>
          </div>

          {isFirstLogin && (
            <div className="mt-4 md:mt-0">
              <InvertedGradientButton
                onClick={handleSetupClick}
                color="amber"
              >
                <Settings className="w-8 h-8 pr-2" />
                Complete Setup
              </InvertedGradientButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;