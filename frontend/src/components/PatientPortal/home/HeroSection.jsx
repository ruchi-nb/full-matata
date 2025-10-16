// File: components/PatientPortal/home/HeroSection.jsx
"use client";
import React from 'react';
import WavyDivider from '@/components/common/WavyDivider';
import { useRouter } from 'next/navigation';
import { MoveDown, Search } from 'lucide-react';
import OutlineButton from '@/components/common/OutlineButton';
import GradientButton from '@/components/common/GradientButton';

import { useUser } from '@/data/UserContext';

const HeroSection = () => {
  const router = useRouter();

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

  // Function to get the display name from user data
  // const getDisplayName = () => {
  //   if (!user) return "Guest";
    
  //   return user.first_name || user.name || user.username || "Guest";
  // };


  return (
    <>
      <div className="h-auto min-h-[500px] bg-[#fdfeff]">
        <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="max-w-7xl mx-auto text-center">
            <div className="my-18">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                How do we get started today? 
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Connect with qualified healthcare professionals from the comfort of your home. Quality care is just a click away.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
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