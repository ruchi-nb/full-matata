"use client";

import { usePathname, useRouter } from "next/navigation";
import { Building, Users, Stethoscope } from "lucide-react";

const navItems = [
  {
    name: "Admin Profile",
    icon: Users,
    path: "/Hospital/settings",
  },
  {
    name: "Hospital Details",
    icon: Building,
    path: "/Hospital/settings/hospital",
  },
  {
    name: "Specialities",
    icon: Stethoscope,
    path: "/Hospital/settings/specialities",
  },
];

export default function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.path;

        return (
          <button
            key={item.name}
            onClick={() => router.push(item.path)}
            className={`w-full cursor-pointer flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
              isActive
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "text-slate-700 hover:bg-stone-50"
            }`}
          >
            <item.icon
              className={`mr-3 h-5 w-5 ${
                isActive ? "text-blue-700" : "text-slate-400"
              }`}
              aria-hidden="true"
            />
            {item.name}
          </button>
        );
      })}
    </nav>
  );
}
