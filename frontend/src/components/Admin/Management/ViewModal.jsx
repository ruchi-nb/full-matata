"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function ViewModal({ hospital, isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState("doctors");
  
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
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-sm text-slate-600">
                      <th className="p-2">Doctor Name</th>
                      <th className="p-2">Specialty</th>
                      <th className="p-2">Experience</th>
                      <th className="p-2">Avatar Status</th>
                      <th className="p-2">Consultations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospital.doctorsData?.map((doc, idx) => (
                      <tr key={idx} className="border-b text-sm">
                        <td className="p-2">
                          <div className="font-medium text-black">{doc.name}</div>
                          <div className="text-xs text-slate-500">{doc.role}</div>
                        </td>
                        <td className="p-2 text-black">{doc.specialty}</td>
                        <td className="p-2 text-black">{doc.experience}</td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              doc.avatarStatus === "Live"
                                ? "bg-green-100 text-green-600"
                                : "bg-amber-100 text-amber-600"
                            }`}
                          >
                            {doc.avatarStatus === "Live" ? "● Active" : "● Inactive"}
                          </span>
                        </td>
                        <td className="p-2 text-black">{doc.consultations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
  
            {/* Specialties Tab */}
            {activeTab === "specialties" && (
              <div>
                <h3 className="text-slate-800 font-semibold mb-4">Available Specialties</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {hospital.specialties?.map((spec, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-4">
                      <h4 className="text-slate-800 font-medium mb-1">{spec.name}</h4>
                      <p className="text-slate-500 text-sm">
                        {spec.doctors} doctors • {spec.consultations} consultations
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
  
            {/* Statistics Tab */}
            {activeTab === "stats" && (
              <div>
                <h3 className="text-slate-800 font-semibold mb-4">Hospital Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {hospital.stats?.map((stat, idx) => (
                    <div key={idx} className="p-6 rounded-xl text-center" style={{ background: stat.bg }}>
                      <div className="text-2xl font-bold" style={{ color: stat.color }}>
                        {stat.value}
                      </div>
                      <div className="text-slate-600 text-sm">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }