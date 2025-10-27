"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Eye, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllHospitals } from "@/data/api";
import { hospitalApiService } from "@/services/hospitalApiService";

const HospitalList = () => {
  const router = useRouter();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  
  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);

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

  // Filtered hospitals (search only)
  const filteredHospitals = useMemo(() => {
    let filtered = hospitals;

    // Apply search filter
    if (searchTerm) {
      filtered = hospitals.filter(hospital =>
        hospital.hospital_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.hospital_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.admin_contact?.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Pagination handlers - Fixed to prevent repetition
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
      {/* Section Header with Search */}
      <div className="section-header mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Hospital List</h2>
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search hospitals..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Results Info */}
          <div className="text-sm text-gray-700">
            Showing {paginatedHospitals.length} of {totalItems} hospitals
            {searchTerm && ` matching "${searchTerm}"`}
          </div>

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

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-4">
        {paginatedHospitals.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {searchTerm ? 'No hospitals found matching your search' : 'No hospitals found'}
          </div>
        ) : (
          paginatedHospitals.map((hospital) => (
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
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Admin Email</th>
              <th className="px-4 py-3">Admin Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedHospitals.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                  {searchTerm ? 'No hospitals found matching your search' : 'No hospitals found'}
                </td>
              </tr>
            ) : (
              paginatedHospitals.map((hospital) => (
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

                  {/* Address */}
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {hospital.address || "N/A"}
                  </td>

                  {/* Admin Email */}
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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

      {/* Clear Search Button */}
      {searchTerm && filteredHospitals.length === 0 && (
        <div className="text-center mt-6">
          <button
            onClick={() => setSearchTerm('')}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
};

export default HospitalList;