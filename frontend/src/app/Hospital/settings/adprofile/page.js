import HosSidebar from "@/components/Hospital/Sidebar"; 
import SettingsHead from "@/components/settings/SettingHead";
import SidebarNav from "@/components/settings/SidebarNav";
import Profile from "@/components/settings/Profile";

export default function Navbar(){
    return(
        <div className="flex h-screen bg-[#E6EEF8]">
            <div className="h-full w-[17rem] flex-shrink-0">
                <HosSidebar />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-x-hidden overflow-y-auto ">
                    <div className="p-6 max-w-7xl mx-auto">
                        <SettingsHead />
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="lg:w-64 flex-shrink-0">
                                <SidebarNav />
                            </div>
                            <div className="flex-1">
                                <Profile />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}