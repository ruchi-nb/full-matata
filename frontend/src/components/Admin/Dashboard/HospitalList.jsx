"use client";

import React, { useState, useEffect } from "react";
import { Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllHospitals } from "@/data/api";

const HospitalList = () => {
  const router = useRouter();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchHospitals();
  }, []);

  const deleteHospital = (id) => {
    setHospitals(hospitals.filter((h) => h.hospital_id !== id));
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
    <div className="hospital-section bg-white rounded-xl shadow p-6">
      {/* Section Header */}
      <div className="section-header mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Hospital List</h2>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left text-sm font-semibold text-slate-700">
              <th className="px-4 py-3">Hospital Name</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Contact</th>
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
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      ● Active
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 flex items-center gap-3">
                    <button 
                      onClick={() => router.push(`/admin/management`)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <button
                      onClick={() => deleteHospital(hospital.hospital_id)}
                      className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
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