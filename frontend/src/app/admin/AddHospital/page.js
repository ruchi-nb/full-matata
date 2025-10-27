'use client';
import AdminSidebar from "@/components/Admin/Sidebar";
import AddHospitalPage from "@/components/Admin/Management/AddHospitalPage";

export default function Page2() {
    return (
        <>
        <AdminSidebar />
        <div className="flex h-screen bg-[#fafaf9]">
        <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                <div className="w-full max-w-7xl mx-auto mt-4 py-6 px-4 sm:px-6 lg:px-8 xl:pl-56 xl:pr-16">
                    <AddHospitalPage />
                </div>
            </main>
        </div>
        </div>
        </>
    );
}