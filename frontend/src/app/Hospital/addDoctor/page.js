'use client';
import HosSidebar from "@/components/Hospital/Sidebar";
import FormHeader from "@/components/Hospital/form/FormHeader";
import DoctorForm from "@/components/Hospital/form/DoctorForm";
import { useUser } from '@/data/UserContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AddDoctorPage() {
    const { user } = useUser();
    const router = useRouter();
    const [showSuccess, setShowSuccess] = useState(false);
    const [createdUser, setCreatedUser] = useState(null);
    
    // Determine if this is superadmin context
    const isSuperAdmin = user?.global_role?.role_name === 'superadmin';
    
    const handleSuccess = (result) => {
        console.log('✅ User created successfully:', result);
        setCreatedUser(result);
        setShowSuccess(true);
        
        // Auto-redirect to dashboard after 2 seconds
        setTimeout(() => {
            router.push('/Hospital/doctor');
        }, 2000);
    };
    
    const handleCancel = () => {
        console.log('❌ Form cancelled');
        router.push('/Hospital/doctor');
    };

    const handleGoToDashboard = () => {
        router.push('/Hospital/doctor');
    };

    return (
        <div className="flex h-screen bg-[#E6EEF8]">
            <div className="h-full w-[17rem] flex-shrink-0">
                <HosSidebar />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                    <div className="p-6 max-w-4xl mx-auto">
                        <FormHeader />
                        
                        {/* Success Message */}
                        {showSuccess && createdUser && (
                            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-lg">✅ User Created Successfully!</h3>
                                        <p className="mt-1">
                                            {createdUser.username} has been added to the hospital with role: <strong>{createdUser.tenant_role}</strong>
                                        </p>
                                        <p className="text-sm mt-2 text-green-600">
                                            Redirecting to dashboard in 2 seconds...
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleGoToDashboard}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        Go to Dashboard
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <DoctorForm 
                            context={isSuperAdmin ? 'superadmin' : 'hospital-admin'}
                            onSuccess={handleSuccess}
                            onCancel={handleCancel}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}