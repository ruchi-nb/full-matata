"use client";

import React from "react";
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  Users,
} from "lucide-react";
import Sidebar from "@/components/common/Sidebar";

const AdminSidebar = () => {
  const menuItems = [
    {
      id: "Dashboard",
      label: "Dashboard",
      path: "/admin",
      icon: <LayoutDashboard className="w-5 h-5 mr-3" />,
      sec: "HOME",
    },
    {
      id: "AddHospital",
      label: "Add Hospital",
      path: "/admin/AddHospital",
      icon: <UserPlus className="mr-3 h-5 w-5" />,
      sec: "ADD NEW",
    },
    {
      id: "AddRoles",
      label: "Add Users",
      path: "/admin/addDoctor",
      icon: <UserPlus className="mr-3 h-5 w-5" />,
      sec: "ADD NEW",
    },
    {
      id: "HospitalManagement",
      label: "Hospital Management",
      path: "/admin/management",
      icon: <Building2 className="w-5 h-5 mr-3" />,
      sec: "VIEW",
    },
  ];

  return <Sidebar items={menuItems} />;
};

export default AdminSidebar;
