"use client";

import { useEffect, useState } from "react";
import { Clock4, Shield, SquareActivity, Users, HeartPlus, Zap, Sparkles } from "lucide-react";
import FloatingBubbles from "@/components/common/animations/FloatingBubbles";

const benefitsData = [
  {
    title: "24/7 Availability",
    description:
      "Access healthcare anytime, anywhere. No more waiting for office hours or emergency room queues.",
    icon: (<Clock4 className="w-12 h-12 text-[var(--color-secondary)]" />),
    badge: "99.9% Uptime",
  },
  {
    title: "Secure & Private",
    description:
      "Regulations compliant platform with end-to-end encryption. Your health data is always protected.",
    icon: (<Shield className="w-12 h-12 text-[var(--color-secondary)]" />),
    badge: "Bank-level Security",
  },
  {
    title: "Smooth Care",
    description:
      "Crystal-clear audio and video with smooth, uninterrupted consultations for stress-free care.",
    icon: (<SquareActivity className="w-12 h-12 text-[var(--color-secondary)]" />),
    badge: "Zero hassle",
  },  
  {
    title: "Expert Doctors",
    description:
      "Board-certified physicians with years of experience. Verified credentials and patient reviews.",
    icon: (<Users className="w-12 h-12 text-[var(--color-secondary)]" />),
    badge: "15+ Specialists",
  },
  {
    title: "Personalized Care",
    description:
      "Tailored treatment plans based on your medical history and current health conditions.",
    icon: (<HeartPlus className="w-12 h-12 text-[var(--color-secondary)]" />),
    badge: "95% Satisfaction Rate",
  },
  {
    title: "Instant Results",
    description:
      "Get prescriptions, lab orders, and medical certificates delivered instantly to your device.",
    icon: (<Zap className="w-12 h-12 text-[var(--color-secondary)]" />),
    badge: "Under 2 Minutes",
  },
];

