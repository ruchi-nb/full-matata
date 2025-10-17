// Optimized Transcripts Component - Following UI patterns with unified services
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { unifiedApiService } from '@/services/unifiedApiService';
import { useUser } from '@/data/UserContext';
import { Calendar, Clock, User, Stethoscope, Download, Eye, RefreshCw, Filter, Search, ChevronRight, FileText, MessageSquare } from 'lucide-react';

const Transcripts = () => {
  const { user, getUserDisplayName } = useUser();
  
  // State
  const [consultations, setConsultations] = useState([]);
  const [filteredConsultations, setFilteredConsultations] = useState([]);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [doctorSpecialtyFilter, setDoctorSpecialtyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Available filters
  const specialtyOptions = ['all', 'Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General Medicine'];
  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // Load consultations from localStorage and API
  const loadConsultations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Try to get consultations from API first
      let apiConsultations = [];
      try {
        const patientId = user?.user_id || user?.id;
        if (patientId) {
          apiConsultations = await unifiedApiService.requestWithRetry(`/consultation/patient/${patientId}`);
        }
      } catch (apiError) {
        console.warn('Failed to load consultations from API:', apiError);
      }
      
      // Get consultations from localStorage as fallback
      const storedConsultations = JSON.parse(localStorage.getItem('patient_consultations') || '[]');
      
      // Merge and deduplicate consultations
      const allConsultations = [...apiConsultations, ...storedConsultations];
      const uniqueConsultations = allConsultations.reduce((acc, current) => {
        const existing = acc.find(item => item.consultation_id === current.consultation_id);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      // Transform consultations to include doctor information
      const enrichedConsultations = uniqueConsultations.map(consultation => ({
        ...consultation,
        id: consultation.consultation_id || consultation.id,
        doctor: {
          id: consultation.doctor_id || consultation.doctor?.id,
          name: consultation.doctor_name || consultation.doctor?.name || 'Dr. Unknown',
          specialty: consultation.specialty_name || consultation.doctor?.specialty || 'General Medicine',
          image: consultation.doctor_image || consultation.doctor?.image || '/images/doctor-placeholder.png'
        },
        patient: {
          id: consultation.patient_id || consultation.patient?.id,
          name: consultation.patient_name || consultation.patient?.name || getUserDisplayName(),
          email: consultation.patient_email || consultation.patient?.email || user?.email
        },
        status: consultation.status || 'completed',
        duration: consultation.duration || consultation.call_duration || 0,
        transcript: consultation.transcript || consultation.conversation_transcript || '',
        summary: consultation.summary || consultation.consultation_summary || '',
        createdAt: consultation.created_at || consultation.createdAt || new Date().toISOString(),
        updatedAt: consultation.updated_at || consultation.updatedAt || new Date().toISOString()
      }));
      
      // Sort by creation date (newest first)
      enrichedConsultations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setConsultations(enrichedConsultations);
      
      // Log analytics
      await unifiedApiService.logEvent('transcripts_loaded', {
        total_consultations: enrichedConsultations.length,
        api_consultations: apiConsultations.length,
        stored_consultations: storedConsultations.length
      });
      
    } catch (error) {
      console.error('Failed to load consultations:', error);
      setError('Failed to load consultation history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user, getUserDisplayName]);

  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...consultations];
    
    // Doctor specialty filter
    if (doctorSpecialtyFilter !== 'all') {
      filtered = filtered.filter(consultation => 
        consultation.doctor.specialty.toLowerCase().includes(doctorSpecialtyFilter.toLowerCase())
      );
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const consultationDate = new Date(consultation.createdAt);
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(consultation => {
            const consultationDate = new Date(consultation.createdAt);
            return consultationDate.toDateString() === now.toDateString();
          });
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(consultation => 
            new Date(consultation.createdAt) >= weekAgo
          );
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(consultation => 
            new Date(consultation.createdAt) >= monthAgo
          );
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(consultation => 
            new Date(consultation.createdAt) >= yearAgo
          );
          break;
      }
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(consultation => consultation.status === statusFilter);
    }
    
    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(consultation => 
        consultation.doctor.name.toLowerCase().includes(query) ||
        consultation.doctor.specialty.toLowerCase().includes(query) ||
        consultation.summary.toLowerCase().includes(query) ||
        consultation.transcript.toLowerCase().includes(query)
      );
    }
    
    setFilteredConsultations(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [consultations, doctorSpecialtyFilter, dateFilter, statusFilter, searchQuery]);

  // Apply filters when dependencies change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Load consultations on mount
  useEffect(() => {
    loadConsultations();
  }, [loadConsultations]);

  // Open consultation modal
  const openModal = (consultation) => {
    setSelectedConsultation(consultation);
    setIsModalOpen(true);
    
    // Log analytics
    unifiedApiService.logEvent('transcript_viewed', {
      consultation_id: consultation.id,
      doctor_id: consultation.doctor.id,
      duration: consultation.duration
    });
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedConsultation(null);
  };

  // Download transcript
  const downloadTranscript = (consultation) => {
    try {
      const transcriptData = {
        consultation_id: consultation.id,
        doctor: consultation.doctor.name,
        specialty: consultation.doctor.specialty,
        patient: consultation.patient.name,
        date: new Date(consultation.createdAt).toLocaleDateString(),
        duration: formatDuration(consultation.duration),
        summary: consultation.summary,
        transcript: consultation.transcript
      };
      
      const blob = new Blob([JSON.stringify(transcriptData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consultation-${consultation.id}-${new Date(consultation.createdAt).toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Log analytics
      unifiedApiService.logEvent('transcript_downloaded', {
        consultation_id: consultation.id,
        doctor_id: consultation.doctor.id
      });
      
    } catch (error) {
      console.error('Failed to download transcript:', error);
    }
  };

  // Consult again
  const handleConsultAgain = (consultation) => {
    // Navigate to consult page with doctor ID
    window.location.href = `/patientportal/consult?doctorId=${consultation.doctor.id}`;
    
    // Log analytics
    unifiedApiService.logEvent('consult_again_clicked', {
      consultation_id: consultation.id,
      doctor_id: consultation.doctor.id,
      previous_duration: consultation.duration
    });
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'ongoing': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredConsultations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentConsultations = filteredConsultations.slice(startIndex, endIndex);

  // Refresh data
  const refreshData = () => {
    loadConsultations();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-lg text-gray-600">Loading consultation history...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">My Consultation History</h1>
            <p className="text-gray-600">View and manage your past consultations with doctors</p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <button
              onClick={refreshData}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-red-500 mr-2">⚠️</div>
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Consultations
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by doctor, specialty, or content..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Specialty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Specialty
              </label>
              <select
                value={doctorSpecialtyFilter}
                onChange={(e) => setDoctorSpecialtyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {specialtyOptions.map(specialty => (
                  <option key={specialty} value={specialty}>
                    {specialty === 'all' ? 'All Specialties' : specialty}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Date
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {dateOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {currentConsultations.length} of {filteredConsultations.length} consultations
              {filteredConsultations.length !== consultations.length && (
                <span className="ml-2 text-blue-600">
                  (filtered from {consultations.length} total)
                </span>
              )}
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Consultations List */}
        {currentConsultations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No consultations found</h3>
            <p className="text-gray-600 mb-6">
              {filteredConsultations.length === 0 && consultations.length > 0
                ? 'Try adjusting your filters to see more results.'
                : 'You haven\'t had any consultations yet. Start by booking your first consultation!'}
            </p>
            {consultations.length === 0 && (
              <button
                onClick={() => window.location.href = '/patientportal/doctors'}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Book Your First Consultation
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentConsultations.map(consultation => (
              <div key={consultation.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
                {/* Doctor Info */}
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <img 
                      src={consultation.doctor.image} 
                      alt={consultation.doctor.name}
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(consultation.doctor.name)}&background=3B82F6&color=fff&size=200`;
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{consultation.doctor.name}</h3>
                    <p className="text-sm text-gray-600">{consultation.doctor.specialty}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(consultation.status)}`}>
                    {consultation.status}
                  </span>
                </div>

                {/* Consultation Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>{formatDate(consultation.createdAt)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>Duration: {formatDuration(consultation.duration)}</span>
                  </div>
                  {consultation.summary && (
                    <div className="text-sm text-gray-700 line-clamp-2">
                      <strong>Summary:</strong> {consultation.summary}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => openModal(consultation)}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </button>
                  
                  <button
                    onClick={() => downloadTranscript(consultation)}
                    className="flex items-center justify-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    title="Download Transcript"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleConsultAgain(consultation)}
                    className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    title="Consult Again"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Consultation Detail Modal */}
        {isModalOpen && selectedConsultation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                      <img 
                        src={selectedConsultation.doctor.image} 
                        alt={selectedConsultation.doctor.name}
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConsultation.doctor.name)}&background=3B82F6&color=fff&size=200`;
                        }}
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Consultation with {selectedConsultation.doctor.name}
                      </h2>
                      <p className="text-gray-600">{selectedConsultation.doctor.specialty}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Consultation Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Consultation Details</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>{formatDate(selectedConsultation.createdAt)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>Duration: {formatDuration(selectedConsultation.duration)}</span>
                      </div>
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        <span>Patient: {selectedConsultation.patient.name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Status</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedConsultation.status)}`}>
                      {selectedConsultation.status}
                    </span>
                  </div>
                </div>

                {/* Summary */}
                {selectedConsultation.summary && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">Consultation Summary</h3>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-gray-700">{selectedConsultation.summary}</p>
                    </div>
                  </div>
                )}

                {/* Transcript */}
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">Conversation Transcript</h3>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    {selectedConsultation.transcript ? (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedConsultation.transcript}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No transcript available for this consultation.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => downloadTranscript(selectedConsultation)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2 inline" />
                  Download Transcript
                </button>
                <button
                  onClick={() => handleConsultAgain(selectedConsultation)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 mr-2 inline" />
                  Consult Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transcripts;