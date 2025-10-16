"use client";

import { useState } from "react";
import { motion } from "framer-motion"; 
import LoginPopup from "@/components/Landing/LoginPopUp";
import { Search, UserRoundSearch, Video, FilePlus, Sparkles, ArrowRight } from "lucide-react";
import InvertedGradientButton from "../common/InvertedGradientButton";

const steps = [
  {
    title: "Register Your Account",
    description:
      "Log in to get access to our network of certified healthcare professionals.",
    icon: <Search className="w-8 h-8 text-[var(--color-secondary)]" />,
  },
  {
    title: "Find Your Doctor",
    description:
      "Browse through our network of certified healthcare professionals and find the right specialist for your needs.",
    icon: <UserRoundSearch className="w-8 h-8 text-[var(--color-secondary)]" />,
  },
  {
    title: "Start Consultation",
    description:
      "Connect with your doctor through secure video calls. Discuss symptoms, get diagnosis, and receive treatment plans.",
    icon: <Video className="w-8 h-8 text-[var(--color-secondary)]" />,
  },
  {
    title: "Get Prescription",
    description:
      "Receive digital prescriptions and treatment plans instantly. Access your medical records anytime, anywhere.",
    icon: <FilePlus className="w-8 h-8 text-[var(--color-secondary)]" />,
  },
];

// StepCard motion wrapper
function StepCard({ icon, title, description, custom }) {
  return (
    <motion.div
      className="flex items-start space-x-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition"
      initial={{ opacity: 0.3, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }} // triggers on scroll
      viewport={{ once: true, amount: 0.5 }} // animate once when 30% visible
      transition={{ delay: custom * 0.2, duration: 0.6, ease: "easeInOut" }}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <h4 className="h4 font-semibold mb-1">{title}</h4>
        <p className="p">{description}</p>
      </div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <section id="how-it-works" className="pt-[140px] pb-[80px] bg-[#b9d0f5]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* LEFT COLUMN */}
        <div>
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="uppercase">Connect in Minutes</span>
          </div>
          <h2 className="h2 mb-[var(--space-heading)]">
            How It{" "}
            <span className="bg-gradient-to-r from-[#ffd166] to-[#eba80e] bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="p mb-[var(--space-subheading)] max-w-lg">
            Getting quality healthcare has never been easier. Follow these
            simple steps to connect with top doctors and get the care you need.
          </p>
          <InvertedGradientButton onClick={() => setIsLoginOpen(true)}>
            <span>Start Call Now</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </InvertedGradientButton>
        </div>

        {/* RIGHT COLUMN */}
        <div className="relative">
          <div className="grid gap-6 relative z-10">
            {steps.map((step, idx) => (
              <StepCard
                key={idx}
                icon={step.icon}
                title={step.title}
                description={step.description}
                custom={idx} // used for stagger
              />
            ))}
          </div>
        </div>
      </div>

      {/* Login Popup */}
      <LoginPopup open={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </section>
  );
}
