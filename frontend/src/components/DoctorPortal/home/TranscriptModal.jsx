"use client";
import React, { useState } from "react";
import { jsPDF } from "jspdf";

const TranscriptModal = ({ isOpen, onClose, patient }) => {
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

    doc.setFontSize(16);
    doc.text("Consultation Transcript", 10, y);
    y += 10;

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

    currentTranscript.entries.forEach((entry) => {
      const text = `${entry.speaker}: ${entry.text}`;
      const splitText = doc.splitTextToSize(text, 180);

      if (entry.speaker === "Doctor") {
        doc.setTextColor(0, 80, 200);
      } else {
        doc.setTextColor(0, 150, 0);
      }

      doc.text(splitText, 10, y);
      y += splitText.length * 6;

      if (y > 280) {
        doc.addPage();
        y = 10;
      }
    });

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-user h-6 w-6 text-blue-600"
                viewBox="0 0 24 24"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Consultation Transcript
              </h2>
              <p className="text-sm text-gray-600">{patient.name}</p>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-x h-6 w-6 text-gray-500"
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        </div>

        {/* Transcript info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center">
            <span className="font-medium">Date:</span>
            <span className="ml-2">{currentTranscript?.date}</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium">Doctor:</span>
            <span className="ml-2">{currentTranscript?.doctor || "Not specified"}</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium">Duration:</span>
            <span className="ml-2">{currentTranscript?.duration}</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium">Specialty:</span>
            <span className="ml-2">{patient.specialty}</span>
          </div>
        </div>

        {/* Conversation content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {currentTranscript?.entries?.map((entry, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    entry.speaker === "Doctor" 
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {entry.speaker === "Doctor" ? "D" : "P"}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold mb-1 ${
                    entry.speaker === "Doctor" 
                      ? "text-blue-700" 
                      : "text-green-700"
                  }`}>
                    {entry.speaker}
                  </div>
                  <div className="text-gray-800 leading-relaxed">
                    {entry.text}
                  </div>
                </div>
              </div>
            ))}
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
            Transcript ID: {currentTranscript?.id}
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