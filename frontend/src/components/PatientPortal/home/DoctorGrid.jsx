"use client";
import React, { useState } from "react";
import { specialties } from "@/data/Specialties.js";

const DoctorCard = ({ doctor }) => (
  <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
    <div className="relative h-48">
      <img 
        alt={doctor.name} 
        className="w-full h-full object-cover" 
        src={doctor.img}
      />
      {doctor.active && (
        <div className="absolute top-4 right-4">
          <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
            Available
          </div>
        </div>
      )}
    </div>
    <div className="p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-1">{doctor.name}</h3>
      <p className="text-gray-600 text-sm mb-2">{doctor.role}</p>
      <p className="text-gray-600 text-sm mb-2">Experience: {doctor.experience}</p>
      <div className="flex space-x-3">
        <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors">
          View
        </button>
        {doctor.active && (
          <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors">
            Consult
          </button>
        )}
      </div>
    </div>
  </div>
);

const DoctorGrid = () => {
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  const specialtyKeys = Object.keys(specialties);

  const filteredDoctors = selectedSpecialty
    ? specialties[selectedSpecialty].doctors
    : specialtyKeys.flatMap((key) => specialties[key].doctors);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Available Doctors</h1>

          {/* Specialty Filter */}
          <div className="mb-6">
            <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Specialty
            </label>
            <select
              id="specialty"
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Specialties</option>
              {specialtyKeys.map((spec, idx) => (
                <option key={idx} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
            {selectedSpecialty && (
              <p className="mt-2 text-gray-600 text-sm">
                {specialties[selectedSpecialty].description}
              </p>
            )}
          </div>
        </div>

        {/* Doctors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doctor, index) => (
            <DoctorCard key={index} doctor={doctor} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DoctorGrid;
