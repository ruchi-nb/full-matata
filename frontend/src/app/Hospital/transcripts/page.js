"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, RefreshCw, Search, Filter, Building2 } from 'lucide-react';
import TranscriptList from '@/components/Transcripts/TranscriptList';
import TranscriptViewer from '@/components/Transcripts/TranscriptViewer';
import { getHospitalAdminTranscripts, getTranscriptSummary } from '@/services/transcript-service';
import { getStoredTokens } from '@/data/api';

export default function HospitalAdminTranscriptsPage() {
  const router = useRouter();
  const [transcripts, setTranscripts] = useState([]);
  const [filteredTranscripts, setFilteredTranscripts] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [error, setError] = useState(null);

  // Get unique doctors from transcripts
  const doctors = transcripts.reduce((acc, t) => {
    if (!acc.find(d => d.doctor_id === t.doctor.doctor_id)) {
      acc.push({
        doctor_id: t.doctor.doctor_id,
        doctor_name: t.doctor.doctor_name
      });
    }
    return acc;
  }, []);

  useEffect(() => {
    // Check authentication
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      router.push('/');
      return;
    }
    
    fetchTranscripts();
    fetchSummary();
  }, [router]);

  useEffect(() => {
    // Filter transcripts
    let filtered = transcripts;

    // Filter by selected doctor
    if (selectedDoctor) {
      filtered = filtered.filter(t => t.doctor.doctor_id === selectedDoctor);
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.patient.patient_name.toLowerCase().includes(query) ||
        t.doctor.doctor_name.toLowerCase().includes(query) ||
        t.consultation_id.toString().includes(query) ||
        (t.hospital?.hospital_name || '').toLowerCase().includes(query)
      );
    }

    setFilteredTranscripts(filtered);
  }, [searchQuery, selectedDoctor, transcripts]);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getHospitalAdminTranscripts(null, 200);
      setTranscripts(result.transcripts || []);
      setFilteredTranscripts(result.transcripts || []);
    } catch (err) {
      console.error('Error fetching transcripts:', err);
      setError(err.message || 'Failed to load transcripts');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const result = await getTranscriptSummary();
      setSummary(result.summary);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const handleRefresh = () => {
    fetchTranscripts();
    fetchSummary();
  };

  // Get unique hospitals
  const hospitals = transcripts.reduce((acc, t) => {
    if (t.hospital?.hospital_name && !acc.includes(t.hospital.hospital_name)) {
      acc.push(t.hospital.hospital_name);
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600 p-3 rounded-lg">
                <Building2 size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Hospital Transcripts</h1>
                <p className="text-gray-600">View all consultation transcripts across your hospital</p>
                {hospitals.length > 0 && (
                  <p className="text-sm text-purple-600 font-medium mt-1">
                    {hospitals.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-1">Total Consultations</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_transcripts}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_messages}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-600 mb-1">Active Doctors</p>
                <p className="text-2xl font-bold text-gray-900">{doctors.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
                <p className="text-sm text-gray-600 mb-1">Avg. Messages</p>
                <p className="text-2xl font-bold text-gray-900">{summary.avg_messages_per_transcript}</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by patient, doctor, consultation ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <Search size={20} className="absolute left-4 top-3.5 text-gray-400" />
            </div>

            {/* Doctor Filter */}
            <div className="relative">
              <select
                value={selectedDoctor || ''}
                onChange={(e) => setSelectedDoctor(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="">All Doctors</option>
                {doctors.map(doctor => (
                  <option key={doctor.doctor_id} value={doctor.doctor_id}>
                    {doctor.doctor_name}
                  </option>
                ))}
              </select>
              <Filter size={20} className="absolute left-4 top-3.5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error loading transcripts</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Active Filters */}
        {(selectedDoctor || searchQuery) && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {selectedDoctor && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                Doctor: {doctors.find(d => d.doctor_id === selectedDoctor)?.doctor_name}
                <button onClick={() => setSelectedDoctor(null)} className="hover:text-purple-900">×</button>
              </span>
            )}
            {searchQuery && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-blue-900">×</button>
              </span>
            )}
          </div>
        )}

        {/* Transcripts List */}
        <TranscriptList
          transcripts={filteredTranscripts}
          onView={setSelectedTranscript}
          loading={loading}
        />

        {/* Results Info */}
        {!loading && (
          <div className="mt-4 text-center text-gray-600">
            Showing {filteredTranscripts.length} of {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Transcript Viewer Modal */}
        {selectedTranscript && (
          <TranscriptViewer
            transcript={selectedTranscript}
            onClose={() => setSelectedTranscript(null)}
          />
        )}
      </div>
    </div>
  );
}

