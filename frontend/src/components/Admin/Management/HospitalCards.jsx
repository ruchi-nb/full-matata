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
  const [pageSize, setPageSize] = useState(6); // Default to 6 items per page

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
            <div className="flex items-center gap-4">
              {/* Page Size Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Show:</label>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={3}>3 per page</option>
                  <option value={6}>6 per page</option>
                  <option value={9}>9 per page</option>
                  <option value={12}>12 per page</option>
                  <option value={totalItems}>All</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hospitals Grid */}
      {!loading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {paginatedHospitals.map((hospital) => (
          <div
            key={hospital.id}
            className="relative bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6"
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
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg ${hospital.color}`}
              >
                {hospital.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{hospital.name}</h3>
                <p className="text-sm text-slate-500">{hospital.specialty}</p>
                <p className="text-xs text-slate-400">{hospital.email}</p>
              </div>
            </div>

            {/* Location */}
            <p className="mt-3 text-sm text-slate-600">📍 {hospital.location}</p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
              <div>
                <p className="text-sm text-slate-500">Doctors</p>
                <p className="text-base font-semibold text-slate-800">{hospital.doctors}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Consultations</p>
                <p className="text-base font-semibold text-slate-800">{hospital.consultations}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="text-xs font-medium text-slate-700">{hospital.phone}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => handleView(hospital)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <Eye className="w-4 h-4" /> View
              </button>
              <button
                onClick={() => handleEdit(hospital)}
                className="flex items-center gap-1 text-amber-500 hover:text-amber-700 text-sm font-medium"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => handleDelete(hospital.id)}
                className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" /> Delete
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

      {/* Pagination Controls */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          {/* Pagination Info */}
          <div className="text-sm text-gray-700">
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
              Previous
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {/* Show first page */}
              {currentPage > 3 && (
                <>
                  <button
                    onClick={() => goToPage(1)}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700"
                  >
                    1
                  </button>
                  {currentPage > 4 && (
                    <span className="px-2 text-gray-500">...</span>
                  )}
                </>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      currentPage === pageNum
                        ? 'text-blue-600 bg-blue-50 border border-blue-300'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show last page */}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && (
                    <span className="px-2 text-gray-500">...</span>
                  )}
                  <button
                    onClick={() => goToPage(totalPages)}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-500"
            >
              Next
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