// File: components/PatientPortal/home/DoctorModal.jsx
"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doctors } from '@/data/doctors';
import Consult from '@/components/PatientPortal/home/Consult';
import InvertedGradientButton from '@/components/common/InvertedGradientButton';
import OutlineButton from '@/components/common/OutlineButton';

import { Calendar, Medal, Globe, MapPin, Eye, Image, X } from 'lucide-react';

// Add custom CSS for select dropdown hover
const selectStyles = `
  select option:hover {
    background-color: #fbbf24 !important;
    color: white !important;
  }
  
  select option:checked {
    background-color: #fbbf24;
    color: white;
  }
`;

const DoctorCard = ({ doctor, onView, onConsult }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-48">
        <img 
          alt={doctor.name} 
          className="w-full h-full object-cover" 
          src={doctor.image}
        />
        <div className="absolute top-4 right-4">
          <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
            Available
          </div>
        </div>
        
        {/* Hover Overlay */}
        <div className={`
          absolute inset-0 bg-black/40 transition-all duration-300 ease-in-out
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `} />
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 font-poppins">{doctor.name}</h3>
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-600">
            <Medal className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="text-sm font-gothambook">{doctor.specialty}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="text-sm font-gothambook">{doctor.experience}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Globe className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="text-sm font-gothambook">{doctor.languages}</span>
          </div>          
        </div>
        <div className="mb-4">
          <div className="flex items-start text-gray-600">
            <MapPin className="h-4 w-4 mr-2 mt-1" aria-hidden="true" />
            <span className="text-sm font-gothambook">{doctor.hospitals}</span>
          </div>
        </div>
        
        {/* Buttons Container - Hidden by default, slides up on hover */}
        <div className={`
          absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent
          transition-all duration-300 ease-in-out transform
          ${isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
        `}>
          <div className="flex space-x-3">
            <OutlineButton 
              onClick={() => onView(doctor)}
              className="flex-1 bg-white/90 backdrop-blur-sm hover:bg-white"
              color="blue"
              size="medium"
              icon={
                <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
              }
            >
              View
            </OutlineButton>
            <InvertedGradientButton 
              onClick={() => onConsult(doctor)}
              className="flex-1"
            >
              Consult
            </InvertedGradientButton>
          </div>
        </div>
      </div>
    </div>
  );
};

