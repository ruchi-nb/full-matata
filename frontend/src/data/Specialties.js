// file: src/components/PatientPortal/home/data/Specialties.js
export const specialties = {
  Cardiology: {
    description: "Heart and cardiovascular health",
    longDescription: "Cardiology is the branch of medicine that deals with the heart and blood vessels (the cardiovascular system). It focuses on the structure, function, and diseases of the heart—as well as the network of arteries, veins, and capillaries that carry blood throughout the body. At its core, cardiology is about understanding how the heart works as a muscular pump. This pump keeps blood circulating, supplying oxygen and nutrients to tissues and organs while removing waste products. Any disruption in this system—whether from blocked arteries, weakened heart muscle, abnormal rhythms, or valve problems—can lead to cardiovascular disease, which is the leading cause of death worldwide.",
    doctors: [
      { id: "emily-chen", name: "Dr. Emily Chen", role: "Senior Cardiologist", experience: "12 years", active: true, img: "/images/woman(3).png" },
      { id: "dr-tsunade", name: "Dr. Tsunade Senju", role: "Cardiac Surgeon", experience: "30 years", active: true, img: "/images/woman(5).png" }
    ],
    image: "/images/easter/bag.png",
    commonConditions: ["Hypertension", "Coronary Artery Disease", "Heart Failure", "Arrhythmias", "Valvular Heart Disease"],
    procedures: ["Echocardiogram", "Cardiac Catheterization", "Angioplasty", "Pacemaker Implantation", "Bypass Surgery"]
  },
  Dermatology: {
    description: "Skin, hair, and nail care",
    longDescription: "Dermatology is the branch of medicine that focuses on the study, diagnosis, treatment, and prevention of conditions related to the skin, hair, nails, and mucous membranes. Because the skin is the body's largest organ and serves as the first line of defense against infections, injuries, and environmental factors, dermatology plays a crucial role in maintaining overall health as well as appearance. A dermatologist is a medical doctor trained to identify and manage a wide range of issues, from common concerns such as acne, eczema, and psoriasis to more complex diseases like autoimmune skin disorders, rare genetic conditions, and skin cancers such as melanoma.",
    doctors: [
      { id: "michaek-rodriguez", name: "Dr. Michael Rodriguez", role: "Senior Dermatologist", experience: "15 years", active: true, img: "/images/man(2).png" }
    ],
    image: "/images/easter/bald.png",
    commonConditions: ["Acne", "Eczema", "Psoriasis", "Skin Cancer", "Rosacea", "Hair Loss"],
    procedures: ["Skin Biopsy", "Cryotherapy", "Laser Treatment", "Chemical Peels", "Mohs Surgery"]
  },
  GeneralMedicine: {
    description: "Primary healthcare and wellness",
    longDescription: "General medicine—also known as internal medicine in many regions—is one of the broadest and most foundational fields of medicine. It is focused on the comprehensive care of adult patients, addressing everything from routine health maintenance to the management of complex, chronic, or undiagnosed conditions. Unlike specialties that concentrate on a particular organ system (such as cardiology or neurology), general medicine takes a whole-body, whole-person approach to health care.",
    doctors: [
      { id: "james-wilson", name: "Dr. James Wilson", role: "General Physician", experience: "8 years", active: true, img: "/images/man(1).png" },
      { id: "tony-chopper", name: "Dr. Tony Chopper", role: "General Practitioner", experience: "7 years", active: true, img: "/images/man(5).png" },
      { id: "dr-kureha", name: "Dr. Kureha", role: "Senior General Physician", experience: "50+ years", active: true, img: "/images/woman(4).png" }
    ],
    image: "/images/general-medicine.png",
    commonConditions: ["Hypertension", "Diabetes", "Respiratory Infections", "Gastrointestinal Issues", "Chronic Pain"],
    procedures: ["Physical Examination", "Vaccinations", "Health Screenings", "Chronic Disease Management", "Preventive Care"]
  },
  Pediatrics: {
    description: "Healthcare for children and adolescents",
    longDescription: "Pediatrics is the branch of medicine that focuses on the health and medical care of infants, children, and adolescents, typically from birth up to 18 years of age (sometimes extending into the early 20s depending on the healthcare system). It is a specialty that not only deals with diagnosing and treating illnesses in young patients, but also emphasizes preventive health, growth and development monitoring, and guidance for parents and families. Unlike adult medicine, pediatrics requires a unique approach because children are not just 'small adults.' Their bodies are developing, their immune systems are still maturing, and their physical, emotional, and cognitive needs differ significantly from those of adults.",
    doctors: [
      { id: "sarah-johnson", name: "Dr. Sarah Johnson", role: "Pediatrician", experience: "10 years", active: true, img: "/images/woman(1).png" },
      { id: "dr-hiluluk", name: "Dr. Hiluluk", role: "Community Pediatrician", experience: "20 years", active: true, img: "/images/man(6).png" }
    ],
    image: "/images/pediatrics.png",
    commonConditions: ["Childhood Infections", "Developmental Disorders", "Asthma", "Allergies", "Behavioral Issues"],
    procedures: ["Well-Child Visits", "Vaccinations", "Developmental Screening", "Growth Monitoring", "Parent Education"]
  },
  Orthopedics: {
    description: "Bone, joint, and muscle care",
    longDescription: "Orthopedics (sometimes spelled orthopaedics) is a medical specialty focused on the diagnosis, treatment, prevention, and rehabilitation of conditions that affect the musculoskeletal system. This system is made up of your bones, joints, ligaments, tendons, muscles, and nerves, all of which work together to support your body, allow movement, and protect vital organs.",
    doctors: [
      { id: "tarun-singh", name: "Dr. Tarun Singh", role: "Orthopedic Surgeon", experience: "18 years", active: true, img: "/images/man(3).png" }
    ],
    image: "/images/orthopedics.png",
    commonConditions: ["Arthritis", "Fractures", "Tendinitis", "Back Pain", "Sports Injuries"],
    procedures: ["Joint Replacement", "Arthroscopy", "Fracture Repair", "Spinal Surgery", "Physical Therapy"]
  },
  Neurology: {
    description: "Brain and nervous system care",
    longDescription: "Neurology is the branch of medicine that focuses on the study, diagnosis, and treatment of disorders that affect the nervous system, which includes the brain, spinal cord, and an extensive network of nerves throughout the body. This system is essentially the body's command center—it regulates everything from movement, sensation, and thought, to memory, speech, emotions, and vital functions like breathing and heart rate.",
    doctors: [
      { id: "devangi-patel", name: "Dr. Devangi Patel", role: "Neurologist", experience: "14 years", active: true, img: "/images/woman.png" },
      { id: "dr-senku", name: "Dr. Senku Ishigami", role: "Neurology Researcher", experience: "10 years", active: true, img: "/images/man(8).png" }
    ],
    image: "/images/easter/skull.png",
    commonConditions: ["Migraines", "Epilepsy", "Stroke", "Parkinson's Disease", "Multiple Sclerosis"],
    procedures: ["EEG", "EMG", "Nerve Conduction Studies", "Lumbar Puncture", "Neuroimaging Interpretation"]
  },
  Oncology: {
    description: "Cancer diagnosis and treatment",
    longDescription: "Oncology is the branch of medicine dedicated to the study, diagnosis, treatment, and prevention of cancer. It encompasses a wide range of approaches to manage this complex group of diseases characterized by uncontrolled cell growth. Medical oncologists work with a multidisciplinary team to provide comprehensive cancer care, from initial diagnosis through treatment and survivorship.",
    doctors: [
      { id: "kshitij-mehta", name: "Dr. Kshitij Mehta", role: "Oncologist", experience: "16 years", active: true, img: "/images/man(4).png" }
    ],
    image: "/images/easter/vampire.png",
    commonConditions: ["Breast Cancer", "Lung Cancer", "Prostate Cancer", "Colon Cancer", "Leukemia"],
    procedures: ["Chemotherapy", "Radiation Therapy", "Immunotherapy", "Targeted Therapy", "Palliative Care"]
  },
  Psychiatry: {
    description: "Mental health and behavioral disorders",
    longDescription: "Psychiatry is the medical specialty devoted to the diagnosis, prevention, and treatment of mental disorders. These include various maladaptations related to mood, behavior, cognition, and perceptions. Psychiatrists are medical doctors who evaluate patients to determine whether their symptoms are the result of a physical illness, a combination of physical and mental ailments, or strictly psychiatric.",
    doctors: [
      { id: "veena-gupta", name: "Dr. Veena Gupta", role: "Psychiatrist", experience: "13 years", active: true, img: "/images/woman(2).png" },
      { id: "dr-stein", name: "Dr. Franken Stein", role: "Psychiatric Specialist", experience: "18 years", active: true, img: "/images/man(7).png" }
    ],
    image: "/images/psychiatry.png",
    commonConditions: ["Depression", "Anxiety Disorders", "Bipolar Disorder", "Schizophrenia", "PTSD"],
    procedures: ["Psychotherapy", "Medication Management", "Cognitive Behavioral Therapy", "Crisis Intervention", "Psychological Testing"]
  }
};