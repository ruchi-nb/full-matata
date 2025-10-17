// Reusable Specialty Selection Component - Following SpecialtiesSection.jsx pattern
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Globe, Mic, User, Stethoscope } from 'lucide-react';
import { getAllDoctors, getDoctorsBySpecialty, getDoctorLanguages } from '@/data/api-doctor';

const SpecialtySelectionModal = ({ isOpen, onClose, onDoctorSelect }) => {
  const router = useRouter();
  const [showLanguage, setShowLanguage] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedProvider, setSelectedProvider] = useState("deepgram");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [doctorLanguages, setDoctorLanguages] = useState([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [specialties, setSpecialties] = useState([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(false);
  const hoverTimers = useRef({});

  // Fetch specialties and doctors from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingSpecialties(true);
        setIsLoadingDoctors(true);
        
        // Fetch all doctors to get specialties
        const doctorsData = await getAllDoctors();
        setDoctors(doctorsData);
        
        // Extract unique specialties from doctors
        const uniqueSpecialties = [...new Set(doctorsData.map(doctor => doctor.specialty))];
        const specialtiesData = uniqueSpecialties.map(specialty => ({
          id: specialty.toLowerCase().replace(/\s+/g, '_'),
          name: specialty,
          description: `${specialty} medical consultation`,
          doctors: doctorsData.filter(doctor => doctor.specialty === specialty)
        }));
        
        setSpecialties(specialtiesData);
        
      } catch (error) {
        console.error('Failed to fetch doctors and specialties:', error);
        // Fallback to empty arrays
        setDoctors([]);
        setSpecialties([]);
      } finally {
        setIsLoadingSpecialties(false);
        setIsLoadingDoctors(false);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // All available language options with provider-specific groups
  const languageOptions = {
    deepgram: [
      { value: 'en', label: 'English' },
      { value: 'multi', label: 'Multi-Language (Auto-detect)' }
    ],
    sarvam: [
      { value: 'en', label: 'English' },
      { value: 'hi', label: 'Hindi' },
      { value: 'bn', label: 'Bengali' },
      { value: 'gu', label: 'Gujarati' },
      { value: 'kn', label: 'Kannada' },
      { value: 'ml', label: 'Malayalam' },
      { value: 'mr', label: 'Marathi' },
      { value: 'pa', label: 'Punjabi' },
      { value: 'ta', label: 'Tamil' },
      { value: 'te', label: 'Telugu' }
    ]
  };

  // Get doctor-specific language options based on selected provider
  const getDoctorLanguageOptions = () => {
    const providerLanguages = languageOptions[selectedProvider] || languageOptions.deepgram;
    
    if (!doctorLanguages || doctorLanguages.length === 0) {
      return providerLanguages.filter(option => option.value === 'en');
    }
    
    // Filter languages based on what the doctor supports and what the provider supports
    return providerLanguages.filter(option => 
      doctorLanguages.includes(option.value) || option.value === 'multi'
    );
  };

  // Fetch doctor languages when doctor is selected
  const fetchDoctorLanguages = async (doctorId) => {
    try {
      setIsLoadingLanguages(true);
      const languages = await getDoctorLanguages(doctorId);
      setDoctorLanguages(languages);
      
      // Set default language to first available language
      if (languages.length > 0) {
        setSelectedLanguage(languages[0]);
      }
      
      console.log(`Doctor supports languages:`, languages);
    } catch (error) {
      console.error('Failed to fetch doctor languages:', error);
      // Fallback to English
      setDoctorLanguages(['en']);
      setSelectedLanguage('en');
    } finally {
      setIsLoadingLanguages(false);
    }
  };

  // Handle provider change - reset language if current language is not supported by new provider
  useEffect(() => {
    const providerLanguages = languageOptions[selectedProvider] || languageOptions.deepgram;
    const availableLanguages = getDoctorLanguageOptions();
    
    // If current language is not available for the selected provider, switch to first available
    if (!availableLanguages.find(lang => lang.value === selectedLanguage)) {
      if (availableLanguages.length > 0) {
        setSelectedLanguage(availableLanguages[0].value);
      }
    }
  }, [selectedProvider, doctorLanguages]);

  // Provider options
  const providerOptions = [
    { value: 'deepgram', label: 'Deepgram AI', description: 'High accuracy, supports diarization' },
    { value: 'sarvam', label: 'Sarvam AI', description: 'Optimized for Indian languages' }
  ];

  const openSpecialtyModal = (specialtyName) => {
    const specialty = specialties.find(s => s.name === specialtyName);
    if (!specialty) return;

    setShowLanguage(false);
    setSelectedDoctor(null);
    setSelectedSpecialty(specialty);
  };

  const handleStartConsultation = () => {
    if (selectedDoctor) {
      // Call the callback with doctor and preferences
      if (onDoctorSelect) {
        onDoctorSelect({
          doctor: selectedDoctor,
          language: selectedLanguage,
          provider: selectedProvider,
          specialty: selectedSpecialty
        });
      } else {
        // Default behavior - navigate to consultation
        router.push(`/patientportal/consult?doctorId=${selectedDoctor.id}&language=${selectedLanguage}&provider=${selectedProvider}`);
      }
      
      // Close modal
      onClose();
    } else {
      console.error("No doctor selected");
      alert("Please select a doctor first");
    }
  };

  const handleMouseEnter = (specialtyName) => {
    if (hoverTimers.current[specialtyName]) {
      clearTimeout(hoverTimers.current[specialtyName]);
    }

    hoverTimers.current[specialtyName] = setTimeout(() => {
      setHoveredCard(specialtyName);
    }, 15000);
  };

  const handleMouseLeave = (specialtyName) => {
    if (hoverTimers.current[specialtyName]) {
      clearTimeout(hoverTimers.current[specialtyName]);
      delete hoverTimers.current[specialtyName];
    }
    setHoveredCard(null);
  };

  const renderLanguageModal = () => (
    <div>
      <h2 className="text-2xl text-black font-bold mb-4">Select Language & Provider</h2>
      <p className="mb-4 text-gray-600">Please select your preferred language and audio provider for the consultation:</p>
      
      {selectedDoctor && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-800 font-medium">Selected Doctor: {selectedDoctor.name}</p>
          <p className="text-blue-600 text-sm">{selectedDoctor.role}</p>
        </div>
      )}
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Globe className="w-4 h-4 inline mr-1" />
            Preferred Language
            {isLoadingLanguages && (
              <span className="text-xs text-gray-500 ml-2">(Loading...)</span>
            )}
          </label>
          <select 
            className="w-full text-gray-700 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={isLoadingLanguages}
          >
            {selectedProvider === 'deepgram' ? (
              <>
                <optgroup label="Deepgram Languages">
                  {languageOptions.deepgram.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              <>
                <optgroup label="Sarvam Languages">
                  {languageOptions.sarvam.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
          {doctorLanguages.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Dr. {selectedDoctor?.name} supports {doctorLanguages.length} language{doctorLanguages.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mic className="w-4 h-4 inline mr-1" />
            Audio Provider
          </label>
          <select 
            className="w-full text-gray-700 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
          >
            {providerOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {providerOptions.find(p => p.value === selectedProvider)?.description}
          </p>
        </div>
      </div>
      
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

  const renderSpecialtyContent = () => {
    if (!selectedSpecialty) return null;
    
    const specialty = selectedSpecialty;
    if (!specialty) return null;

    return (
      <div className="max-h-[70vh] overflow-y-auto">
        <h2 className="text-2xl text-black font-bold mb-4">{specialty.name}</h2>
        <p className="mb-6 text-gray-700">{specialty.description}</p>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Doctors:</h3>
          <p className="text-gray-600 text-sm">Select a doctor to start your consultation</p>
        </div>

        <h3 className="text-xl text-black font-semibold mb-4 border-b pb-2">Available Doctors</h3>
        <div className="space-y-6">
          {isLoadingDoctors ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading doctors...</span>
            </div>
          ) : specialty.doctors && specialty.doctors.length > 0 ? (
            specialty.doctors.map((doc, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-start justify-between p-4 bg-gray-50 rounded-xl shadow-sm border border-gray-100">
                <div className="mb-4 sm:mb-0 sm:mr-4 flex-1">
                  <h4 className="font-semibold text-gray-900 text-lg">{doc.name}</h4>
                  <p className="text-gray-600">{doc.specialty}</p>
                  <p className="text-gray-600 text-sm mt-1">{doc.experience || 'Experienced'} doctor</p>
                  {doc.languages && (
                    <p className="text-gray-500 text-xs mt-1">
                      Languages: {doc.languages}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <div className="relative mb-3">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 overflow-hidden">
                      {doc.avatar_url ? (
                        <img 
                          src={doc.avatar_url} 
                          alt={doc.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${doc.avatar_url ? 'hidden' : 'flex'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                    </div>
                    <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${doc.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  </div>
                  <button
                    className={`mt-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                      doc.is_active !== false 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }`}
                    onClick={async () => {
                      setSelectedDoctor(doc);
                      // Fetch doctor languages before showing language selection
                      await fetchDoctorLanguages(doc.id);
                      setShowLanguage(true);
                    }}
                    disabled={doc.is_active === false}
                  >
                    {doc.is_active !== false ? "Start Consultation" : "Not Available"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No doctors available for this specialty at the moment.</p>
              <p className="text-sm mt-2">Please try again later or contact support.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 overflow-y-auto flex-1">
          {showLanguage ? renderLanguageModal() : renderSpecialtyContent()}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Specialty Selection Component
const SpecialtySelection = ({ onDoctorSelect, showSpecialties = true }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(false);
  const hoverTimers = useRef({});

  // Fetch specialties from database
  useEffect(() => {
    const fetchSpecialties = async () => {
      try {
        setIsLoadingSpecialties(true);
        
        // Fetch all doctors to get specialties
        const doctorsData = await getAllDoctors();
        
        // Extract unique specialties from doctors
        const uniqueSpecialties = [...new Set(doctorsData.map(doctor => doctor.specialty))];
        const specialtiesData = uniqueSpecialties.map(specialty => ({
          id: specialty.toLowerCase().replace(/\s+/g, '_'),
          name: specialty,
          description: `${specialty} medical consultation`,
          doctors: doctorsData.filter(doctor => doctor.specialty === specialty)
        }));
        
        setSpecialties(specialtiesData);
        
      } catch (error) {
        console.error('Failed to fetch specialties:', error);
        setSpecialties([]);
      } finally {
        setIsLoadingSpecialties(false);
      }
    };

    fetchSpecialties();
  }, []);

  const handleMouseEnter = (specialtyName) => {
    if (hoverTimers.current[specialtyName]) {
      clearTimeout(hoverTimers.current[specialtyName]);
    }

    hoverTimers.current[specialtyName] = setTimeout(() => {
      setHoveredCard(specialtyName);
    }, 15000);
  };

  const handleMouseLeave = (specialtyName) => {
    if (hoverTimers.current[specialtyName]) {
      clearTimeout(hoverTimers.current[specialtyName]);
      delete hoverTimers.current[specialtyName];
    }
    setHoveredCard(null);
  };

  const openSpecialtyModal = (specialtyName) => {
    setModalOpen(true);
  };

  if (!showSpecialties) {
    return (
      <SpecialtySelectionModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onDoctorSelect={onDoctorSelect}
      />
    );
  }

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
            {isLoadingSpecialties ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span className="ml-4 text-gray-600 text-lg">Loading specialties...</span>
              </div>
            ) : specialties.length > 0 ? (
              specialties.map((specialty, index) => (
                <div
                  key={index}
                  onClick={() => openSpecialtyModal(specialty.name)}
                  onMouseEnter={() => handleMouseEnter(specialty.name)}
                  onMouseLeave={() => handleMouseLeave(specialty.name)}
                  className="group cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-gray-100 relative"
                >
                  <div className="relative h-48 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      {hoveredCard === specialty.name ? (
                        <div className="h-full w-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                          <Stethoscope className="text-white opacity-80 w-16 h-16" />
                        </div>
                      ) : (
                        <Stethoscope className="text-white opacity-80 w-16 h-16" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {specialty.name}
                    </h3>
                    <p className="text-gray-600 mb-4">{specialty.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-blue-600 font-medium">
                        <span>View Doctors</span>
                        <ChevronRight className="w-5 h-5 ml-1 transition-transform group-hover:translate-x-1"/>
                      </div>
                      <span className="text-sm text-gray-500">
                        {specialty.doctors.length} doctor{specialty.doctors.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                <p className="text-lg">No specialties available at the moment.</p>
                <p className="text-sm mt-2">Please try again later or contact support.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <SpecialtySelectionModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onDoctorSelect={onDoctorSelect}
      />
    </>
  );
};

export default SpecialtySelection;
export { SpecialtySelectionModal };
