import AdminLayout from "./layout";
import Sidebar from "@/components/Admin/Sidebar";
import DashboardHeader from "@/components/Admin/Dashboard/DashHeader";
import Overview from "@/components/Admin/Dashboard/Overview";
import HospitalList from "@/components/Admin/Dashboard/HospitalList";
import { UserProvider } from "@/data/UserContext";

export default function adminDashPage(){
    return(
    <UserProvider>
        <AdminLayout>
            <div className="flex h-screen bg-stone-50">
                <div className="h-full w-64 flex-shrink-0">
                    <Sidebar />
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                        <div className="p-6 max-w-7xl mx-auto">
                            <DashboardHeader />
                            <Overview />
                            <HospitalList />
                        </div>
                    </main>
                </div>
            </div>
        </AdminLayout>
    </UserProvider>
    );
}
        