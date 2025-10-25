"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, User, Mail, Phone, Medal, X, Eye } from 'lucide-react';
import { getPatientHospitalDoctors, getPatientHospitalSpecialties } from '@/data/api-patient';
import { LifeLine } from 'react-loading-indicators';
import Consult from '@/components/PatientPortal/home/Consult';
import ConsultationSettings from '@/components/PatientPortal/home/ConsultationSettings';
import InvertedGradientButton from '@/components/common/InvertedGradientButton';
import OutlineButton from '@/components/common/OutlineButton';

const DoctorsListSection = () => {
  const router = useRouter();
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSpecialties, setLoadingSpecialties] = useState(true);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  
  // Modal states
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConsultation, setShowConsultation] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Animation states
  const [mounted, setMounted] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [visibleCards, setVisibleCards] = useState([]);

  // Fetch specialties on mount
  useEffect(() => {
    async function fetchSpecialties() {
      try {
        setLoadingSpecialties(true);
        const response = await getPatientHospitalSpecialties();
        console.log('✅ Specialties fetched:', response);
        setSpecialties(response.specialties || []);
      } catch (error) {
        console.error('❌ Failed to fetch specialties:', error);
        setSpecialties([]);
      } finally {
        setLoadingSpecialties(false);
      }
    }
    fetchSpecialties();
  }, []);

  // Fetch doctors when specialty filter changes
  useEffect(() => {
    async function fetchDoctors() {
      try {
        setLoading(true);
        const specialtyId = selectedSpecialty === 'all' ? null : parseInt(selectedSpecialty);
        console.log(`🔍 Fetching doctors${specialtyId ? ` for specialty_id=${specialtyId}` : ''}`);
        
        const response = await getPatientHospitalDoctors(specialtyId);
        console.log('✅ Doctors fetched:', response);
        setDoctors(response.doctors || []);
      } catch (error) {
        console.error('❌ Failed to fetch doctors:', error);
        setDoctors([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDoctors();
  }, [selectedSpecialty]);

  // Filter doctors by search term
  const filteredDoctors = doctors.filter(doctor => {
    const doctorName = `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim().toLowerCase();
    const doctorEmail = (doctor.email || '').toLowerCase();
    const doctorSpecialty = (doctor.specialty || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return doctorName.includes(search) || 
           doctorEmail.includes(search) || 
           doctorSpecialty.includes(search);
  });

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
          // Animate header first
          setTimeout(() => {
            setHeaderVisible(true);
          }, 200);
          
          // Animate search bar second
          setTimeout(() => {
            setSearchBarVisible(true);
          }, 400);
          
          // Staggered animation for cards
          setTimeout(() => {
            filteredDoctors.forEach((_, index) => {
              setTimeout(() => {
                setVisibleCards(prev => [...prev, index]);
              }, index * 100); // 100ms delay between each card
            });
          }, 600); // Start cards animation after search bar
          
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const sectionElement = document.getElementById('specialties-section');
    if (sectionElement) {
      observer.observe(sectionElement);
    }

    return () => {
      if (sectionElement) {
        observer.unobserve(sectionElement);
      }
    };
  }, [filteredDoctors]);

  const handleViewDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setIsModalOpen(true);
  };

  const handleConsultDoctor = (doctor) => {
    // Show settings modal to choose provider and language
    setSelectedDoctor(doctor);
    setShowSettingsModal(true);
  };

  const handleStartConsultation = ({ provider, language }) => {
    // Store doctor info in sessionStorage for the consultation page
    sessionStorage.setItem('selectedDoctor', JSON.stringify(selectedDoctor));
    
    // Navigate to consultation page with chosen provider and language
    router.push(`/consultation?doctor_id=${selectedDoctor.user_id}&provider=${provider}&language=${language}`);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDoctor(null);
  };

  const handleCloseConsultation = () => {
    setShowConsultation(false);
    setSelectedDoctor(null);
  };

  // Get doctor name
  const getDoctorName = (doctor) => {
    return `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() || doctor.username || 'Doctor';
  };

  // Get doctor specialty
  const getDoctorSpecialty = (doctor) => {
    return doctor.specialty || (doctor.specialties && doctor.specialties[0]?.name) || 'General Practice';
  };

  return (
    <>
      {showConsultation ? (
        <div className="fixed inset-0 bg-white z-50">
          <Consult doctor={selectedDoctor} onBack={handleCloseConsultation} />
        </div>
      ) : (
        <section 
        id='specialties-section'
        className="py-16 bg-gradient-to-b from-[#b9d0f5] to-[#3d85c6]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className={`text-center mb-12 transition-all duration-700 ease-out ${
              headerVisible 
                ? "opacity-100 translate-y-0" 
                : "opacity-0 translate-y-8"
            }`}>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Available Doctors
              </h2>
              <p className="text-lg text-gray-600">
                Find and consult with our qualified medical professionals
              </p>
            </div>

            {/* Search and Filter Bar */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100 transition-all duration-700 ease-out ${
              searchBarVisible 
                ? "opacity-100 translate-y-0" 
                : "opacity-0 translate-y-8"
            }`}>
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, email, or specialty..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Specialty Filter */}
                <div className="md:w-64 relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Filter className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={selectedSpecialty}
                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                    disabled={loadingSpecialties}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white cursor-pointer"
                  >
                    <option value="all">All Specialties</option>
                    {specialties.map((specialty) => (
                      <option key={specialty.specialty_id} value={specialty.specialty_id}>
                        {specialty.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Results Count */}
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'}
                {selectedSpecialty !== 'all' && (
                  <span className="ml-2">
                    in <span className="font-semibold">{specialties.find(s => s.specialty_id == selectedSpecialty)?.name}</span>
                  </span>
                )}
                {searchTerm && (
                  <span className="ml-2">
                    matching "<span className="font-semibold">{searchTerm}</span>"
                  </span>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="text-center py-16">
                <LifeLine
                  color="#3b82f6"
                  size="medium"
                  text="Loading doctors..."
                  textColor="#3b82f6"
                />
              </div>
            ) : filteredDoctors.length === 0 ? (
              /* Empty State */
              <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No doctors found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || selectedSpecialty !== 'all'
                    ? "Try adjusting your search or filter criteria"
                    : "No doctors are currently available"}
                </p>
                {(searchTerm || selectedSpecialty !== 'all') && (
                  <OutlineButton
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedSpecialty('all');
                    }}
                    color="blue"
                    size="medium"
                  >
                    Clear Filters
                  </OutlineButton>
                )}
              </div>
            ) : (
              /* Doctors Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDoctors.map((doctor, index) => (
                  <div
                    key={doctor.user_id}
                    className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 ease-out overflow-hidden border border-gray-100 group ${
                      visibleCards.includes(index) 
                        ? "opacity-100 translate-y-0 scale-100" 
                        : "opacity-0 translate-y-8 scale-95"
                    }`}
                    style={{
                      transitionDelay: `${index * 50}ms`
                    }}
                  >
                    {/* Doctor Avatar */}
                    <div className="relative h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <div className="text-white text-5xl font-bold">
                        {getDoctorName(doctor).charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute top-4 right-4">
                        <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                          Available
                        </div>
                      </div>
                    </div>

                    {/* Doctor Info */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-3">
                        {getDoctorName(doctor)}
                      </h3>
                      
                      <div className="space-y-2 mb-4">
                        {/* Specialty */}
                        <div className="flex items-center text-gray-600">
                          <Medal className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="text-sm">{getDoctorSpecialty(doctor)}</span>
                        </div>
                        
                        {/* Email */}
                        {doctor.email && (
                          <div className="flex items-center text-gray-600">
                            <Mail className="h-4 w-4 mr-2 text-blue-600" />
                            <span className="text-sm truncate">{doctor.email}</span>
                          </div>
                        )}
                        
                        {/* Phone */}
                        {doctor.phone && (
                          <div className="flex items-center text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-blue-600" />
                            <span className="text-sm">{doctor.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        <OutlineButton
                          onClick={() => handleViewDoctor(doctor)}
                          className="flex-1"
                          color="blue"
                          size="small"
                          icon={<Eye className="h-4 w-4 mr-1" />}
                        >
                          View
                        </OutlineButton>
                        <InvertedGradientButton
                          onClick={() => handleConsultDoctor(doctor)}
                          className="flex-1 text-sm py-2"
                        >
                          Consult
                        </InvertedGradientButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Doctor Details Modal */}
      {isModalOpen && selectedDoctor && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Doctor Profile</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Avatar */}
              <div className="flex items-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white text-3xl font-bold">
                    {getDoctorName(selectedDoctor).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {getDoctorName(selectedDoctor)}
                  </h3>
                  <p className="text-gray-600">{getDoctorSpecialty(selectedDoctor)}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4 mb-6">
                {selectedDoctor.email && (
                  <div className="flex items-center text-gray-700">
                    <Mail className="h-5 w-5 mr-3 text-blue-600" />
                    <span>{selectedDoctor.email}</span>
                  </div>
                )}
                {selectedDoctor.phone && (
                  <div className="flex items-center text-gray-700">
                    <Phone className="h-5 w-5 mr-3 text-blue-600" />
                    <span>{selectedDoctor.phone}</span>
                  </div>
                )}
              </div>

              {/* Specialties */}
              {selectedDoctor.specialties && selectedDoctor.specialties.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Specialties</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoctor.specialties.map((spec) => (
                      <span
                        key={spec.specialty_id}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                      >
                        {spec.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <InvertedGradientButton
                onClick={() => {
                  closeModal();
                  handleConsultDoctor(selectedDoctor);
                }}
                className="w-full"
              >
                Start Consultation
              </InvertedGradientButton>
            </div>
          </div>
        </div>
      )}

      {/* Consultation Settings Modal */}
      <ConsultationSettings
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          setSelectedDoctor(null);
        }}
        onStart={handleStartConsultation}
        doctor={selectedDoctor}
      />
    </>
  );
};

export default DoctorsListSection;

