'use client';
import HosSidebar from "@/components/Hospital/Sidebar";
import FormHeader from "@/components/Hospital/form/FormHeader";
import DoctorForm from "@/components/Hospital/form/DoctorForm";
import { useUser } from '@/data/UserContext';

export default function AddDoctorPage() {
    const { user } = useUser();
    
    // Determine if this is superadmin context
    const isSuperAdmin = user?.global_role?.role_name === 'superadmin';
    
    const handleSuccess = (result) => {
        console.log('✅ User created successfully:', result);
        // You can add navigation or other success handling here
        alert('User created successfully!');
    };
    
    const handleCancel = () => {
        console.log('❌ Form cancelled');
        // You can add navigation or other cancel handling here
    };

    return (
        <>
        <HosSidebar />
        <div className="flex h-screen bg-[#E6EEF8]">
            <div className="hidden lg:block h-full w-[17rem] flex-shrink-0">
                <HosSidebar />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                    <div className="p-6 pl-16 lg:pl-6 max-w-4xl mx-auto">
                        <FormHeader />
                        <DoctorForm 
                            context={isSuperAdmin ? 'superadmin' : 'hospital-admin'}
                            onSuccess={handleSuccess}
                            onCancel={handleCancel}
                        />
                    </div>
                </main>
            </div>
        </div>
        </>
    );
}