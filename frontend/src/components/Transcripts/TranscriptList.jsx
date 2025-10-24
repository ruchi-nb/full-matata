"use client";
import { FileText, Calendar, User, MessageSquare, Eye } from 'lucide-react';

export default function TranscriptList({ transcripts, onView, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <FileText size={64} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Transcripts Found</h3>
        <p className="text-gray-500">There are no consultation transcripts available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {transcripts.map((transcript) => (
        <div
          key={transcript.consultation_id}
          className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  Consultation #{transcript.consultation_id}
                </h3>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  <Calendar size={14} />
                  {new Date(transcript.consultation_date).toLocaleDateString()}
                </div>
              </div>
              <FileText size={24} className="text-blue-100" />
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Patient Info */}
            <div className="flex items-start gap-2">
              <User size={16} className="text-gray-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Patient</p>
                <p className="text-sm text-gray-900 font-semibold truncate">
                  {transcript.patient.patient_name}
                </p>
              </div>
            </div>

            {/* Doctor Info */}
            <div className="flex items-start gap-2">
              <User size={16} className="text-gray-400 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Doctor</p>
                <p className="text-sm text-gray-900 font-semibold truncate">
                  {transcript.doctor.doctor_name}
                </p>
              </div>
            </div>

            {/* Hospital Info (if available) */}
            {transcript.hospital?.hospital_name && (
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0">🏥</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">Hospital</p>
                  <p className="text-sm text-gray-900 font-semibold truncate">
                    {transcript.hospital.hospital_name}
                  </p>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1 text-gray-600">
                <MessageSquare size={14} />
                <span className="text-sm">{transcript.total_messages} messages</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                transcript.status === 'completed' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {transcript.status}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => onView(transcript)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Eye size={18} />
              View Transcript
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

