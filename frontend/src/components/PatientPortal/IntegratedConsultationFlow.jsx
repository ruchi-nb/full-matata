// Integrated Consultation Flow - Combines specialty selection with consultation form
"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import SpecialtySelection from './SpecialtySelection';
import EnhancedConsultationForm from './EnhancedConsultationForm';
import { ArrowLeft, Stethoscope, User } from 'lucide-react';

const IntegratedConsultationFlow = ({ onBack, showSpecialties = true }) => {
  const router = useRouter();
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showConsultationForm, setShowConsultationForm] = useState(false);

  // Handle doctor selection from specialty modal
  const handleDoctorSelect = (selection) => {
    const { doctor, language, provider, specialty } = selection;
    
    // Create a doctor object that matches the expected format
    const doctorData = {
      id: doctor.id || doctor.name, // Use name as ID if no ID provided
      name: doctor.name,
      specialty: specialty || 'General Medicine',
      image: doctor.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=3B82F6&color=fff&size=200`,
      location: 'Online Consultation',
      role: doctor.role,
      experience: doctor.experience,
      active: doctor.active,
      language: language,
      provider: provider
    };

    setSelectedDoctor(doctorData);
    setShowConsultationForm(true);
  };

  // Handle back navigation
  const handleBack = () => {
    if (showConsultationForm) {
      setShowConsultationForm(false);
      setSelectedDoctor(null);
    } else {
      onBack();
    }
  };

  // If consultation form is shown, render it
  if (showConsultationForm && selectedDoctor) {
    return (
      <EnhancedConsultationForm 
        doctor={selectedDoctor} 
        onBack={handleBack} 
      />
    );
  }

  // Otherwise show specialty selection
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mr-4"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </button>
              <div className="flex items-center">
                <Stethoscope className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Start Consultation</h1>
                  <p className="text-sm text-gray-600">Choose your specialty and doctor</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center text-sm text-gray-500">
              <User className="w-4 h-4 mr-1" />
              <span>Patient Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Specialty Selection */}
      <SpecialtySelection 
        onDoctorSelect={handleDoctorSelect}
        showSpecialties={showSpecialties}
      />
    </div>
  );
};

export default IntegratedConsultationFlow;
