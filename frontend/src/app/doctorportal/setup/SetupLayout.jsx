"use client";

import React from "react";

const SetupLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[#004dd6] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
};

export default SetupLayout;
