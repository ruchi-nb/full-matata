"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import GradientButton from "@/components/common/GradientButton";
import { LogOut, Menu, X } from "lucide-react";

const Sidebar = ({ items = [] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => pathname === path;
  
  const handleTabClick = (path) => {
    router.push(path);
    // Close mobile menu after navigation
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobileMenuOpen && !event.target.closest('.mobile-menu-container')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Group items by section
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.sec]) {
      acc[item.sec] = [];
    }
    acc[item.sec].push(item);
    return acc;
  }, {});

  const sections = Object.keys(groupedItems);

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 mt-4">
        <div className="flex items-center space-x-2 mx-8">
          <div className="w-8 h-8 bg-white rounded-2xl flex items-center justify-center ">
            <span className="text-[#004dd6] text-2xl font-bold">N</span>
          </div>
          <span className="text-xl font-bold text-white font-poppins">Neuralbits</span>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden p-2 rounded-md hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
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
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#02173a] text-white rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block bg-[#02173a] rounded-r-[4rem] text-white h-screen w-[17rem] flex flex-col fixed left-0 top-0 transition-all duration-500 ease-in-out">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="mobile-menu-container fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-[#02173a] text-white flex flex-col transition-all duration-300 ease-in-out">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;