export default function WhyChoose() {
  const [mounted, setMounted] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoverTimers, setHoverTimers] = useState({});
  const [visibleCards, setVisibleCards] = useState([]);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [illustrationVisible, setIllustrationVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Animate illustration first
          setTimeout(() => {
            setIllustrationVisible(true);
          }, 200);
          
          // Animate header second
          setTimeout(() => {
            setHeaderVisible(true);
          }, 400);
          
          // Staggered animation for cards
          setTimeout(() => {
            benefitsData.forEach((_, index) => {
              setTimeout(() => {
                setVisibleCards(prev => [...prev, index]);
              }, index * 150); // 150ms delay between each card
            });
          }, 600); // Start cards animation after header
          
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const sectionElement = document.getElementById('benefits');
    if (sectionElement) {
      observer.observe(sectionElement);
    }

    return () => {
      if (sectionElement) {
        observer.unobserve(sectionElement);
      }
    };
  }, []);

  const handleMouseEnter = (index) => {
    // Clear any existing timer for this card
    if (hoverTimers[index]) {
      clearTimeout(hoverTimers[index]);
    }

    // Set new timer for this card
    const timer = setTimeout(() => {
      setHoveredCard(index);
    }, 15000); // 500ms delay before showing image

    setHoverTimers(prev => ({
      ...prev,
      [index]: timer
    }));
  };

  const handleMouseLeave = (index) => {
    // Clear timer when mouse leaves
    if (hoverTimers[index]) {
      clearTimeout(hoverTimers[index]);
    }
    setHoveredCard(null);
  };

  return (
    <section id="benefits" className="py-8 bg-gradient-to-b from-[#b9d0f5] to-[#3d85c6]">
      <div className="max-w-[1472px] mx-auto ">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left side - Bubble animation/image */}
          <div className="lg:w-2/5 flex items-center justify-center">
            <div className={`relative w-full h-64 lg:h-96 transition-all duration-700 ease-out ${
              illustrationVisible 
                ? "opacity-100 translate-y-0 scale-100" 
                : "opacity-0 translate-y-8 scale-95"
            }`}>
              <FloatingBubbles />
              
              {/* Central illustration/icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-40 h-40 lg:w-56 lg:h-56 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl transition-all duration-700 ease-out ${
                  illustrationVisible 
                    ? "scale-100 rotate-0" 
                    : "scale-75 rotate-12"
                }`}>
                  <svg className="w-20 h-20 lg:w-28 lg:h-28 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Content */}
          <div className="lg:w-3/5">
            <div className={`text-center lg:text-left mb-12 transition-all duration-700 ease-out ${
              headerVisible 
                ? "opacity-100 translate-y-0" 
                : "opacity-0 translate-y-8"
            }`}>
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide mb-6">
                <Sparkles className="w-4 h-4" />
                <span className="uppercase">Why Choose Us</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Healthcare{" "}
                <span className="bg-gradient-to-r from-[#ffd166] to-[#eba80e] bg-clip-text text-transparent">
                  Benefits
                </span>
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto lg:mx-0">
                Experience the future of healthcare with our comprehensive platform designed to make quality medical care accessible to everyone.
              </p>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-3 gap-4 sm:gap-6">
              {benefitsData.map((benefit, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => handleMouseEnter(idx)}
                  onMouseLeave={() => handleMouseLeave(idx)}
                  className={`group relative bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 sm:p-5 border border-gray-100 transition-all duration-700 ease-out overflow-hidden hover:-translate-y-1 hover:scale-102 cursor-pointer min-h-[180px] ${
                    visibleCards.includes(idx) 
                      ? "opacity-100 translate-y-0 scale-100" 
                      : "opacity-0 translate-y-8 scale-95"
                  }`}
                  style={{
                    transitionDelay: `${idx * 50}ms`
                  }}
                >
                  {/* Background Image that appears on hover */}
                  <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                    hoveredCard === idx ? 'opacity-100' : 'opacity-0'
                  }`}>
                    <img 
                      src={benefit.image} 
                      alt={benefit.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60"></div>
                  </div>

                  {/* Content */}
                  <div className={`relative z-10 transition-all duration-300 ${
                    hoveredCard === idx ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="flex flex-col sm:flex-row items-center text-center sm:items-center space-y-2 sm:space-x-4 mb-4 sm:mb-6">
                      {/* Icon */}
                      <div className={`w-18 h-18 sm:w-14 sm:h-14 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                        hoveredCard === idx ? 'text-white' : 'text-[var(--color-secondary)]'
                      }`}>
                        {benefit.icon}
                      </div>

                      {/* Title */}
                      <h3 className={`text-base sm:text-xl font-bold transition-colors ${
                        hoveredCard === idx ? 'text-white' : 'text-gray-900 group-hover:text-blue-600'
                      }`}>
                        {benefit.title}
                      </h3>
                    </div>

                    {/* Description - hidden on small screens */}
                    <p className={`hidden sm:block leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base transition-all duration-300 ${
                      hoveredCard === idx ? 'opacity-100 text-white' : 'opacity-100 text-gray-600'
                    }`}>
                      {benefit.description}
                    </p>

                    {/* Badge */}
                    <div className={`hidden sm:inline-flex items-center space-x-2 px-4 py-1 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 ${
                      hoveredCard === idx 
                        ? 'bg-white/20 text-white backdrop-blur-sm' 
                        : 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        hoveredCard === idx ? 'bg-white' : 'bg-gradient-to-r from-blue-600 to-blue-800'
                      }`}></div>
                      <span className={`text-xs sm:text-sm font-semibold transition-colors ${
                        hoveredCard === idx ? 'text-white' : 'text-gray-700 group-hover:text-blue-600'
                      }`}>
                        {benefit.badge}
                      </span>
                    </div>
                  </div>

                  {/* Hover overlay content */}
                  <div className={`absolute inset-0 flex items-center justify-center p-4 transition-all duration-300 ${
                    hoveredCard === idx ? 'opacity-100' : 'opacity-0'
                  }`}>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .hover\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </section>
  );
}