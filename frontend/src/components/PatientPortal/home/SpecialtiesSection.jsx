"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from 'lucide-react';
import { specialties } from "@/data/Specialties";

const SpecialtiesSection = () => {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [showLanguage, setShowLanguage] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const hoverTimers = useRef({});

  const openSpecialtyModal = (specialtyName) => {
    const specialty = specialties[specialtyName];
    if (!specialty) return;

    setShowLanguage(false);
    setSelectedDoctor(null);
    setModalContent(
      <div className="max-h-[70vh] overflow-y-auto">
        <h2 className="text-2xl text-black font-bold mb-4">{specialtyName}</h2>
        <p className="mb-6 text-gray-700">{specialty.longDescription}</p>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Common Conditions:</h3>
          <div className="flex flex-wrap gap-2">
            {specialty.commonConditions?.map((condition, idx) => (
              <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {condition}
              </span>
            ))}
          </div>
        </div>

        <h3 className="text-xl text-black font-semibold mb-4 border-b pb-2">Available Doctors</h3>
        <div className="space-y-6">
          {specialty.doctors.map((doc, index) => (
            <div key={index} className="flex flex-col sm:flex-row items-start justify-between p-4 bg-gray-50 rounded-xl shadow-sm border border-gray-100">
              <div className="mb-4 sm:mb-0 sm:mr-4 flex-1">
                <h4 className="font-semibold text-gray-900 text-lg">{doc.name}</h4>
                <p className="text-gray-600">{doc.role}</p>
                <p className="text-gray-600 text-sm mt-1">{doc.experience} of experience</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative mb-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 overflow-hidden">
                    {doc.img ? (
                      <img 
                        src={doc.img} 
                        alt={doc.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${doc.img ? 'hidden' : 'flex'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  </div>
                  <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${doc.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </div>
                <button
                  className={`mt-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                    doc.active 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    setSelectedDoctor(doc);
                    setShowLanguage(true);
                  }}
                  disabled={!doc.active}
                >
                  {doc.active ? "Start Consultation" : "Not Available"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
    setModalOpen(true);
  };

  const handleStartConsultation = () => {
  if (selectedDoctor) {
    setModalOpen(false);
    setShowLanguage(false);
    
    // Use name as identifier since IDs aren't provided in the data
    const doctorIdentifier = selectedDoctor.name;
    
    // Change 'doctor' to 'doctorId' to match consult/page.jsx
    router.push(`/patientportal/consult?doctorId=${selectedDoctor.id}&language=${selectedLanguage}`);

  } else {
    console.error("No doctor selected");
    alert("Please select a doctor first");
  }
};

  const handleMouseEnter = (specialtyName) => {
    // Clear any existing timer for this card
    if (hoverTimers.current[specialtyName]) {
      clearTimeout(hoverTimers.current[specialtyName]);
    }

    // Set new timer
    hoverTimers.current[specialtyName] = setTimeout(() => {
      setHoveredCard(specialtyName);
    }, 15000); // 15 seconds
  };

  const handleMouseLeave = (specialtyName) => {
    // Clear timer when mouse leaves
    if (hoverTimers.current[specialtyName]) {
      clearTimeout(hoverTimers.current[specialtyName]);
      delete hoverTimers.current[specialtyName];
    }
    setHoveredCard(null);
  };

  const renderLanguageModal = () => (
    <div>
      <h2 className="text-2xl text-black font-bold mb-4">Select Language</h2>
      <p className="mb-4 text-gray-600">Please select your preferred language for the consultation:</p>
      
      {selectedDoctor && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-800 font-medium">Selected Doctor: {selectedDoctor.name}</p>
          <p className="text-blue-600 text-sm">{selectedDoctor.role}</p>
        </div>
      )}
      
      <select 
        className="w-full text-gray-700 border border-gray-300 rounded-lg p-3 mb-6 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={selectedLanguage}
        onChange={(e) => setSelectedLanguage(e.target.value)}
      >
        <option value="pt">🇵🇹 Portuguese</option>
        <option value="en">🇺🇸 English</option>
        <option value="es">🇪🇸 Spanish</option>
        <option value="fr">🇫🇷 French</option>
        <option value="zh">🇨🇳 Mandarin</option>
        <option value="hi">🇮🇳 Hindi</option>
        <option value="gu">🇮🇳 Gujarati</option>
        <option value="kr">🇰🇷 Korean</option>
      </select>
      
      <div className="flex justify-end space-x-4">
        <button
          className="px-4 py-2 rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          onClick={() => {
            setShowLanguage(false);
            setSelectedDoctor(null);
          }}
        >
          Back
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          onClick={handleStartConsultation}
        >
          Confirm and Proceed
        </button>
      </div>
    </div>
  );

  return (
    <>
      <section
        id="specialties-section"
        className="relative px-4 sm:px-6 lg:px-8 py-20 bg-[#b9d0f5] overflow-hidden"
      >
        {/* Animated Bubbles with Framer Motion */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => {
            const size = Math.random() * 40 + 20;
            const left = `${Math.random() * 100}%`;
            const delay = Math.random() * 8;
            const duration = Math.random() * 10 + 8;

            return (
              <motion.span
                key={i}
                className="absolute block rounded-full bg-white/30"
                style={{
                  width: size,
                  height: size,
                  left,
                  bottom: -100,
                }}
                initial={{ y: 0, opacity: 0.6, scale: 1 }}
                animate={{
                  y: -1000,
                  opacity: [0.6, 1, 0],
                  scale: [1, 1.2, 1.3],
                }}
                transition={{
                  duration,
                  repeat: Infinity,
                  delay,
                  ease: "linear",
                }}
              />
            );
          })}
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Medical Specialty
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse our comprehensive range of medical specialties and connect
              with expert doctors
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(specialties).map((name, index) => (
              <div
                key={index}
                onClick={() => openSpecialtyModal(name)}
                onMouseEnter={() => handleMouseEnter(name)}
                onMouseLeave={() => handleMouseLeave(name)}
                className="group cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-gray-100 relative"
              >
                <div className="relative h-48 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                    {hoveredCard === name ? (
                      <img 
                        src={specialties[name].image} 
                        alt={name} 
                        className=" h-full object-cover transition-opacity duration-500"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="64" 
                        height="64" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="text-white opacity-80"
                      >
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {name}
                  </h3>
                  <p className="text-gray-600 mb-4">{specialties[name].description}</p>
                  <div className="flex items-center text-blue-600 font-medium">
                    <span>View Doctors</span>
                    <ChevronRight className="w-5 h-5 ml-1 transition-transform group-hover:translate-x-1"/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              setShowLanguage(false);
              setSelectedDoctor(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 overflow-y-auto flex-1">
              {showLanguage ? renderLanguageModal() : modalContent}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setShowLanguage(false);
                  setSelectedDoctor(null);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SpecialtiesSection;