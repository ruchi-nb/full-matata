"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, RefreshCw, Search } from 'lucide-react';
import TranscriptList from '@/components/Transcripts/TranscriptList';
import TranscriptViewer from '@/components/Transcripts/TranscriptViewer';
import { getPatientTranscripts, getTranscriptSummary } from '@/services/transcript-service';
import { getStoredTokens } from '@/data/api';

export default function PatientTranscriptsPage() {
  const router = useRouter();
  const [transcripts, setTranscripts] = useState([]);
  const [filteredTranscripts, setFilteredTranscripts] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

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
    // Filter transcripts based on search query
    if (searchQuery.trim() === '') {
      setFilteredTranscripts(transcripts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = transcripts.filter(t => 
        t.doctor.doctor_name.toLowerCase().includes(query) ||
        t.consultation_id.toString().includes(query) ||
        (t.hospital?.hospital_name || '').toLowerCase().includes(query)
      );
      setFilteredTranscripts(filtered);
    }
  }, [searchQuery, transcripts]);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getPatientTranscripts(100);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-3 rounded-lg">
                <FileText size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Transcripts</h1>
                <p className="text-gray-600">View your consultation history and conversations</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1">Total Consultations</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_transcripts}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-600 mb-1">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_messages}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-1">Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_sessions}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
                <p className="text-sm text-gray-600 mb-1">Avg. Messages</p>
                <p className="text-2xl font-bold text-gray-900">{summary.avg_messages_per_transcript}</p>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by doctor name, consultation ID, or hospital..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search size={20} className="absolute left-4 top-3.5 text-gray-400" />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error loading transcripts</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Transcripts List */}
        <TranscriptList
          transcripts={filteredTranscripts}
          onView={setSelectedTranscript}
          loading={loading}
        />

        {/* Search Results Info */}
        {searchQuery && !loading && (
          <div className="mt-4 text-center text-gray-600">
            Found {filteredTranscripts.length} transcript{filteredTranscripts.length !== 1 ? 's' : ''} matching "{searchQuery}"
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

