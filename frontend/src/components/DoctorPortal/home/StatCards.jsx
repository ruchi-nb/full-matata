"use client";
import React from "react";

const StatCard = ({ title, value, icon: Icon, iconColor }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3">
        <div className={`p-2 ${iconColor.replace('text-', 'bg-').replace('-600', '-50')} rounded-lg`}>
          <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;