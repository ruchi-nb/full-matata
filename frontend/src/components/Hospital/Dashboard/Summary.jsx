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
  const { user, getHospitalId } = useUser();

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

  // Get current date information
  const getCurrentDateInfo = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentWeek = Math.ceil((now.getDate() + 6 - now.getDay()) / 7); // Week of month
    const currentMonth = now.getMonth(); // 0 = January, 1 = February, etc.
    const currentYear = now.getFullYear();
    
    return { currentDay, currentWeek, currentMonth, currentYear };
  };

  // Generate real-time data based on current date
  const generateRealTimeData = () => {
    const { currentDay, currentWeek, currentMonth } = getCurrentDateInfo();
    
    // Base data templates
    const allWeeklyDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Weekly data - only show days up to today
    const weeklyData = allWeeklyDays.slice(0, currentDay + 1).map((day, index) => {
      // Generate realistic consultation numbers (increasing trend with some variation)
      const baseConsultations = 80 + (index * 15);
      const variation = Math.floor(Math.random() * 30) - 15;
      const consultations = Math.max(50, baseConsultations + variation);
      
      // Doctors online (more during weekdays, less on weekends)
      const baseDoctors = day === 'Sat' || day === 'Sun' ? 12 : 20;
      const doctorVariation = Math.floor(Math.random() * 6) - 3;
      const doctors = Math.max(8, baseDoctors + doctorVariation);
      
      // Calculate percentage based on maximum expected for that day
      const maxExpected = day === 'Sat' || day === 'Sun' ? 120 : 200;
      const percentage = `${Math.min(100, (consultations / maxExpected) * 100).toFixed(2)}%`;
      
      return {
        day,
        consultations,
        doctors,
        percentage
      };
    });

    // Monthly data - only show weeks up to current week
    const monthlyData = Array.from({ length: currentWeek }, (_, index) => {
      const weekNumber = index + 1;
      // Increasing trend with some variation
      const baseConsultations = 800 + (weekNumber * 200);
      const variation = Math.floor(Math.random() * 100) - 50;
      const consultations = Math.max(500, baseConsultations + variation);
      
      const baseDoctors = 18 + (weekNumber * 1);
      const doctorVariation = Math.floor(Math.random() * 4) - 2;
      const doctors = Math.max(15, baseDoctors + doctorVariation);
      
      const percentage = `${Math.min(100, (weekNumber / 4) * 100).toFixed(2)}%`;
      
      return {
        week: `Week ${weekNumber}`,
        consultations,
        doctors,
        percentage
      };
    });

    // Yearly data - only show months up to current month
    const yearlyData = allMonths.slice(0, currentMonth + 1).map((month, index) => {
      // Seasonal variation - higher in winter months, lower in summer
      const seasonalFactor = [1.2, 1.1, 1.0, 0.9, 0.8, 0.85, 0.9, 1.0, 1.1, 1.2, 1.3, 1.2][index];
      
      const baseConsultations = 2500 + (index * 300);
      const variation = Math.floor(Math.random() * 500) - 250;
      const consultations = Math.max(2000, Math.floor((baseConsultations + variation) * seasonalFactor));
      
      const baseDoctors = 15 + (index * 1);
      const doctorVariation = Math.floor(Math.random() * 3) - 1;
      const doctors = Math.max(12, baseDoctors + doctorVariation);
      
      const percentage = `${Math.min(100, ((index + 1) / 12) * 100).toFixed(2)}%`;
      
      return {
        month,
        consultations,
        doctors,
        percentage
      };
    });

    return { weeklyData, monthlyData, yearlyData };
  };

  const { weeklyData, monthlyData, yearlyData } = generateRealTimeData();

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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Usage Overview - Takes 2/3 of width */}
      <div className="xl:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 h-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Usage Overview</h3>
              <p className="text-sm text-slate-600">Consultations and active doctors {getTimeRangeLabel().toLowerCase()}</p>
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
      <div className="xl:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 h-full">
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
                    key={doctor.id || index} 
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg animate-slide-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white rounded-full border border-stone-200 flex items-center justify-center">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-900">
                          {doctor.name || `Dr. ${doctor.first_name} ${doctor.last_name}`}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {doctor.specialty || doctor.department || 'General Medicine'}
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