"use client";

import { Eye, Pencil, Trash2, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { hospitalApiService } from "@/services/hospitalApiService";
import ViewModal from "./ViewModal";
import EditHospitalModal from "./EditModal";

export default function HospitalCards() {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(4); // Default to 4 items per page

  // Load hospitals on component mount
  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load hospitals from API
      const hospitalsData = await hospitalApiService.listHospitals();
      
      // Transform backend data to frontend format
      const transformedHospitals = hospitalsData.map(hospital => 
        hospitalApiService.transformHospitalData(hospital)
      );
      
      setHospitals(transformedHospitals);
    } catch (err) {
      console.error('Error loading hospitals:', err);
      setError('Failed to load hospitals. Please try again.');
      setHospitals([]); // Set empty array instead of mock data
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this hospital?");
    if (!confirm) return;
    
    try {
      // Delete hospital via API
      await hospitalApiService.deleteHospital(id);
      
      // Remove from local state
      setHospitals((prev) => prev.filter((h) => h.id !== id));
      
      // Show success message
      console.log('Hospital deleted successfully');
    } catch (err) {
      console.error('Error deleting hospital:', err);
      alert('Failed to delete hospital. Please try again.');
    }
  };

  const handleEdit = (hospital) => {
    setSelectedHospital(hospital);
    setIsEditOpen(true);
  };

  const handleView = (hospital) => {
    setSelectedHospital(hospital);
    setIsViewOpen(true);
  };

  // Callback to update hospital after editing
  const handleUpdateHospital = async (updatedHospital) => {
    try {
      // Update hospital via API
      const backendData = hospitalApiService.transformToBackendFormat(updatedHospital);
      await hospitalApiService.updateHospitalProfile(updatedHospital.id, backendData);
      
      // Update local state
      setHospitals((prev) =>
        prev.map((h) => (h.id === updatedHospital.id ? updatedHospital : h))
      );
      
      console.log('Hospital updated successfully');
    } catch (err) {
      console.error('Error updating hospital:', err);
      alert('Failed to update hospital. Please try again.');
    }
  };

  // Filtered hospitals (search only)
  const filteredHospitals = useMemo(() => {
    let filtered = hospitals;

    // Apply search filter
    if (searchTerm) {
      filtered = hospitals.filter(hospital =>
        hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.specialty.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [hospitals, searchTerm]);

  // Paginated hospitals
  const paginatedHospitals = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredHospitals.slice(startIndex, endIndex);
  }, [filteredHospitals, currentPage, pageSize]);

  // Pagination info
  const totalPages = Math.ceil(filteredHospitals.length / pageSize);
  const totalItems = filteredHospitals.length;

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle page size change
  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1); // Reset to first page
  };

  // Pagination handlers
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  // Generate page numbers without repetition
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate start and end of page range
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're at the beginning
      if (currentPage <= 3) {
        end = 4;
      }
      
      // Adjust if we're at the end
      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }
      
      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        if (i > 1 && i < totalPages) {
          pages.push(i);
        }
      }
      
      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <>
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading hospitals...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
              <button 
                onClick={loadHospitals}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Controls */}
      {!loading && !error && (
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search hospitals by name, email, location, or specialty..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Results Info */}
            <div className="text-sm text-gray-700">
              Showing {paginatedHospitals.length} of {totalItems} hospitals
              {searchTerm && ` matching "${searchTerm}"`}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              {/* Page Size Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Show:</label>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={4}>4 per page</option>
                  <option value={8}>8 per page</option>
                  <option value={12}>12 per page</option>
                  <option value={16}>16 per page</option>
                  <option value={totalItems}>All</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hospitals Grid */}
      {!loading && !error && (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedHospitals.map((hospital) => (
          <div
            key={hospital.id}
            className="relative bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-4 sm:p-6"
          >
            {/* Status */}
            <div
              className={`absolute top-3 right-3 text-xs font-medium px-2 py-1 rounded-full ${
                hospital.status === "Active"
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              ● {hospital.status}
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold text-base sm:text-lg ${hospital.color}`}
              >
                {hospital.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{hospital.name}</h3>
                <p className="text-xs sm:text-sm text-slate-500 truncate">{hospital.specialty}</p>
                <p className="text-xs text-slate-400 truncate">{hospital.email}</p>
              </div>
            </div>

            {/* Location */}
            <p className="mt-3 text-xs sm:text-sm text-slate-600 truncate">📍 {hospital.location}</p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 text-center">
              <div>
                <p className="text-xs sm:text-sm text-slate-500">Doctors</p>
                <p className="text-sm sm:text-base font-semibold text-slate-800">{hospital.doctors}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-500">Consultations</p>
                <p className="text-sm sm:text-base font-semibold text-slate-800">{hospital.consultations}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-500">Phone</p>
                <p className="text-xs font-medium text-slate-700 truncate">{hospital.phone}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 mt-4 sm:mt-6">
              <button
                onClick={() => handleView(hospital)}
                className="flex items-center justify-center gap-1 text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium py-2 px-3 rounded-md hover:bg-blue-50"
              >
                <Eye className="w-3 h-3 sm:w-4 sm:h-4" /> View
              </button>
              <button
                onClick={() => handleEdit(hospital)}
                className="flex items-center justify-center gap-1 text-amber-500 hover:text-amber-700 text-xs sm:text-sm font-medium py-2 px-3 rounded-md hover:bg-amber-50"
              >
                <Pencil className="w-3 h-3 sm:w-4 sm:h-4" /> Edit
              </button>
              <button
                onClick={() => handleDelete(hospital.id)}
                className="flex items-center justify-center gap-1 text-red-500 hover:text-red-700 text-xs sm:text-sm font-medium py-2 px-3 rounded-md hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /> Delete
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredHospitals.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No hospitals found' : 'No hospitals available'}
          </h3>
          <p className="text-gray-500">
            {searchTerm 
              ? `No hospitals match your search for "${searchTerm}". Try adjusting your search terms.`
              : 'There are no hospitals to display at the moment.'
            }
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Pagination Controls - FIXED VERSION */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Pagination Info */}
          <div className="text-sm text-gray-700 text-center sm:text-left">
            Page {currentPage} of {totalPages} ({totalItems} total hospitals)
          </div>

          {/* Pagination Buttons */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-500"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Page Numbers - Fixed to prevent repetition */}
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-gray-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      currentPage === page
                        ? 'text-blue-600 bg-blue-50 border border-blue-300'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-500"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ViewModal
        hospital={selectedHospital}
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
      />

      <EditHospitalModal
        hospital={selectedHospital}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onUpdate={handleUpdateHospital}
      />
    </>
  );
}