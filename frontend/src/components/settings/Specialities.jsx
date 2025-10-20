"use client";

import { useState, useEffect } from "react";
import { Stethoscope, Info } from "lucide-react";
import { request } from "@/data/api";

export default function Specialities() {
  const [specialities, setSpecialities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load specialities from backend
  useEffect(() => {
    async function loadSpecialities() {
      try {
        setLoading(true);
        console.log("🔍 Loading specialities...");
        
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const accessToken = document.cookie.split('accessToken=')[1]?.split(';')[0];
        
        const response = await fetch(`${backendUrl}/hospitals/specialities`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("✅ Specialities loaded:", data);
          setSpecialities(data || []);
        } else {
          console.error("Failed to load specialities:", response.status);
          setSpecialities([]);
        }
      } catch (error) {
        console.error("Error loading specialities:", error);
        setSpecialities([]);
      } finally {
        setLoading(false);
      }
    }

    loadSpecialities();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center space-x-2">
            <Stethoscope className="h-6 w-6 text-blue-600" />
            <span>Medical Specialities</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            View all available medical specialities in the system
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm text-blue-800">
            <strong>View Only:</strong> Specialities are managed by the Super Admin. You can view and assign these specialities to doctors, but cannot add or remove them.
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading specialities...</p>
        </div>
      ) : specialities.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <Stethoscope className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No specialities available</p>
          <p className="text-sm text-gray-500 mt-2">Please contact your Super Admin to add specialities</p>
        </div>
      ) : (
        /* Speciality Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {specialities.map((specialty) => (
            <div
              key={specialty.specialty_id}
              className="flex flex-col p-4 bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Stethoscope className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    specialty.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {specialty.status || 'active'}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{specialty.name}</h3>
              {specialty.description && (
                <p className="text-sm text-slate-600 line-clamp-2">{specialty.description}</p>
              )}
              <div className="mt-3 pt-3 border-t border-blue-100">
                <p className="text-xs text-gray-500">
                  ID: {specialty.specialty_id}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistics Footer */}
      {!loading && specialities.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total Specialities: <strong className="text-gray-900">{specialities.length}</strong></span>
            <span>
              Active: <strong className="text-green-600">{specialities.filter(s => s.status === 'active').length}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

