// File: components/PatientPortal/Transcripts.jsx
"use client";
import React, { useState, useEffect } from 'react';
import TranscriptModal from '../DoctorPortal/home/TranscriptModal';
import { patients } from '../../data/patients';
import { doctors } from '../../data/doctors';
import { transcripts } from '@/data/transcripts';

const Transcripts = () => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [doctorSpecialtyFilter, setDoctorSpecialtyFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState(1); // Default to patient ID 1 (Sarah Johnson)

  // Filter patients data to show only the logged-in user's data
  const userPatients = patients.filter(patient => patient.id === currentUserId);
  
  // Get doctors that the user has consulted with
  const userDoctors = doctors.filter(doctor => 
    userPatients.some(patient => 
      patient.specialty.toLowerCase().includes(doctor.specialty.toLowerCase())
    )
  );

  const openModal = (patient) => {
    setSelectedPatient(patient);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPatient(null);
  };

  const handleConsultAgain = (doctor) => {
    // Navigate to consult page
    window.location.href = `/patientportal/consult?doctorId=${doctor.id}`;
  };

  const specialties = ['all'];
  userDoctors.forEach(doctor => {
    if (!specialties.includes(doctor.specialty)) {
      specialties.push(doctor.specialty);
    }
  });

  const filteredDoctors = userDoctors.filter(doctor => 
    doctorSpecialtyFilter === 'all' || doctor.specialty === doctorSpecialtyFilter
  );

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-4 md:px-6 lg:px-8 font-gothambook">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8 font-poppins">My Doctors</h1>

        {/* Doctors Section */}
        <div className="mb-8 md:mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-0 font-poppins">
              My Consultation History ({filteredDoctors.length} doctors)
            </h2>
            <div className="flex flex-col xs:flex-row xs:items-center gap-2 sm:gap-4">
              <div className="flex flex-col w-full xs:w-auto">
                <label htmlFor="doctor-specialty-filter" className="text-sm font-medium text-black mb-1">
                  Filter by Specialty
                </label>
                <select
                  id="doctor-specialty-filter"
                  value={doctorSpecialtyFilter}
                  onChange={(e) => setDoctorSpecialtyFilter(e.target.value)}
                  className="w-full border border-gray-300 text-black rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {specialties.map(specialty => (
                    <option key={specialty} value={specialty}>
                      {specialty === 'all' ? 'All Specialties' : specialty}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="text-center py-8 md:py-12 bg-white rounded-xl shadow-lg">
              <p className="text-gray-500 text-base md:text-lg">No doctors found for your consultation history.</p>
              <button
                onClick={() => setDoctorSpecialtyFilter('all')}
                className="mt-3 md:mt-4 px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm md:text-base"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredDoctors.map(doctor => (
                <div key={doctor.id} className="bg-white rounded-xl shadow-lg p-4 md:p-6 hover:shadow-xl transition-shadow duration-300">
                  <div className="flex flex-col items-center mb-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                      <img 
                        src={doctor.image} 
                        alt={doctor.name}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=3B82F6&color=fff&size=200`;
                        }}
                      />
                    </div>
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 text-center font-poppins">{doctor.name}</h3>
                    <p className="text-xs md:text-sm text-gray-600 text-center">{doctor.specialty}</p>
                    <p className="text-xs text-gray-500 text-center mt-1">{doctor.experience}</p>
                  </div>
                  <div className="flex flex-col space-y-2 md:space-y-3">
                    <button
                      onClick={() => {
                        const patientForDoctor = userPatients.find(p =>
                          p.specialty.toLowerCase().includes(doctor.specialty.toLowerCase())
                        );

                        if (patientForDoctor) {
                          const patientTranscripts = transcripts[patientForDoctor.id] || [];
                          openModal({
                            ...patientForDoctor,
                            transcripts: patientTranscripts,
                          });
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 md:py-2 md:px-4 rounded-lg font-medium transition-colors text-sm md:text-base"
                    >
                      View Transcript
                    </button>
                    <button
                      onClick={() => handleConsultAgain(doctor)}
                      className="bg-green-600 hover:bg-green-700 text-white py-2 px-3 md:py-2 md:px-4 rounded-lg font-medium transition-colors text-sm md:text-base"
                    >
                      Consult Again
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <TranscriptModal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        patient={selectedPatient} 
      />
    </div>
  );
};

export default Transcripts;