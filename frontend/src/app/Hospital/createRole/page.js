'use client';
import { useRouter } from 'next/navigation';
import HosSidebar from "@/components/Hospital/Sidebar";
import { ScaleIn, FadeIn } from "@/components/common/animations";
import CustomRoleForm from "@/components/Hospital/form/CustomRoleForm";

export default function Page() {
    const router = useRouter();

    const handleSuccess = (role) => {
        console.log('✅ Role created successfully:', role);
        
        // Show success message
        alert(`Role "${role.role_name}" has been created and saved to the database successfully!`);
        
        // Navigate back to roles management page
        router.push('/Hospital/roles');
    };

    const handleCancel = () => {
        console.log('❌ Role creation cancelled by user');
        
        // Navigate back to roles management page
        router.push('/Hospital/roles');
    };

    return (
        <div className="flex h-screen bg-[#E6EEF8]">
            <div className="h-full w-[17rem] flex-shrink-0">
                <FadeIn direction="left" duration={0.8} delay={0.2} speed={1}>
                    <ScaleIn direction="left" duration={0.8} delay={0.4} speed={1}>
                        <HosSidebar />
                    </ScaleIn>
                </FadeIn>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    <div className="p-6 max-w-4xl mx-auto">
                        <CustomRoleForm 
                            onSuccess={handleSuccess}
                            onCancel={handleCancel}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}