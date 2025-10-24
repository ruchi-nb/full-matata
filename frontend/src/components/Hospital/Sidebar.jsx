"use client";

import React from "react";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  CreditCard,
  Settings,
  FileText,
} from "lucide-react";
import Sidebar from "@/components/common/Sidebar";

const HospitalSidebar = () => {
  const menuItems = [
    {
      id: "Dashboard",
      label: "Dashboard",
      path: "/Hospital",
      icon: <LayoutDashboard className="mr-3 h-5 w-5" />,
      sec: "HOME",
    },
    {
      id: "AddUsers",
      label: "Add Users",
      path: "/Hospital/addDoctor",
      icon: <UserPlus className="mr-3 h-5 w-5" />,
      sec: "ADD NEW",
    },
    {
      id: "AddRoles",
      label: "Add Roles",
      path: "/Hospital/createRole",
      icon: <UserPlus className="mr-3 h-5 w-5" />,
      sec: "ADD NEW",
    },
    {
      id: "MyUsers",
      label: "My Users",
      path: "/Hospital/doctor",
      icon: <Users className="mr-3 h-5 w-5" />,
      sec: "VIEW",
    },
    {
      id: "MyRoles",
      label: "My Roles",
      path: "/Hospital/roles", // Fixed: This should probably point to a roles page
      icon: <Users className="mr-3 h-5 w-5" />,
      sec: "VIEW",
    },
    {
      id: "Transcripts",
      label: "Transcripts",
      path: "/Hospital/transcripts",
      icon: <FileText className="mr-3 h-5 w-5" />,
      sec: "VIEW"
    },
    {
      id: "MyPlan",
      label: "My Plan",
      path: "/common/commingsoon",
      icon: <CreditCard className="mr-3 h-5 w-5" />,
      sec: "VIEW"
    },
    {
      id: "Settings",
      label: "Settings",
      path: "/Hospital/settings",
      icon: <Settings className="mr-3 h-5 w-5" />,
      sec: "SETTINGS"
    },
  ];

  return <Sidebar items={menuItems} />;
};

export default HospitalSidebar;