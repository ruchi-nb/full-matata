"use client";
import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { Calendar, User, Building2, X, Stethoscope } from "lucide-react";

const TranscriptModal = ({ isOpen, onClose, patient, isLoading = false }) => {
  if (!isOpen) return null;

  const [currentTranscriptIndex, setCurrentTranscriptIndex] = useState(0);
  const currentTranscript = patient?.transcripts?.[currentTranscriptIndex];

  const handleDownloadTxt = () => {
    if (!currentTranscript?.entries) return;

    let content = `Consultation Transcript\n`;
    content += `Patient: ${patient.name}\n`;
    content += `Specialty: ${patient.specialty}\n`;
    content += `Date: ${currentTranscript.date}\n`;
    content += `Doctor: ${currentTranscript.doctor || "Not specified"}\n`;
    content += `Duration: ${currentTranscript.duration}\n`;
    content += `Transcript ID: ${currentTranscript.id}\n\n`;

    currentTranscript.entries.forEach((entry) => {
      content += `${entry.speaker}: ${entry.text}\n`;
    });

    // Add summary and follow-up if available
    if (currentTranscript.summary) {
      content += `\nSummary: ${currentTranscript.summary}\n`;
    }
    if (currentTranscript.followUp) {
      content += `Follow-up: ${currentTranscript.followUp}\n`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `transcript-${patient.name}-${currentTranscript.id}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!currentTranscript?.entries) return;

    const doc = new jsPDF();
    let y = 10;

    // Header
    doc.setFontSize(16);
    doc.text("Consultation Transcript", 10, y);
    y += 10;

    // Details
    doc.setFontSize(12);
    doc.text(`Patient: ${patient.name}`, 10, y);
    y += 6;
    doc.text(`Specialty: ${patient.specialty}`, 10, y);
    y += 6;
    doc.text(`Date: ${currentTranscript.date}`, 10, y);
    y += 6;
    doc.text(`Doctor: ${currentTranscript.doctor || "Not specified"}`, 10, y);
    y += 6;
    doc.text(`Duration: ${currentTranscript.duration}`, 10, y);
    y += 6;
    doc.text(`Transcript ID: ${currentTranscript.id}`, 10, y);
    y += 10;

    // Messages
    if (currentTranscript.entries && currentTranscript.entries.length > 0) {
      doc.setFontSize(14);
      doc.text("Conversation:", 10, y);
      y += 8;

      doc.setFontSize(10);
      currentTranscript.entries.forEach((entry) => {
        const sender = entry.speaker === "Doctor" ? "AI Doctor" : "Patient";
        const text = `${sender}: ${entry.text}`;
        
        const splitText = doc.splitTextToSize(text, 180);
        
        if (entry.speaker === "Doctor") {
          doc.setTextColor(0, 100, 0); // Green for doctor
        } else {
          doc.setTextColor(0, 0, 150); // Blue for patient
        }
        
        doc.text(splitText, 10, y);
        y += splitText.length * 5;
        
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
      });
    }

    // Add summary and follow-up
    if (currentTranscript.summary) {
      doc.setTextColor(0, 0, 0);
      if (y > 250) {
        doc.addPage();
        y = 10;
      }
      doc.setFontSize(14);
      doc.text("Medical Summary:", 10, y);
      y += 8;
      doc.setFontSize(10);
      const summaryText = doc.splitTextToSize(currentTranscript.summary, 180);
      doc.text(summaryText, 10, y);
      y += summaryText.length * 5;
    }

    if (currentTranscript.followUp) {
      if (y > 250) {
        doc.addPage();
        y = 10;
      }
      doc.setFontSize(14);
      doc.text("Follow-up Plan:", 10, y);
      y += 8;
      doc.setFontSize(10);
      const followUpText = doc.splitTextToSize(currentTranscript.followUp, 180);
      doc.text(followUpText, 10, y);
    }

    doc.setTextColor(0, 0, 0);
    doc.save(`transcript-${patient.name}-${currentTranscript.id}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Consultation Transcript
              </h2>
              <p className="text-sm text-gray-600">ID: {currentTranscript?.id || 'N/A'}</p>
            </div>
          </div>

          {/* Dropdown to select transcript */}
          {patient?.transcripts?.length > 1 && (
            <select
              value={currentTranscriptIndex}
              onChange={(e) => setCurrentTranscriptIndex(Number(e.target.value))}
              className="text-black border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {patient.transcripts.map((t, index) => (
                <option key={t.id} value={index}>
                  {t.date} - {t.doctor}
                </option>
              ))}
            </select>
          )}

          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={onClose}
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Info Cards */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <Calendar size={16} />
                <span className="text-sm font-medium">Date</span>
              </div>
              <p className="text-gray-900 font-semibold">
                {currentTranscript?.date || 'N/A'}
              </p>
              <p className="text-sm text-gray-500">
                {currentTranscript?.time || 'N/A'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <User size={16} />
                <span className="text-sm font-medium">Patient</span>
              </div>
              <p className="text-gray-900 font-semibold">{patient.name}</p>
              <p className="text-sm text-gray-500">{patient.email || 'N/A'}</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <User size={16} />
                <span className="text-sm font-medium">Doctor</span>
              </div>
              <p className="text-gray-900 font-semibold">{currentTranscript?.doctor || "Not specified"}</p>
              <p className="text-sm text-gray-500">{currentTranscript?.doctorEmail || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Hospital and Status */}
        <div className="px-6 pt-4 pb-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-700">
            <Building2 size={18} />
            <span className="font-medium">{patient.hospital || 'Hospital Name'}</span>
            <span className="ml-auto text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              {patient.specialty}
            </span>
            <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
              {currentTranscript ? 'Completed' : 'Active'}
            </span>
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                Loading transcript data...
              </div>
            ) : currentTranscript?.entries && currentTranscript.entries.length > 0 ? (
              currentTranscript.entries.map((entry, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      entry.speaker === "Doctor" 
                        ? "bg-green-100 text-green-600" 
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {entry.speaker === "Doctor" ? (
                      <Stethoscope size={16} />
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold mb-1 ${
                      entry.speaker === "Doctor" 
                        ? "text-green-700" 
                        : "text-blue-700"
                    }`}>
                      {entry.speaker === "Doctor" ? "AI Doctor" : "Patient"}
                    </div>
                    <div className="text-gray-800 leading-relaxed mb-1">
                      {entry.text}
                    </div>
                    {entry.timestamp && (
                      <div className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                {patient?.transcripts?.length === 0 
                  ? "No transcripts available for this patient" 
                  : "No conversation entries found in this transcript"}
              </div>
            )}
          </div>

          {/* Summary and Follow-up */}
          {(currentTranscript?.summary || currentTranscript?.followUp) && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              {currentTranscript.summary && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Medical Summary</h3>
                  <p className="text-gray-700">{currentTranscript.summary}</p>
                </div>
              )}
              {currentTranscript.followUp && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Follow-up Plan</h3>
                  <p className="text-gray-700">{currentTranscript.followUp}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            Transcript ID: {currentTranscript?.id || 'N/A'}
          </div>
          <div className="flex space-x-3">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={handleDownloadTxt}
            >
              Download TXT
            </button>
            <button
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              onClick={handleDownloadPdf}
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptModal;