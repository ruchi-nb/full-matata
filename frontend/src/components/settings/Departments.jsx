"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

export default function Departments() {
  const [departments, setDepartments] = useState([
    "Emergency Department",
    "Cardiology",
    "Neurology",
    "Pediatrics",
    "Surgery",
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddDepartment = (event) => {
    event.preventDefault();
    const form = event.target;
    const newDept = form.department.value.trim();
    if (newDept) {
      setDepartments([...departments, newDept]);
      setIsModalOpen(false);
      form.reset();
    }
  };

  const handleDelete = (idx) => {
    setDepartments(departments.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Hospital Departments
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 cursor-pointer text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors font-medium flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Department</span>
        </button>
      </div>

      {/* Department Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-200"
          >
            <span className="font-medium text-slate-900">{dept}</span>
            <button
              onClick={() => handleDelete(idx)}
              className="p-1 cursor-pointer text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute cursor-pointer top-3 right-3 text-slate-500 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Add Department
            </h3>

            <form onSubmit={handleAddDepartment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Department Name
                </label>
                <input
                  name="department"
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter department name"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 cursor-pointer rounded-lg border border-stone-300 text-slate-700 hover:bg-red-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 cursor-pointer rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                >
                  Add Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
