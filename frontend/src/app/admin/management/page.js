import AdminLayout from "../layout";
import Sidebar from "@/components/Admin/Sidebar";
import HospitalCards from "@/components/Admin/Management/HospitalCards";
import AddHospitalModal from "@/components/Admin/Management/ManageHeader"; 

export default function managePage(){
    return(
        <AdminLayout>
            <Sidebar />
            <div className="flex h-screen bg-[#fafaf9]">
                <div className="hidden lg:block h-full w-64 shadow-xl flex-shrink-0">
                    <Sidebar />
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                        <div className="p-6 pl-16 lg:pl-6 max-w-7xl mx-auto">
                            <AddHospitalModal />
                            <HospitalCards />
                        </div>
                    </main>
                </div>
            </div>
        </AdminLayout>
    );
}
        