const DoctorListing = () => {
  const router = useRouter();
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConsultation, setShowConsultation] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');

  // Extract unique specialties and languages from doctors data
  const specialties = ['all'];
  const languages = ['all'];
  
  // Get unique specialties
  doctors.forEach(doctor => {
    if (!specialties.includes(doctor.specialty)) {
      specialties.push(doctor.specialty);
    }
  });
  
  // Get unique languages
  doctors.forEach(doctor => {
    const doctorLanguages = doctor.languages.split(',').map(lang => lang.trim());
    doctorLanguages.forEach(lang => {
      if (!languages.includes(lang)) {
        languages.push(lang);
      }
    });
  });
  
  // Sort languages alphabetically
  languages.sort();

  // Filter doctors based on selected filters
  const filteredDoctors = doctors.filter(doctor => {
    const matchesSpecialty = selectedSpecialty === 'all' || doctor.specialty === selectedSpecialty;
    
    const doctorLanguages = doctor.languages.split(',').map(lang => lang.trim());
    const matchesLanguage = selectedLanguage === 'all' || doctorLanguages.includes(selectedLanguage);
    return matchesSpecialty && matchesLanguage;
  });

  const handleViewDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setIsModalOpen(true);
  };

  const handleConsultDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setShowConsultation(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDoctor(null);
  };

  const handleConsultFromModal = () => {
    if (selectedDoctor) {
      closeModal();
      setShowConsultation(true);
    }
  };

  const handleCloseConsultation = () => {
    setShowConsultation(false);
    setSelectedDoctor(null);
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && (isModalOpen || showConsultation)) {
        if (showConsultation) {
          handleCloseConsultation();
        } else {
          closeModal();
        }
      }
    };

    if (isModalOpen || showConsultation) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, showConsultation]);

  return (
    <>
      {/* Add the style tag for custom select styles */}
      <style jsx global>{selectStyles}</style>
      
      {showConsultation ? (
        <div className="fixed inset-0 bg-white z-50">
          <Consult doctor={selectedDoctor} onBack={handleCloseConsultation} />
        </div>
      ) : (
        <div className="min-h-screen bg-gradient-to-b from-[#b9d0f5] via-[#5894d0] to-[#2975cb] py-8 pt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
                <h1 className="text-3xl font-bold text-white mb-2 font-poppins">Available Doctors</h1>
                
                {/* Filter options - responsive layout */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex flex-col">
                    <label htmlFor="specialty-filter" className="text-sm font-medium text-white mb-1 font-gothambook">
                      Specialty
                    </label>
                    <select
                      id="specialty-filter"
                      value={selectedSpecialty}
                      onChange={(e) => setSelectedSpecialty(e.target.value)}
                      className="border border-gray-300 bg-white rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#fbbf24] focus:border-[#fbbf24] font-gothambook hover:border-[#fbbf24] transition-colors"
                    >
                      {specialties.map(specialty => (
                        <option key={specialty} value={specialty} className='font-gothambook'>
                          {specialty === 'all' ? 'All Specialties' : specialty}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex flex-col">
                    <label htmlFor="language-filter" className="text-sm font-medium text-white mb-1 font-gothambook">
                      Language
                    </label>
                    <select
                      id="language-filter"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="border border-gray-300 bg-white rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#fbbf24] focus:border-[#fbbf24] font-gothambook hover:border-[#fbbf24] transition-colors"
                    >
                      {languages.map(language => (
                        <option key={language} value={language}>
                          {language === 'all' ? 'All Languages' : language}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {filteredDoctors.length === 0 ? (
              <div className="text-center py-12 bg-white/90 rounded-xl backdrop-blur-sm">
                <p className="text-gray-500 text-lg font-gothambook">No doctors match your selected filters.</p>
                <OutlineButton
                  onClick={() => {
                    setSelectedSpecialty('all');
                    setSelectedLanguage('all');
                  }}
                  className="mt-4 mx-auto"
                  color="blue"
                  size="medium"
                >
                  Reset Filters
                </OutlineButton>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDoctors.map((doctor, index) => (
                  <DoctorCard 
                    key={index} 
                    doctor={doctor} 
                    onView={handleViewDoctor}
                    onConsult={handleConsultDoctor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && selectedDoctor && (
        <div 
          className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 font-poppins">Doctor Profile</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6 mr-2 mt-1 text-black"/>
              </button>
            </div>

            <div className="p-6">
              <div className="bg-gradient-to-r from-[#3d85c6] to-[#004dd6] rounded-lg p-6 mb-6">
                <div className="flex items-center space-x-6">
                  <img 
                    src={selectedDoctor.image} 
                    alt={selectedDoctor.name}
                    className="w-24 h-24 rounded-full border-4 border-white object-cover"
                  />
                  <div className="text-white">
                    <h1 className="text-2xl font-bold mb-2 font-poppins">{selectedDoctor.name}</h1>
                    <p className="text-lg opacity-90 font-gothambook">{selectedDoctor.specialty}</p>
                    <div className="flex items-center mt-2">
                      <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium font-gothambook">
                        Available
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 font-poppins">About</h3>
                  <p className="text-gray-600 leading-relaxed mb-6 font-gothambook">{selectedDoctor.biography}</p>

                  <h4 className="text-lg font-semibold text-gray-900 mb-3 font-poppins">Education</h4>
                  <p className="text-gray-600 mb-6 font-gothambook">{selectedDoctor.education}</p>

                  <h4 className="text-lg font-semibold text-gray-900 mb-3 font-poppins">Hospital Affiliations</h4>
                  <p className="text-gray-600 mb-6 font-gothambook">{selectedDoctor.hospitals}</p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 font-poppins">Professional Details</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 mr-2 mt-1 text-[#2975cb]"/>
                      <span className="text-gray-700 font-gothambook">{selectedDoctor.experience}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Globe className="h-4 w-4 mr-2 mt-1 text-[#2975cb]"/>
                      <span className="text-gray-700 font-gothambook">{selectedDoctor.languages}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Image className="h-4 w-4 mr-2  text-[#2975cb]"/>
                      <span className="text-gray-700 font-gothambook">License: {selectedDoctor.license}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 mt-6 pt-6 border-t border-gray-200">
                <InvertedGradientButton
                  onClick={handleConsultFromModal}
                  className="flex-1"
                >
                  Start Consultation
                </InvertedGradientButton>
                <OutlineButton
                  onClick={closeModal}
                  className="flex-1"
                  color="gray"
                  size="large"
                >
                  Close
                </OutlineButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DoctorListing;