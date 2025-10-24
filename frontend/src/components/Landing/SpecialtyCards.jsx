"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import GradientButton from "../common/GradientButton";
import LoginPopup from "@/components/Landing/LoginPopUp";

const Specialties = () => {
  const [selected, setSelected] = useState(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const modalRef = useRef(null);
  
  // Sample data for specialties
  const specialties = [
    {
      id: 1,
      title: "Pediatrics",
      icon: <i className="ri-parent-line text-4xl text-[var(--color-secondary)]"></i>,
      description: "Comprehensive healthcare for infants, children, and adolescents.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our pediatricians provide preventive care, treat childhood illnesses, and support healthy development from infancy through adolescence.",
      conditions: ["Growth Issues", "Common Colds", "Vaccinations", "Behavioral Concerns"]
    },
    {
      id: 2,
      title: "Cardiology",
      icon: <i className="ri-heart-2-fill text-4xl text-[var(--color-secondary)]"></i>,
      description: "Expert care for heart and cardiovascular conditions.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our cardiologists specialize in diagnosing and treating diseases of the heart and blood vessels, helping patients maintain cardiovascular health.",
      conditions: ["Heart Disease", "High Blood Pressure", "Arrhythmias", "Heart Failure"]
    },
    {
      id: 3,
      title: "Dermatology",
      icon: <i className="ri-microscope-line text-4xl text-[var(--color-secondary)]"></i>,
      description: "Skin, hair, and nail care from certified dermatologists.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our dermatologists diagnose and treat conditions affecting the skin, hair, and nails, providing both medical and cosmetic solutions.",
      conditions: ["Acne", "Eczema", "Psoriasis", "Skin Cancer"]
    },
    {
      id: 4,
      title: "Orthopedics",
      icon: <i className="ri-wheelchair-line text-4xl text-[var(--color-secondary)]"></i>,
      description: "Treatment for musculoskeletal injuries and conditions.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our orthopedic specialists focus on the diagnosis and treatment of disorders of the bones, joints, ligaments, tendons, and muscles.",
      conditions: ["Arthritis", "Fractures", "Sports Injuries", "Joint Pain"]
    },
    {
      id: 5,
      title: "Neurology",
      icon: <i className="ri-brain-line text-4xl text-[var(--color-secondary)]"></i>,
      description: "Expert care for brain and nervous system disorders.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our neurologists specialize in treating disorders of the nervous system, including the brain, spinal cord, nerves, and muscles.",
      conditions: ["Migraines", "Epilepsy", "Stroke", "Multiple Sclerosis"]
    },
    {
      id: 6,
      title: "Ophthalmology",
      icon: <i className="ri-eye-2-line text-4xl text-[var(--color-secondary)]"></i>,
      description: "Comprehensive eye care and vision services.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our ophthalmologists provide medical and surgical eye care, treating diseases and conditions affecting vision and eye health.",
      conditions: ["Cataracts", "Glaucoma", "Macular Degeneration", "Diabetic Retinopathy"]
    },
    {
      id: 7,
      title: "Psychiatry",
      icon: <i className="ri-mental-health-line text-4xl text-[var(--color-secondary)]"></i>,
      description: "Mental health care and psychological support.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our psychiatrists diagnose and treat mental health disorders through therapy, medication management, and other interventions.",
      conditions: ["Depression", "Anxiety", "Bipolar Disorder", "PTSD"]
    },
    {
      id: 8,
      title: "Endocrinology",
      icon: <i className="ri-flask-line text-4xl text-[var(--color-secondary)]"></i>,
      description: "Specialized care for hormone-related conditions.",
      gradient: "from-blue-400 to-blue-600",
      fullDescription: "Our endocrinologists specialize in treating disorders of the endocrine system, including diabetes, thyroid issues, and hormonal imbalances.",
      conditions: ["Diabetes", "Thyroid Disorders", "Osteoporosis", "Hormonal Imbalances"]
    }
  ];

  // Remove the old intersection observer code as we'll use StaggeredAnimationGroup

  // Handle modal close with animation
  const closeModal = () => {
    if (modalRef.current) {
      modalRef.current.classList.remove("scale-100", "opacity-100");
      modalRef.current.classList.add("scale-95", "opacity-0");
      
      setTimeout(() => {
        setSelected(null);
      }, 300);
    }
  };

  // Handle modal open with animation
  useEffect(() => {
    if (selected && modalRef.current) {
      setTimeout(() => {
        modalRef.current.classList.remove("scale-95", "opacity-0");
        modalRef.current.classList.add("scale-100", "opacity-100");
      }, 10);
    }
  }, [selected]);

  return (
    <section id="specialties" className="py-8 bg-gradient-to-b from-[#3d85c6] to-[#004dd6]     ">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="uppercase">Medical Specialties</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Expert Care in Every{" "}
            <span className="bg-gradient-to-r from-[#ffd166] to-[#eba80e] bg-clip-text text-transparent">
              Specialty
            </span>
          </h2>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Our network of board-certified specialists covers all major medical
            fields. Find the right expert for your specific health needs and get
            personalized care.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {specialties.map((s) => (
            <div
              key={s.id}
              className="group bg-white rounded-2xl p-6 shadow-md transition-all duration-300 cursor-pointer transform hover:-translate-y-2 hover:shadow-xl flex flex-col items-center text-center"
              onClick={() => setSelected(s)}
            >
              {/* Icon Container */}
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6 transition-all duration-300 group-hover:bg-blue-100 group-hover:scale-110">
                {s.icon}
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                {s.title}
              </h3>
              
              {/* Description */}
              <p className="text-gray-600 text-sm mb-4 flex-grow">{s.description}</p>
              
              {/* CTA Button */}
              <button className="text-blue-600 text-sm font-medium mt-auto group-hover:underline">
                Learn more
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 bg-opacity-50 transition-opacity duration-300"
            onClick={closeModal}
          ></div>
          <div
            ref={modalRef}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative z-10 transform transition-all duration-300 scale-95 opacity-0"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-3xl font-bold text-gray-900">{selected.title}</h2>
                <button
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                  onClick={closeModal}
                >
                  &times;
                </button>
              </div>
              <p className="text-gray-600 mb-6">{selected.fullDescription}</p>
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Common Conditions Treated:
                </h3>
                <ul className="grid grid-cols-2 gap-2 list-disc list-inside text-gray-600">
                  {selected.conditions.map((condition, index) => (
                    <li key={index} className="ml-4">{condition}</li>
                  ))}
                </ul>
              </div>
              <div className="flex space-x-4">
                <GradientButton 
                  className="font-medium transition-colors"
                  onClick={() => setIsLoginOpen(true)}
                >
                  Find Specialists
                </GradientButton>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <LoginPopup open={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </section>
  );
};

export default Specialties;