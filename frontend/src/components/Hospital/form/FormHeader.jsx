'use client';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FormHeader() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/Hospital/doctor');
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 sm:mb-8">
        <button 
        onClick={handleBack}
        className="p-2 text-zinc-800 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors w-fit">
          <ArrowLeft className="h-5 w-5" />
        </button>
      <div className="flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Add New User</h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          Create a new user and assign role-based details
        </p>
      </div>
    </div>
  );
}