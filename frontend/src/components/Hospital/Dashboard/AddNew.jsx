'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus } from 'lucide-react';

const AddUserCard = () => {
  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md border border-blue-200 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center space-x-4 sm:space-x-6">
          {/* Icon */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg 
              className="w-6 h-6 sm:w-8 sm:h-8 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" 
              />
            </svg>
          </div>
          
          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">Add a User</h2>
            <p className="text-gray-600 text-sm sm:text-lg">
              <span className="text-[#004dd6]">AI-Powered:</span> Streamline hospital staff management with intelligent onboarding
            </p>
          </div>
        </div>
        
        {/* Button */}
        <Link href="/Hospital/addDoctor" passHref>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-colors duration-200 text-base sm:text-lg shadow-lg flex items-center justify-center gap-3"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add New User
          </motion.button>
        </Link>
      </div>
    </div>
  );
};

export default AddUserCard;