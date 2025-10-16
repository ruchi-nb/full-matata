"use client";
import Navbar from "@/components/Landing/Navbar";
import HeroSection from "@/components/Landing/HeroSection";
import HowItWorks from "@/components/Landing/HowItWorks";
import WhyChoose from "@/components/Landing/Benefits";
import SidePop from "@/components/Landing/SecondCTA";
import Specialties from '@/components/Landing/SpecialtyCards';
import Footer from "@/components/Landing/Footer";

const landingNavItems = [
  { type: "scroll", id: "how-it-works", label: "How It Works" },
  { type: "scroll", id: "benefits", label: "Benefits" },
  { type: "scroll", id: "specialties", label: "Specialties" },
  { type: "login", label: "Login", icon: "ri-login-circle-line", variant: "outline" },
  { type: "register", label: "Register", variant: "gradient" }
];

export default function Home() {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
        <Navbar navItems={landingNavItems} />
        <HeroSection />
        <HowItWorks id="how-it-works" />
        <WhyChoose id="benefits" />
        <SidePop />
        <Specialties id="specialties" />
        <Footer />
      </div>
    </>
  );
}