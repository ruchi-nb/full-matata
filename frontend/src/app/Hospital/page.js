import HosSidebar from "@/components/Hospital/Sidebar";
import DashboardHeader from'@/components/Hospital/Dashboard/DashHeader';
import SubscriptionOverview from '@/components/Hospital/Dashboard/SubsOverview';
import Dashboard from "@/components/Hospital/Dashboard/Summary";
import AddUserCard from "@/components/Hospital/Dashboard/AddNew";

export default function Navbar(){
    return(
        <>
        <HosSidebar />
        <div className="flex h-screen bg-[#e6eef8]">
            <div className="hidden lg:block h-full w-[17rem] flex-shrink-0">
                <HosSidebar />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                    <div className="relative z-10 p-6 pl-16 lg:pl-6 max-w-7xl mx-auto">
                        <div className="mb-6 sm:mb-8"><DashboardHeader /></div>
                        <div className="mb-6 sm:mb-8"><AddUserCard /></div>
                        <div className="mb-6 sm:mb-8"><SubscriptionOverview /></div>
                        <div className="mb-6 sm:mb-8"><Dashboard /></div>
                    </div>
                </main>
            </div>
        </div>
        </>
    );
}