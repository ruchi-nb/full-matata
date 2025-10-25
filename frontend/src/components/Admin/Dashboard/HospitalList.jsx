"use client";

import React, { useState, useEffect } from "react";
import { Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllHospitals } from "@/data/api";
import { hospitalApiService } from "@/services/hospitalApiService";

const HospitalList = () => {
  const router = useRouter();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    try {
      setLoading(true);
      const hospitalsData = await getAllHospitals();
      setHospitals(hospitalsData || []);
    } catch (error) {
      console.error("Failed to fetch hospitals:", error);
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteHospital = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this hospital? This action cannot be undone.");
    if (!confirm) return;

    try {
      setDeleting(id);
      await hospitalApiService.deleteHospital(id);
      
      // Remove from local state after successful deletion
      setHospitals(hospitals.filter((h) => h.hospital_id !== id));
      
      console.log(`Hospital ${id} deleted successfully`);
    } catch (error) {
      console.error("Failed to delete hospital:", error);
      alert(`Failed to delete hospital: ${error.message || 'Unknown error'}`);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="hospital-section bg-white rounded-xl shadow p-6">
        <div className="section-header mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Hospital List</h2>
        </div>
        <div className="opacity-50">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hospital-section bg-white rounded-xl shadow p-4 sm:p-6">
      {/* Section Header */}
      <div className="section-header mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Hospital List</h2>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-4">
        {hospitals.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No hospitals found
          </div>
        ) : (
          hospitals.map((hospital) => (
            <div
              key={hospital.hospital_id}
              className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 truncate">
                    {hospital.hospital_name}
                  </h3>
                  <p className="text-sm text-slate-600 truncate">
                    {hospital.address || "N/A"}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {hospital.is_active !== undefined ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      hospital.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      ● {hospital.is_active ? 'Active' : 'Inactive'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      ● Unknown
                    </span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Email:</span>
                  <span className="truncate">{hospital.hospital_email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Contact:</span>
                  <span>{hospital.admin_contact || "N/A"}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-4">
                <button 
                  onClick={() => router.push(`/admin/management`)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  disabled={deleting === hospital.hospital_id}
                >
                  <Eye className="w-4 h-4" /> View
                </button>
                <button
                  onClick={() => deleteHospital(hospital.hospital_id)}
                  disabled={deleting === hospital.hospital_id}
                  className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" /> {deleting === hospital.hospital_id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left text-sm font-semibold text-slate-700">
              <th className="px-4 py-3">Hospital Name</th>
              <th className="px-4 py-3">Admin Name</th>
              <th className="px-4 py-3">Admin Email</th>
              <th className="px-4 py-3">Admin Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                  No hospitals found
                </td>
              </tr>
            ) : (
              hospitals.map((hospital) => (
                <tr
                  key={hospital.hospital_id}
                  className="border-b last:border-0 hover:bg-slate-50 transition-colors"
                >
                  {/* Hospital Name */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {hospital.hospital_name}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {hospital.address || "N/A"}
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {hospital.hospital_email || "N/A"}
                  </td>

                  {/* Admin Contact */}
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {hospital.admin_contact || "N/A"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {hospital.is_active !== undefined ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        hospital.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        ● {hospital.is_active ? 'Active' : 'Inactive'}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        ● Unknown
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 flex items-center gap-3">
                    <button 
                      onClick={() => router.push(`/admin/management`)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      disabled={deleting === hospital.hospital_id}
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <button
                      onClick={() => deleteHospital(hospital.hospital_id)}
                      disabled={deleting === hospital.hospital_id}
                      className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" /> {deleting === hospital.hospital_id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HospitalList;