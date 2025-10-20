"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { hospitalApiService } from "@/services/hospitalApiService";

export default function ViewModal({ hospital, isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState("doctors");
    const [doctors, setDoctors] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
  
    // Fetch hospital details when modal opens
    useEffect(() => {
        if (isOpen && hospital?.id) {
            fetchHospitalDetails();
        }
    }, [isOpen, hospital?.id]);

    const fetchHospitalDetails = async () => {
        if (!hospital?.id) return;
        
        try {
            setLoading(true);
            setError(null);
            
            console.log('🔍 Fetching hospital details for hospital ID:', hospital.id);
            
            // Check authentication first
            const { getStoredTokens } = await import('@/data/api');
            const { accessToken, refreshToken } = getStoredTokens();
            console.log('🔍 Auth check - Access token exists:', !!accessToken);
            console.log('🔍 Auth check - Refresh token exists:', !!refreshToken);
            
            if (!accessToken) {
                setError('You are not logged in. Please log in to view hospital details.');
                setLoading(false);
                return;
            }
            
            // First, let's debug the roles
            try {
                const debugData = await hospitalApiService.requestWithRetry(`/hospitals/${hospital.id}/debug/roles`, {
                    method: 'GET'
                });
                console.log('🔍 DEBUG: Hospital roles data:', debugData);
            } catch (debugErr) {
                console.error('❌ Failed to fetch debug data:', debugErr);
            }
            
            // Fetch doctors and statistics in parallel
            const [doctorsData, statsData] = await Promise.all([
                hospitalApiService.listHospitalDoctors(hospital.id).catch((err) => {
                    console.error('❌ Failed to fetch doctors:', err);
                    // Check if it's an auth error
                    if (err.message && err.message.includes('authentication')) {
                        throw new Error('Authentication required. Please log in again.');
                    }
                    return [];
                }),
                hospitalApiService.requestWithRetry(`/hospitals/${hospital.id}/statistics`, {
                    method: 'GET'
                }).catch((err) => {
                    console.error('❌ Failed to fetch statistics:', err);
                    return null;
                })
            ]);
            
            console.log('📊 Fetched doctors data:', doctorsData);
            console.log('📊 Fetched statistics data:', statsData);
            
            setDoctors(doctorsData || []);
            setStatistics(statsData);
        } catch (err) {
            console.error('Failed to fetch hospital details:', err);
            setError('Failed to load hospital details');
        } finally {
            setLoading(false);
        }
    };
  
    if (!isOpen || !hospital) return null;
  
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-slate-800">Hospital Details</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
  
          {/* Body */}
          <div className="p-6">
            {/* Hospital Header */}
            <div className="flex items-center gap-6 mb-6">
              {/* Avatar */}
              <div
                className="w-16 h-16 flex items-center justify-center text-white font-bold text-xl rounded-full shadow-lg"
                style={{ background: "linear-gradient(135deg, #3b82f6, #60a5fa)" }}
              >
                {hospital.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
  
              {/* Info Card */}
              <div className="flex-1 p-4 rounded-xl bg-slate-50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">{hospital.name}</h2>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
                      hospital.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    ● {hospital.status}
                  </span>
                </div>
  
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm text-slate-700">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">Location</span>
                    {hospital.location}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">Email</span>
                    {hospital.email}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">Phone</span>
                    {hospital.phone}
                  </div>
                </div>
              </div>
            </div>
  
            {/* Tabs */}
            <div className="flex gap-6 border-b mb-6">
              {["doctors", "specialties", "stats"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 text-sm font-medium capitalize ${
                    activeTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
  
            {/* Doctors Tab */}
            {activeTab === "doctors" && (
              <div>
                <h3 className="text-slate-800 font-semibold mb-4">Medical Staff</h3>
                {loading ? (
                  <div className="text-center py-8 text-slate-500">Loading doctors...</div>
                ) : error ? (
                  <div className="text-center py-8 text-red-500">{error}</div>
                ) : doctors.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No doctors found for this hospital</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-sm text-slate-600">
                          <th className="p-2">Doctor Name</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">Specialties</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctors.map((doc) => (
                          <tr key={doc.user_id} className="border-b text-sm">
                            <td className="p-2">
                              <div className="font-medium text-black">
                                {doc.first_name} {doc.last_name}
                              </div>
                              <div className="text-xs text-slate-500">ID: {doc.user_id}</div>
                            </td>
                            <td className="p-2 text-black">{doc.email}</td>
                            <td className="p-2 text-black">
                              {doc.specialties?.length > 0 
                                ? doc.specialties.map(s => s.name).join(', ')
                                : 'Not specified'}
                            </td>
                            <td className="p-2">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                                ● Active
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
  
            {/* Specialties Tab */}
            {activeTab === "specialties" && (
              <div>
                <h3 className="text-slate-800 font-semibold mb-4">Doctor Specialties</h3>
                {loading ? (
                  <div className="text-center py-8 text-slate-500">Loading specialties...</div>
                ) : doctors.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No specialties data available</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Extract unique specialties from doctors */}
                    {Array.from(new Set(
                      doctors.flatMap(doc => doc.specialties || []).map(s => s.name)
                    )).map((specName, idx) => {
                      const specDoctors = doctors.filter(doc => 
                        doc.specialties?.some(s => s.name === specName)
                      );
                      return (
                        <div key={idx} className="bg-slate-50 rounded-lg p-4">
                          <h4 className="text-slate-800 font-medium mb-1">{specName}</h4>
                          <p className="text-slate-500 text-sm">
                            {specDoctors.length} {specDoctors.length === 1 ? 'doctor' : 'doctors'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
  
            {/* Statistics Tab */}
            {activeTab === "stats" && (
              <div>
                <h3 className="text-slate-800 font-semibold mb-4">Hospital Statistics</h3>
                {loading ? (
                  <div className="text-center py-8 text-slate-500">Loading statistics...</div>
                ) : statistics ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-6 rounded-xl text-center bg-blue-50">
                      <div className="text-3xl font-bold text-blue-600">
                        {statistics.total_doctors}
                      </div>
                      <div className="text-slate-600 text-sm mt-2">Total Doctors</div>
                    </div>
                    <div className="p-6 rounded-xl text-center bg-green-50">
                      <div className="text-3xl font-bold text-green-600">
                        {statistics.total_consultations}
                      </div>
                      <div className="text-slate-600 text-sm mt-2">Total Consultations</div>
                    </div>
                    <div className="p-6 rounded-xl text-center bg-amber-50">
                      <div className="text-3xl font-bold text-amber-600">
                        {statistics.active_consultations}
                      </div>
                      <div className="text-slate-600 text-sm mt-2">Active Consultations</div>
                    </div>
                    <div className="p-6 rounded-xl text-center bg-purple-50">
                      <div className="text-3xl font-bold text-purple-600">
                        {statistics.active_avatars}
                      </div>
                      <div className="text-slate-600 text-sm mt-2">Active Avatars</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">No statistics available</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }