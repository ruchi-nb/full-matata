// File: components/PatientPortal/home/HeroSection.jsx
"use client";
import React, { useState, useEffect } from 'react';
import WavyDivider from '@/components/common/WavyDivider';
import { useRouter } from 'next/navigation';
import { MoveDown, Search } from 'lucide-react';
import OutlineButton from '@/components/common/OutlineButton';
import GradientButton from '@/components/common/GradientButton';

import { useUser } from '@/data/UserContext';

const HeroSection = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);

  const handleFindSpecialty = () => {
    const specialtiesSection = document.getElementById('specialties-section');
    if (specialtiesSection) {
      specialtiesSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  const handleFindDoctor = () => {
    router.push('/patientportal/doctors');
  };

  // Scroll-based reveal animation setup
  useEffect(() => {
    setMounted(true);
    
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Animate title first
          setTimeout(() => {
            setTitleVisible(true);
          }, 200);
          
          // Animate subtitle second
          setTimeout(() => {
            setSubtitleVisible(true);
          }, 400);
          
          // Animate buttons third
          setTimeout(() => {
            setButtonsVisible(true);
          }, 600);
          
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const sectionElement = document.querySelector('.hero-section');
    if (sectionElement) {
      observer.observe(sectionElement);
    }

    return () => {
      if (sectionElement) {
        observer.unobserve(sectionElement);
      }
    };
  }, []);

  // Function to get the display name from user data
  // const getDisplayName = () => {
  //   if (!user) return "Guest";
    
  //   return user.first_name || user.name || user.username || "Guest";
  // };


  return (
    <>
      <div className="h-auto min-h-[500px] bg-[#fdfeff]">
        <section className="hero-section relative px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="max-w-7xl mx-auto text-center">
            <div className="my-18">
              <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 transition-all duration-700 ease-out ${
                titleVisible 
                  ? "opacity-100 translate-y-0" 
                  : "opacity-0 translate-y-8"
              }`}>
                How do we get started today? 
              </h1>
              <p className={`text-xl text-gray-600 max-w-3xl mx-auto transition-all duration-700 ease-out ${
                subtitleVisible 
                  ? "opacity-100 translate-y-0" 
                  : "opacity-0 translate-y-8"
              }`}>
                Connect with qualified healthcare professionals from the comfort of your home. Quality care is just a click away.
              </p>
            </div>
            <div className={`flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 transition-all duration-700 ease-out ${
              buttonsVisible 
                ? "opacity-100 translate-y-0" 
                : "opacity-0 translate-y-8"
            }`}>
              <GradientButton
                id="btn-specialty"
                onClick={handleFindSpecialty}
                className="w-full cursor-pointer sm:w-auto px-8 py-4 font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <span>Find My Specialty</span>
                <MoveDown className='w-8 h-8'/>
              </GradientButton>
              <OutlineButton
                id="btn-doctor"
                onClick={handleFindDoctor}
                className="w-full cursor-pointer sm:w-auto bg-white hover:bg-gray-50 px-8 py-4 font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <Search className='w-5 h-5'/>
                <span>Find My Doctor</span>
              </OutlineButton>
            </div>
          </div>
        </section>
      </div>
      <div className='-mt-32'>
        <WavyDivider className='text-[#b9d0f5]'/>
      </div>
    </>
  );
};

export default HeroSection;