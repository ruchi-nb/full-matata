"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowRight, Clock, Shield, Calendar, Sparkles } from "lucide-react";
import GradientButton from "../common/GradientButton";
import LoginPopup from "@/components/Landing/LoginPopUp";
import WavyDivider from "@/components/common/WavyDivider";
import "@/app/globals.css";

export default function HeroSection() {
  const heroRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          hero.classList.add("opacity-100", "translate-y-0");
          hero.classList.remove("opacity-0", "translate-y-10");
        }
      });
    }, { threshold: 0.1 });

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <>
      <section
        ref={heroRef}
        className="relative z-10 max-w-7xl mx-auto mt-10 pt-20 px-6 pb-32 opacity-0 translate-y-10 transition-all duration-1000 font-[var(--font-body)]"
      >
        <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="uppercase">Get consultations instantly</span>
            </div>

            {/* Heading */}
            <h1 className="h2 font-bold leading-tight">
              Healthcare
              <span className="block bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent">Made Simple</span>
            </h1>

            {/* Subtext */}
            <p className="p leading-relaxed max-w-lg">
              Connect with top-rated doctors instantly. Get expert medical advice,
              prescriptions, and care plans from the comfort of your home.
            </p>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-4">
              <GradientButton
                onClick={() => setIsLoginOpen(true)}>
                <span>Start Consultation</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </GradientButton>
            </div>

            {/* Login Popup */}
                    <LoginPopup
                      open={isLoginOpen}
                      onClose={() => setIsLoginOpen(false)}
                    />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#004dd6] font-poppins">50K+</div>
                <div className="text-gray-600 text-sm font-gotham">Happy Patients</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#3d85c6] font-poppins">1000+</div>
                <div className="text-gray-600 text-sm font-gotham">Expert Doctors</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#004dd6] font-poppins">24/7</div>
                <div className="text-gray-600 text-sm font-gotham">Available</div>
              </div>
            </div>
          </div>

          {/* Right Content */}
            <div className="hidden md:block relative z-10 transition-all duration-1000 delay-300 opacity-100 translate-y-0">
              <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl p-8 shadow-2xl">
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-14 h-14 flex items-center justify-center">
                      <Shield className="w-8 h-8 text-[#004dd6]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 font-heading">
                        Secure & Reliable Care
                      </h3>
                      <p className="text-gray-600 text-sm font-body">Your privacy, our priority</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <ul className="space-y-3 text-sm text-gray-700 font-gotham">
                      <li className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-[#3d85c6]" />
                        <span>24/7 encrypted consultations</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-[#004dd6]" />
                        <span>Verified & licensed doctors</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-[#3d85c6]" />
                        <span>Confidential health records</span>
                      </li>
                    </ul>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 italic font-gotham">
                        “We combine expertise with technology to ensure every consultation is safe, private, and trustworthy.”
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </section>
          {/* Wavy Divider at the bottom */}
          <div className="-mt-32">
            <WavyDivider className="text-[#b9d0f5] " />
          </div>
      </>
  );
}
