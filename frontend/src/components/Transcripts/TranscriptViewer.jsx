"use client";
import { useState } from 'react';
import { FileText, Calendar, User, Building2, Download, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { downloadTranscript } from '@/services/transcript-service';

export default function TranscriptViewer({ transcript, onClose }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!transcript) return null;

  const { 
    consultation_id, 
    consultation_date, 
    consultation_type,
    status,
    patient, 
    doctor, 
    hospital,
    total_messages,
    messages 
  } = transcript;

  const handleDownload = () => {
    try {
      downloadTranscript(transcript);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download transcript');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Consultation Transcript</h2>
              <p className="text-blue-100">ID: {consultation_id}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition flex items-center gap-2"
              >
                <Download size={18} />
                Download
              </button>
              <button
                onClick={onClose}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="p-6 bg-gray-50 border-b grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Calendar size={16} />
              <span className="text-sm font-medium">Date</span>
            </div>
            <p className="text-gray-900 font-semibold">
              {new Date(consultation_date).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(consultation_date).toLocaleTimeString()}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <User size={16} />
              <span className="text-sm font-medium">Patient</span>
            </div>
            <p className="text-gray-900 font-semibold">{patient.patient_name}</p>
            <p className="text-sm text-gray-500">{patient.patient_email}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <User size={16} />
              <span className="text-sm font-medium">Doctor</span>
            </div>
            <p className="text-gray-900 font-semibold">{doctor.doctor_name}</p>
            <p className="text-sm text-gray-500">{doctor.doctor_email}</p>
          </div>
        </div>

        {hospital?.hospital_name && (
          <div className="px-6 pt-4 pb-2 bg-gray-50 border-b">
            <div className="flex items-center gap-2 text-gray-700">
              <Building2 size={18} />
              <span className="font-medium">{hospital.hospital_name}</span>
              <span className="ml-auto text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                {consultation_type}
              </span>
              <span className={`text-sm px-3 py-1 rounded-full ${
                status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {status}
              </span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="overflow-y-auto max-h-[50vh]">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare size={20} />
                Conversation ({total_messages} messages)
              </h3>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                {isExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {isExpanded && (
              <div className="space-y-4">
                {messages && messages.length > 0 ? (
                  messages.map((msg, index) => (
                    <div
                      key={msg.message_id || index}
                      className={`p-4 rounded-lg ${
                        msg.sender_type === 'patient' || msg.sender_type === 'user'
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : msg.sender_type === 'system'
                          ? 'bg-gray-50 border-l-4 border-gray-400'
                          : 'bg-green-50 border-l-4 border-green-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          {msg.sender_type === 'patient' || msg.sender_type === 'user'
                            ? '👤 Patient'
                            : msg.sender_type === 'system'
                            ? '⚙️ System'
                            : '🩺 AI Doctor'}
                        </span>
                        {msg.timestamp && (
                          <span className="text-sm text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{msg.message_text}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No messages found in this transcript
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

