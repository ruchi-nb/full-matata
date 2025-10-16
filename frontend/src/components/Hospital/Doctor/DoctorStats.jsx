"use client";

import React, { useState, useEffect } from "react";
import { User, Users, Stethoscope, Microscope } from "lucide-react";
import { listHospitalDoctors, listHospitalNurses, listHospitalPatients, listHospitalLabTechnicians } from "@/data/api-hospital-admin.js";
import { useUser } from "@/data/UserContext";

const StatsCard = ({ icon: Icon, bgColor, iconColor, label, value }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-center space-x-3">
      <div className={`p-2 ${bgColor} rounded-lg`}>
        <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

const DoctorStats = () => {
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [patients, setPatients] = useState([]);
  const [labTechnicians, setLabTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    async function loadHospitalData() {
      try {
        // Get hospital_id from user context
        const hospitalId = user?.hospital_id || user?.hospital_roles?.[0]?.hospital_id;
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        // Load all data in parallel
        const [doctorsList, nursesList, patientsList, labTechniciansList] = await Promise.all([
          listHospitalDoctors(hospitalId),
          listHospitalNurses(hospitalId),
          listHospitalPatients(hospitalId),
          listHospitalLabTechnicians(hospitalId)
        ]);

        setDoctors(doctorsList || []);
        setNurses(nursesList || []);
        setPatients(patientsList || []);
        setLabTechnicians(labTechniciansList || []);
      } catch (error) {
        console.error("Failed to load hospital data:", error);
        // Set empty arrays for all data on error
        setDoctors([]);
        setNurses([]);
        setPatients([]);
        setLabTechnicians([]);
      } finally {
        setLoading(false);
      }
    }

    // Only load if user is available
    if (user) {
      loadHospitalData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="opacity-50">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // For now, we'll use mock data for consultations since we don't have that data from the API yet
  const totalConsultations = doctors.length * 15; // Mock calculation
  const uniqueLanguages = 3; // Mock data

  const statsData = [
    {
      icon: User,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      label: "Total Doctors",
      value: doctors.length,
    },
    {
      icon: Users,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
      label: "Total Nurses",
      value: nurses.length,
    },
    {
      icon: Stethoscope,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      label: "Total Patients",
      value: patients.length,
    },
    {
      icon: Microscope,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
      label: "Lab Technicians",
      value: labTechnicians.length,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat, index) => (
        <StatsCard
          key={index}
          icon={stat.icon}
          bgColor={stat.bgColor}
          iconColor={stat.iconColor}
          label={stat.label}
          value={stat.value}
        />
      ))}
    </div>
  );
};

export default DoctorStats;