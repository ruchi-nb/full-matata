// File: src/components/Landing/Navbar.js
"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoginPopup from "@/components/Landing/LoginPopUp";
import RegisterModal from "@/components/Landing/RegisterModal";
import OutlineButton from "@/components/common/OutlineButton";
import GradientButton from "@/components/common/GradientButton";
import "remixicon/fonts/remixicon.css";

export default function Navbar({ navItems = [], onLogin, onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const handleClick = (item) => {
    if (item.type === "link") {
      router.push(item.path);
    } else if (item.type === "scroll") {
      const el = document.getElementById(item.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (item.type === "login") {
      setLoginOpen(true);
    } else if (item.type === "logout") {
      onLogout && onLogout();
    } else if (item.type === "register") {
      setRegisterOpen(true);
    }
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav className="w-full bg-white fixed top-0 left-0 z-50 shadow-sm font-poppins">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
          {/* Logo */}
          <div
            className="text-[2.5rem] font-normal text-[#004dd6] cursor-pointer leading-none"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            MediCare
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center justify-end gap-4 font-gotham text-[1rem] font-light">
            {navItems.map((item, idx) =>
              item.variant === "outline" ? (
                <OutlineButton 
                  key={idx} 
                  onClick={() => handleClick(item)} 
                  className="whitespace-nowrap cursor-pointer py-1.5 px-3 text-sm"
                  color={item.color}
                >
                  {item.icon && <i className={`${item.icon} mr-2`}></i>} {item.label}
                </OutlineButton>
              ) : item.variant === "gradient" ? (
                <GradientButton 
                  key={idx} 
                  onClick={() => handleClick(item)} 
                  className="whitespace-nowrap cursor-pointer py-2 px-3 text-sm"
                  color={item.color}
                >
                  {item.label}
                </GradientButton>
              ) : (
                <button
                  key={idx}
                  onClick={() => handleClick(item)}
                  className="px-3 cursor-pointer py-1.5 rounded-md text-sm font-medium whitespace-nowrap text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                >
                  {item.icon && <i className={`${item.icon} mr-2`}></i>} {item.label}
                </button>
              )
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-blue-600 focus:outline-none"
            >
              {isMenuOpen ? (
                <i className="ri-close-line text-2xl"></i>
              ) : (
                <i className="ri-menu-line text-2xl"></i>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#c8c8c8] shadow-md">
            <div className="flex flex-col items-center space-y-4 px-4 py-6 font-gotham text-[1rem] font-light">
              {navItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleClick(item)}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 hover:text-blue-600 hover:bg-gray-50 whitespace-nowrap"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Modals */}
      <LoginPopup
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={() => {
          onLogin && onLogin();
          setLoginOpen(false);
        }}
      />

      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />
    </>
  );
}