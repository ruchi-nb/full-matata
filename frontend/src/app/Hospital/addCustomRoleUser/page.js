'use client';
import HosSidebar from "@/components/Hospital/Sidebar";
import FormHeader from "@/components/Hospital/form/FormHeader";
import CustomRoleForm from "@/components/Hospital/form/CustomRoleForm";
import HospitalProtectedRoute from "@/components/Hospital/HospitalProtectedRoute";
import { ScaleIn, FadeIn } from "@/components/common/animations";

export default function AddCustomRoleUserPage() {
    return (
        <HospitalProtectedRoute>
        <div className="flex h-screen bg-[#E6EEF8]">
        <div className="h-full w-[17rem] flex-shrink-0">
        <FadeIn direction="left" duration={0.8} delay={0.2} speed={1}>
          <ScaleIn direction="left" duration={0.8} delay={0.4} speed={1}>
            <HosSidebar />
          </ScaleIn>
        </FadeIn>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                <div className="p-6 max-w-4xl mx-auto">
                <FadeIn direction="up" duration={0.8} delay={0.2} speed={1}>
                  <ScaleIn direction="up" duration={0.8} delay={0.4} speed={1}>
                    <FormHeader />
                  </ScaleIn>
                </FadeIn>
                <FadeIn direction="up" duration={0.8} delay={0.4} speed={1}>
                  <ScaleIn direction="up" duration={0.8} delay={0.6} speed={1}>
                    <CustomRoleForm />
                  </ScaleIn>
                </FadeIn>
                </div>
            </main>
        </div>
        </div>
        </HospitalProtectedRoute>
  );
}
