// frontend-ui/src/components/Landing/ScrollRevealCTA.jsx
"use client";

import { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import LoginPopup from "@/components/Landing/LoginPopUp";
import InvertedGradientButton from "../common/InvertedGradientButton";
import "@/app/globals.css";

export default function ScrollRevealCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show CTA after scrolling 300px
      if (window.scrollY > 300 && !isDismissed) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll);
    
    // Clean up
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  return (
    <>
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-in-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 border border-gray-200 relative">
          {/* Close button */}
          <button 
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close banner"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Content */}
          <h3 className="text-xl text-gray-900 mb-2 pr-6 font-[var(--font-heading)]">
            Ready to Transform Your Healthcare?
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            Join thousands of patients using modern healthcare technology.
          </p>
          
          <InvertedGradientButton
            onClick={() => setIsLoginOpen(true)}>
            <span>Log In Now</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </InvertedGradientButton>
        </div>
      </div>

      <LoginPopup open={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
} 