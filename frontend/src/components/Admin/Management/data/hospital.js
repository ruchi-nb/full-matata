const hospitals = [
    {
      id: 1,
      name: "Sunrise IVF Clinic",
      specialty: "Fertility & IVF",
      email: "info@sunriseivf.com",
      location: "Mumbai, Maharashtra",
      phone: "+91 98765 43210",
      status: "Active",
      color: "bg-blue-500",
  
      doctorsData: [
        {
          name: "Dr. Rajesh Mehta",
          role: "Senior Consultant",
          specialty: "IVF & Fertility",
          experience: "15 years",
          avatarStatus: "Live",
          consultations: 156,
        },
        {
          name: "Dr. Priya Rao",
          role: "Consultant",
          specialty: "Gynecology",
          experience: "8 years",
          avatarStatus: "Training",
          consultations: 89,
        },
        {
          name: "Dr. Amit Sharma",
          role: "Associate",
          specialty: "Embryology",
          experience: "5 years",
          avatarStatus: "Live",
          consultations: 67,
        },
      ],
  
      specialties: [
        { name: "IVF & Fertility", doctors: 10, consultations: 245 },
        { name: "Gynecology", doctors: 5, consultations: 156 },
        { name: "Embryology", doctors: 3, consultations: 89 },
      ],
  
      stats: [
        { value: 18, label: "Total Doctors", bg: "#eff6ff", color: "#3b82f6" },
        { value: 245, label: "Total Consultations", bg: "#f0fdf4", color: "#10b981" },
        { value: 15, label: "Active Avatars", bg: "#fef3c7", color: "#f59e0b" },
      ],
    },
  
    {
      id: 2,
      name: "Nova HealthCare",
      specialty: "Multi-specialty",
      email: "contact@novahealth.in",
      location: "Bengaluru, Karnataka",
      phone: "+91 87654 32109",
      status: "Inactive",
      color: "bg-blue-500",
  
      doctorsData: [
        {
          name: "Dr. Kavita Nair",
          role: "General Physician",
          specialty: "Internal Medicine",
          experience: "10 years",
          avatarStatus: "Live",
          consultations: 120,
        },
        {
          name: "Dr. Sameer Joshi",
          role: "Consultant",
          specialty: "Cardiology",
          experience: "12 years",
          avatarStatus: "Inactive",
          consultations: 36,
        },
      ],
  
      specialties: [
        { name: "Internal Medicine", doctors: 6, consultations: 95 },
        { name: "Cardiology", doctors: 3, consultations: 61 },
        { name: "Orthopedics", doctors: 3, consultations: 50 },
      ],
  
      stats: [
        { value: 12, label: "Total Doctors", bg: "#eff6ff", color: "#3b82f6" },
        { value: 156, label: "Total Consultations", bg: "#f0fdf4", color: "#10b981" },
        { value: 8, label: "Active Avatars", bg: "#fef3c7", color: "#f59e0b" },
      ],
    },
  
    {
      id: 3,
      name: "Metro Hospital",
      specialty: "General Hospital",
      email: "metrocare@gmail.com",
      location: "Delhi, NCR",
      phone: "+91 76543 21098",
      status: "Active",
      color: "bg-blue-500",
  
      doctorsData: [
        {
          name: "Dr. Anjali Kapoor",
          role: "Chief Surgeon",
          specialty: "General Surgery",
          experience: "20 years",
          avatarStatus: "Live",
          consultations: 200,
        },
        {
          name: "Dr. Manish Verma",
          role: "Consultant",
          specialty: "Orthopedics",
          experience: "14 years",
          avatarStatus: "Live",
          consultations: 70,
        },
        {
          name: "Dr. Ritu Malhotra",
          role: "Pediatrician",
          specialty: "Pediatrics",
          experience: "9 years",
          avatarStatus: "Training",
          consultations: 50,
        },
      ],
  
      specialties: [
        { name: "General Surgery", doctors: 7, consultations: 120 },
        { name: "Orthopedics", doctors: 6, consultations: 100 },
        { name: "Pediatrics", doctors: 5, consultations: 100 },
        { name: "Emergency Care", doctors: 7, consultations: 120 },
      ],
  
      stats: [
        { value: 25, label: "Total Doctors", bg: "#eff6ff", color: "#3b82f6" },
        { value: 320, label: "Total Consultations", bg: "#f0fdf4", color: "#10b981" },
        { value: 20, label: "Active Avatars", bg: "#fef3c7", color: "#f59e0b" },
      ],
    },
  
    {
      id: 4,
      name: "City Care Medical",
      specialty: "Emergency Care",
      email: "info@citycare.com",
      location: "Chennai, Tamil Nadu",
      phone: "+91 65432 10987",
      status: "Active",
      color: "bg-blue-500",
  
      doctorsData: [
        {
          name: "Dr. Arjun Reddy",
          role: "Emergency Head",
          specialty: "Emergency Medicine",
          experience: "18 years",
          avatarStatus: "Live",
          consultations: 130,
        },
        {
          name: "Dr. Neha Krishnan",
          role: "Consultant",
          specialty: "Critical Care",
          experience: "11 years",
          avatarStatus: "Live",
          consultations: 59,
        },
      ],
  
      specialties: [
        { name: "Emergency Medicine", doctors: 6, consultations: 120 },
        { name: "Critical Care", doctors: 5, consultations: 69 },
        { name: "Trauma Care", doctors: 4, consultations: 60 },
      ],
  
      stats: [
        { value: 15, label: "Total Doctors", bg: "#eff6ff", color: "#3b82f6" },
        { value: 189, label: "Total Consultations", bg: "#f0fdf4", color: "#10b981" },
        { value: 12, label: "Active Avatars", bg: "#fef3c7", color: "#f59e0b" },
      ],
    },
  
    {
      id: 5,
      name: "Wellness Hospital",
      specialty: "Wellness & Preventive",
      email: "contact@wellness.in",
      location: "Pune, Maharashtra",
      phone: "+91 54321 09876",
      status: "Active",
      color: "bg-blue-500",
  
      doctorsData: [
        {
          name: "Dr. Sneha Kulkarni",
          role: "Nutritionist",
          specialty: "Dietetics",
          experience: "10 years",
          avatarStatus: "Live",
          consultations: 150,
        },
        {
          name: "Dr. Vikram Desai",
          role: "Physiotherapist",
          specialty: "Physiotherapy",
          experience: "12 years",
          avatarStatus: "Live",
          consultations: 80,
        },
        {
          name: "Dr. Anaya Joshi",
          role: "Consultant",
          specialty: "Preventive Medicine",
          experience: "9 years",
          avatarStatus: "Training",
          consultations: 37,
        },
      ],
  
      specialties: [
        { name: "Preventive Medicine", doctors: 6, consultations: 120 },
        { name: "Nutrition & Dietetics", doctors: 7, consultations: 90 },
        { name: "Physiotherapy", doctors: 7, consultations: 57 },
      ],
  
      stats: [
        { value: 20, label: "Total Doctors", bg: "#eff6ff", color: "#3b82f6" },
        { value: 267, label: "Total Consultations", bg: "#f0fdf4", color: "#10b981" },
        { value: 15, label: "Active Avatars", bg: "#fef3c7", color: "#f59e0b" },
      ],
    },
  ];
  
  export default hospitals;
  