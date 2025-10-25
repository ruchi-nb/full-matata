"use client";

import React, { useState, useEffect } from 'react';
import { listHospitalDoctors } from '@/data/api-hospital-admin.js';
import { useUser } from '@/data/UserContext';
import Link from 'next/link';
import { TrendingUp, UserPlus, User, Users, ChevronDown } from 'lucide-react';

const Dashboard = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('weekly');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const { user, getHospitalId } = useUser();

  // Fetch dashboard statistics
  useEffect(() => {
    async function loadDashboardStats() {
      try {
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setStatsLoading(false);
          return;
        }

        const accessToken = document.cookie.split('accessToken=')[1]?.split(';')[0];
        if (!accessToken) {
          console.error("No access token found");
          setStatsLoading(false);
          return;
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        const response = await fetch(
          `${backendUrl}/hospital-admin/hospitals/${hospitalId}/dashboard-stats`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("✅ Dashboard stats loaded:", data);
          setDashboardStats(data);
        } else {
          console.error("Failed to load dashboard stats:", response.statusText);
        }
      } catch (error) {
        console.error("Error loading dashboard stats:", error);
      } finally {
        setStatsLoading(false);
      }
    }

    if (user) {
      loadDashboardStats();
    }
  }, [user, getHospitalId]);

  useEffect(() => {
    async function loadHospitalDoctors() {
      try {
        // Get hospital_id using the enhanced getHospitalId function
        const hospitalId = getHospitalId();
        
        if (!hospitalId) {
          console.error("No hospital ID found for user");
          setLoading(false);
          return;
        }

        const doctorsList = await listHospitalDoctors(hospitalId);
        setDoctors(doctorsList || []);
      } catch (error) {
        console.error("Failed to load hospital doctors:", error);
        setDoctors([]);
      } finally {
        setLoading(false);
      }
    }

    // Only load if user is available
    if (user) {
      loadHospitalDoctors();
    }
  }, [user, getHospitalId]);

  // Generate display data from DB stats
  const generateDisplayData = () => {
    if (!dashboardStats) {
      return { weeklyData: [], monthlyData: [], yearlyData: [] };
    }

    const totalDoctors = dashboardStats.users?.doctors || 0;
    const weeklyConsultations = dashboardStats.consultations?.weekly || 0;
    const monthlyConsultations = dashboardStats.consultations?.monthly || 0;
    const totalConsultations = dashboardStats.consultations?.total || 0;
    
    // Weekly data - simplified placeholder (Coming Soon for detailed breakdown)
    const weeklyData = [
      {
        day: 'This Week',
        consultations: weeklyConsultations,
        doctors: totalDoctors,
        percentage: '100%'
      }
    ];

    // Monthly data - simplified placeholder (Coming Soon for detailed breakdown)
    const monthlyData = [
      {
        week: 'This Month',
        consultations: monthlyConsultations,
        doctors: totalDoctors,
        percentage: '100%'
      }
    ];

    // Yearly data - simplified placeholder (Coming Soon for detailed breakdown)
    const yearlyData = [
      {
        month: 'Total',
        consultations: totalConsultations,
        doctors: totalDoctors,
        percentage: '100%'
      }
    ];

    return { weeklyData, monthlyData, yearlyData };
  };

  const { weeklyData, monthlyData, yearlyData } = generateDisplayData();

  const getCurrentData = () => {
    switch (timeRange) {
      case 'weekly':
        return weeklyData;
      case 'monthly':
        return monthlyData;
      case 'yearly':
        return yearlyData;
      default:
        return weeklyData;
    }
  };

  const getTotalConsultations = () => {
    // Use real data if available, otherwise fallback to generated data
    if (dashboardStats && dashboardStats.consultations) {
      switch (timeRange) {
        case 'weekly':
          return dashboardStats.consultations.weekly;
        case 'monthly':
          return dashboardStats.consultations.monthly;
        case 'yearly':
          return dashboardStats.consultations.total;
        default:
          return dashboardStats.consultations.weekly;
      }
    }
    // Fallback to generated data
    const data = getCurrentData();
    return data.reduce((sum, item) => sum + item.consultations, 0);
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'weekly':
        return 'This Week';
      case 'monthly':
        return 'This Month';
      case 'yearly':
        return 'This Year';
      default:
        return 'This Week';
    }
  };

  const getDataLabel = (item) => {
    switch (timeRange) {
      case 'weekly':
        return item.day;
      case 'monthly':
        return item.week;
      case 'yearly':
        return item.month;
      default:
        return item.day;
    }
  };

  // Function to get doctor status color and text
  const getDoctorStatus = (doctor) => {
    const isActive = doctor.status === 'active' || doctor.is_online;
    return {
      color: isActive ? 'text-green-600' : 'text-slate-400',
      bgColor: isActive ? 'bg-green-50' : 'bg-slate-50',
      text: isActive ? 'Active' : 'Inactive'
    };
  };

  const timeRangeOptions = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(false);
    };

    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Usage Overview - Takes 2/3 of width */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 h-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">Usage Overview</h3>
              <p className="text-xs sm:text-sm text-slate-600">Consultations and active doctors {getTimeRangeLabel().toLowerCase()}</p>
            </div>
            
            {/* Dropdown for time range */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDropdown(!showDropdown);
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-stone-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span>{timeRangeOptions.find(opt => opt.value === timeRange)?.label}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-1 w-32 bg-white border border-stone-200 rounded-lg shadow-lg z-10">
                  {timeRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTimeRange(option.value);
                        setShowDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg ${
                        timeRange === option.value ? 'text-[#004dd6] bg-blue-50' : 'text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {getCurrentData().map((item, index) => (
              <div 
                key={index} 
                className="flex items-center space-x-4 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-16 text-sm font-medium text-slate-600">
                  {getDataLabel(item)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">Consultations</span>
                    <span className="text-sm font-medium text-slate-900">
                      {item.consultations.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: item.percentage }}
                    ></div>
                  </div>
                </div>
                <div className="w-16 text-right">
                  <div className="text-xs text-slate-500">Doctors</div>
                  <div className="text-sm font-medium text-slate-900">{item.doctors}</div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-stone-200">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-slate-900">{getTotalConsultations().toLocaleString()}</div>
                <div className="text-xs text-slate-500">Total Consultations</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {loading ? "..." : doctors.length}
                </div>
                <div className="text-xs text-slate-500">Active Doctors</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Doctors List Section - Takes 1/3 of width */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 sm:p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Hospital Doctors</h3>
            {doctors.length > 0 && (
              <Link 
                href="/Hospital/doctor" 
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-[#004dd6] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Users className="h-4 w-4 mr-1" />
                View All
              </Link>
            )}
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004dd6]"></div>
            </div>
          ) : doctors.length === 0 ? (
            // Empty state - no doctors
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <UserPlus className="h-8 w-8 text-slate-400" />
              </div>
              <h4 className="text-lg font-medium text-slate-900 mb-2">No Doctors Onboarded</h4>
              <p className="text-sm text-slate-600 mb-6 max-w-xs mx-auto">
                Get started by adding doctors to your hospital to begin consultations.
              </p>
              <Link 
                href="/Hospital/addDoctor" 
                className="inline-flex items-center px-4 py-2 bg-[#004dd6] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Doctor
              </Link>
            </div>
          ) : (
            // Doctors list
            <div className="space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                {doctors.length} doctor{doctors.length !== 1 ? 's' : ''} onboarded
              </p>
              
              {doctors.slice(0, 5).map((doctor, index) => {
                const status = getDoctorStatus(doctor);
                return (
                  <div 
                    key={doctor.user_id || index} 
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg animate-slide-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white rounded-full border border-stone-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">
                          {doctor.first_name && doctor.last_name 
                            ? `Dr. ${doctor.first_name} ${doctor.last_name}` 
                            : doctor.username || 'Doctor'}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {doctor.specialties && doctor.specialties.length > 0 
                            ? doctor.specialties[0].name 
                            : 'General Medicine'}
                        </p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                      {status.text}
                    </div>
                  </div>
                );
              })}
              
              {doctors.length > 5 && (
                <div className="pt-2 border-t border-stone-200">
                  <Link 
                    href="/Hospital/doctor" 
                    className="block text-center text-sm text-[#004dd6] hover:text-blue-700 font-medium py-2"
                  >
                    View all {doctors.length} doctors
                  </Link>
                </div>
              )}
              
              <div className="pt-4">
                <Link 
                  href="/Hospital/addDoctor" 
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-white border border-stone-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add New Doctor
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out both;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;