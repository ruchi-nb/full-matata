'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Plus } from 'lucide-react';

const AddUserCard = () => {
  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md border border-blue-200 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Icon */}
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-white" 
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
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Add a User</h2>
            <p className="text-gray-600 text-lg">
              <span className=" text-[#004dd6]">AI-Powered:</span> Streamline hospital staff management with intelligent onboarding
            </p>
          </div>
        </div>
        
        {/* Button */}
        <Link href="/Hospital/addDoctor" passHref>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-8 rounded-xl transition-colors duration-200 text-lg shadow-lg flex items-center gap-3"
          >
            <Plus className="w-5 h-5" />
            Add New User
          </motion.button>
        </Link>
      </div>
    </div>
  );
};

export default AddUserCard;