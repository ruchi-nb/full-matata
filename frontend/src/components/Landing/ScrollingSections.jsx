"use client";

import { useEffect, useRef } from "react";
import { Shield, Star, Quote, Sparkles} from "lucide-react";
import { StaggeredAnimationGroup } from "../common/animations";

const ScrollingSections = () => {
  const hospitalsScrollRef = useRef(null);
  const testimonialsScrollRef = useRef(null);

  // Real-life hospital names for more authenticity
  const hospitals = [
    "Apollo Hospitals",
    "Fortis Healthcare", 
    "Max Healthcare",
    "Manipal Hospitals",
    "Narayana Health",
    "Medanta Hospitals",
    "AIIMS Delhi",
    "Tata Memorial Hospital",
    "Christian Medical College",
    "Kokilaben Dhirubhai Ambani Hospital",
    "Sankara Eye Care",
    "Wockhardt Hospitals",
    "Columbia Asia Hospitals",
    "Global Hospitals",
    "Rainbow Children's Hospital"
  ];

  const testimonials = [
    {
      id: 1,
      name: "Priya Sharma",
      location: "Mumbai, Maharashtra",
      rating: 5,
      text: "The AI-powered consultation was incredibly helpful. I got instant answers to my health concerns and the doctor follow-up was seamless.",
      avatar: "PS",
      specialty: "Cardiology Consultation"
    },
    {
      id: 2,
      name: "Rajesh Kumar",
      location: "Delhi, NCR",
      rating: 5,
      text: "Amazing platform! The transcript feature helped me keep track of my entire consultation. Highly recommended for busy professionals.",
      avatar: "RK",
      specialty: "General Medicine"
    },
    {
      id: 3,
      name: "Anita Patel",
      location: "Ahmedabad, Gujarat",
      rating: 5,
      text: "The specialist matching was spot-on. I found the perfect cardiologist in my area within minutes. The whole process was so smooth.",
      avatar: "AP",
      specialty: "Cardiology"
    },
    {
      id: 4,
      name: "Suresh Reddy",
      location: "Hyderabad, Telangana",
      rating: 5,
      text: "As a senior citizen, I found the platform very user-friendly. The AI assistant was patient and thorough in explaining everything.",
      avatar: "SR",
      specialty: "Geriatric Care"
    },
    {
      id: 5,
      name: "Meera Singh",
      location: "Bangalore, Karnataka",
      rating: 5,
      text: "The consultation quality was excellent. The doctor was knowledgeable and the AI pre-screening saved so much time.",
      avatar: "MS",
      specialty: "Pediatrics"
    },
    {
      id: 6,
      name: "Vikram Joshi",
      location: "Pune, Maharashtra",
      rating: 5,
      text: "Fantastic experience! The platform connected me with top specialists and the follow-up care was exceptional.",
      avatar: "VJ",
      specialty: "Orthopedics"
    }
  ];

  // Infinite scroll for hospitals
  useEffect(() => {
    const scrollContainer = hospitalsScrollRef.current;
    if (!scrollContainer) return;

    let animationId;
    let scrollPosition = 0;
    const scrollSpeed = 0.5;

    const animate = () => {
      scrollPosition += scrollSpeed;
      
      // Reset position when we've scrolled through one complete cycle
      if (scrollPosition >= scrollContainer.scrollWidth / 2) {
        scrollPosition = 0;
      }
      
      scrollContainer.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(animate);
    };

    // Start animation
    animationId = requestAnimationFrame(animate);

    // Pause on hover
    const handleMouseEnter = () => {
      cancelAnimationFrame(animationId);
    };

    const handleMouseLeave = () => {
      animationId = requestAnimationFrame(animate);
    };

    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Infinite scroll for testimonials
  useEffect(() => {
    const scrollContainer = testimonialsScrollRef.current;
    if (!scrollContainer) return;

    let animationId;
    let scrollPosition = 0;
    const scrollSpeed = 0.3;

    const animate = () => {
      scrollPosition += scrollSpeed;
      
      // Reset position when we've scrolled through one complete cycle
      if (scrollPosition >= scrollContainer.scrollWidth / 2) {
        scrollPosition = 0;
      }
      
      scrollContainer.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(animate);
    };

    // Start animation
    animationId = requestAnimationFrame(animate);

    // Pause on hover
    const handleMouseEnter = () => {
      cancelAnimationFrame(animationId);
    };

    const handleMouseLeave = () => {
      animationId = requestAnimationFrame(animate);
    };

    scrollContainer.addEventListener('mouseenter', handleMouseEnter);
    scrollContainer.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      scrollContainer.removeEventListener('mouseenter', handleMouseEnter);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <>
      {/* Leading Healthcare Institutions Section */}
      <section className="py-16 bg-[#004dd6] relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="uppercase">Trusted Partners</span>
          </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Leading Healthcare{" "}
              <span className="bg-gradient-to-r from-[#ffd166] to-[#eba80e] bg-clip-text text-transparent">
                Institutions
              </span>
            </h2>
            <p className="text-xl text-gray-800 max-w-3xl mx-auto">
              Partnered with India's top healthcare providers to deliver excellence in patient care.
            </p>
          </div>

          {/* Infinite Scrolling Hospitals */}
          <div className="relative overflow-hidden">
            <div
              ref={hospitalsScrollRef}
              className="flex space-x-8 py-8 overflow-x-auto hide-scrollbar"
              style={{
                width: '200%'
              }}
            >
              {/* First set of hospitals */}
              {hospitals.map((hospital, index) => (
                <div
                  key={`first-${index}`}
                  className="flex-shrink-0 flex items-center space-x-3 bg-white rounded-xl px-6 py-4 shadow-md hover:shadow-lg transition-all duration-300 min-w-[280px]"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{hospital}</h3>
                    <p className="text-sm text-gray-500">Healthcare Partner</p>
                  </div>
                </div>
              ))}
              
              {/* Duplicate set for seamless loop */}
              {hospitals.map((hospital, index) => (
                <div
                  key={`second-${index}`}
                  className="flex-shrink-0 flex items-center space-x-3 bg-white rounded-xl px-6 py-4 shadow-md hover:shadow-lg transition-all duration-300 min-w-[280px]"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{hospital}</h3>
                    <p className="text-sm text-gray-500">Healthcare Partner</p>
                  </div>
                </div>
              ))}
            </div>
            
          </div>
        </div>
      </section>

      {/* Customer Testimonials Section */}
      <section className="py-16 bg-[#004dd6]">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="uppercase">Customer Stories</span>
          </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              What Our{" "}
              <span className="bg-gradient-to-r from-[#ffd166] to-[#eba80e] bg-clip-text text-transparent">
                Customers Say
              </span>
            </h2>
            <p className="text-xl text-gray-800 max-w-3xl mx-auto">
              Real experiences from patients who have transformed their healthcare journey with our platform.
            </p>
          </div>

          {/* Infinite Scrolling Testimonials */}
          <div className="relative overflow-hidden mb-12">
            <div
              ref={testimonialsScrollRef}
              className="flex space-x-6 py-4 overflow-x-auto hide-scrollbar"
              style={{
                width: '200%'
              }}
            >
              {/* First set of testimonials */}
              {testimonials.map((testimonial) => (
                <div
                  key={`first-${testimonial.id}`}
                  className="flex-shrink-0 bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 min-w-[350px] max-w-[400px] border border-gray-100"
                >
                  {/* Fake Testimonial Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                        <p className="text-sm text-gray-500">{testimonial.location}</p>
                      </div>
                    </div>
                    <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                      FAKE TESTIMONIAL
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <div className="relative">
                    <Quote className="w-6 h-6 text-gray-300 absolute -top-2 -left-2" />
                    <p className="text-gray-700 text-sm leading-relaxed pl-4">
                      "{testimonial.text}"
                    </p>
                  </div>

                  {/* Specialty */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      {testimonial.specialty}
                    </span>
                  </div>
                </div>
              ))}
              
              {/* Duplicate set for seamless loop */}
              {testimonials.map((testimonial) => (
                <div
                  key={`second-${testimonial.id}`}
                  className="flex-shrink-0 bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 min-w-[350px] max-w-[400px] border border-gray-100"
                >
                  {/* Fake Testimonial Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                        <p className="text-sm text-gray-500">{testimonial.location}</p>
                      </div>
                    </div>
                    <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                      FAKE TESTIMONIAL
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <div className="relative">
                    <Quote className="w-6 h-6 text-gray-300 absolute -top-2 -left-2" />
                    <p className="text-gray-700 text-sm leading-relaxed pl-4">
                      "{testimonial.text}"
                    </p>
                  </div>

                  {/* Specialty */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      {testimonial.specialty}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
          </div>
        </div>
      </section>
    </>
  );
};

export default ScrollingSections;
