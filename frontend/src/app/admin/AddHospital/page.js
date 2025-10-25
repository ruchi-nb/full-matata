'use client';
import AdminSidebar from "@/components/Admin/Sidebar";
import AddHospitalPage from "@/components/Admin/Management/AddHospitalPage";

export default function Page2() {
    return (
        <>
        <AdminSidebar />
        <div className="flex h-screen bg-[#fafaf9]">
        <div className="hidden lg:block h-full w-64 flex-shrink-0">
            <AdminSidebar />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                <div className="p-6 pl-16 lg:pl-6 max-w-4xl mx-auto">
                    <AddHospitalPage />
                </div>
            </main>
        </div>
        </div>
        </>
    );
}