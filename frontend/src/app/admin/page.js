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
            <Sidebar />
            <div className="flex h-screen bg-stone-50">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                        <div className="w-full max-w-7xl mx-auto mt-8 py-6 px-4 sm:px-6 lg:px-8 xl:pl-56 xl:pr-16">
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
        