"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import GradientButton from "@/components/common/GradientButton";
import { LogOut } from "lucide-react";

const Sidebar = ({ items = [] }) => {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path) => pathname === path;
  
  const handleTabClick = (path) => {
    router.push(path);
  };

  // Group items by section
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.sec]) {
      acc[item.sec] = [];
    }
    acc[item.sec].push(item);
    return acc;
  }, {});

  const sections = Object.keys(groupedItems);

  return (
    <div className="bg-[#02173a] rounded-r-[4rem] text-white h-screen w-[17rem] flex flex-col fixed left-0 top-0 transition-all duration-500 ease-in-out">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 mt-4">
        <div className="flex items-center space-x-2 mx-8">
          <div className="w-8 h-8 bg-white rounded-2xl flex items-center justify-center ">
            <span className="text-[#004dd6] text-2xl font-bold">M</span>
          </div>
          <span className="text-xl font-bold text-white font-poppins">MediCare</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-2 px-4 flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {sections.map((section, sectionIndex) => (
            <li key={section}>
              {/* Section Heading */}
              <h3 className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {section}
              </h3>
              
              {/* Menu Items for this section */}
              <ul className="space-y-2">
                {groupedItems[section].map((item) => (
                  <li key={item.id}>
                    <button
                      className={`w-full cursor-pointer flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-300 ease-in-out font-gothambook ${
                        isActive(item.path)
                          ? "border border-[#004dd6] text-white shadow-lg"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                      onClick={() => handleTabClick(item.path)}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
              
              {/* Horizontal divider (except after last section) */}
              {sectionIndex < sections.length - 1 && (
                <hr className="my-4 border-gray-700" />
              )}
            </li>
          ))}
        </ul>
        <GradientButton
            onClick={() => router.push("/")}
            color="red"
            size="medium"
            className="cursor-pointer mt-[2rem]"
          >
            Logout
            <LogOut className="w-5 h-5" />
        </GradientButton>
      </nav>
    </div>
  );
};

export default Sidebar;