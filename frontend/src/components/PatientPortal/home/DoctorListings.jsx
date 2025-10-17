"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { doctors } from '../../../data/doctors.js';

const DoctorListings = ({ doctor }) => {
  const router = useRouter();

  const handleBack = () => {
    router.push('/patientportal/doctors');
  };

  const handleConsult = () => {
    router.push(`/patientportal/consult?doctorId=${doctors.id}`);
  };

  if (!doctors) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Doctor Not Found</h2>
          <button
            onClick={handleBack}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Doctors
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left h-5 w-5">
              <path d="m12 19-7-7 7-7"></path>
              <path d="M19 12H5"></path>
            </svg>
            <span>Back to Doctors</span>
          </button>
        </div>

        {/* Doctor Profile */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="relative h-64 bg-gradient-to-r from-blue-600 to-purple-600">
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
            <div className="relative h-full flex items-center px-8">
              <div className="flex items-center space-x-6">
                <img 
                  src={doctors.image} 
                  alt={doctors.name}
                  className="w-32 h-32 rounded-full border-4 border-white object-cover"
                />
                <div className="text-white">
                  <h1 className="text-3xl font-bold mb-2">{doctors.name}</h1>
                  <p className="text-xl opacity-90">{doctors.specialty}</p>
                  <div className="flex items-center mt-2">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Available
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
                <p className="text-gray-600 leading-relaxed mb-6">{doctors.biography}</p>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">Education</h3>
                <p className="text-gray-600 mb-6">{doctos.education}</p>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">Hospital Affiliations</h3>
                <p className="text-gray-600 mb-6">{doctors.hospitals}</p>
              </div>

              {/* Right Column */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Professional Details</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar h-5 w-5 text-blue-600">
                      <path d="M8 2v4"></path>
                      <path d="M16 2v4"></path>
                      <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                      <path d="M3 10h18"></path>
                    </svg>
                    <span className="text-gray-700">{doctors.experience}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star h-5 w-5 text-yellow-400 fill-current">
                      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>
                    </svg>
                    <span className="text-gray-700">{doctors.rating}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe h-5 w-5 text-blue-600">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                      <path d="M2 12h20"></path>
                    </svg>
                    <span className="text-gray-700">{doctors.languages}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-id-card h-5 w-5 text-blue-600">
                      <rect width="18" height="14" x="5" y="5" rx="2" ry="2"></rect>
                      <circle cx="9" cy="11" r="2"></circle>
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                    </svg>
                    <span className="text-gray-700">License: {doctors.license}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleConsult}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                  >
                    Start Consultation
                  </button>
                  <button
                    onClick={handleBack}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold transition-colors"
                  >
                    Back to Doctors List
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorListings;
