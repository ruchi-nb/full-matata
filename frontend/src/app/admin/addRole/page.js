'use client';
import HosSidebar from "@/components/Hospital/Sidebar";
import FormHeader from "@/components/Hospital/form/FormHeader";
import DoctorForm from "@/components/Hospital/form/DoctorForm";
import Footer from "@/components/Landing/Footer";

export default function Page2() {
    return (
        <div className="flex h-screen bg-[#fafaf9]">
        <div className="h-full w-64 shadow-xl flex-shrink-0">
            <HosSidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-x-hidden overflow-y-auto">
                <div className="p-6 max-w-4xl mx-auto">
                    <FormHeader />
                    <DoctorForm />
                </div>
                <Footer />
            </main>
        </div>
        </div>
  );
}