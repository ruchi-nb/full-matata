// file: src/data/patients.js
import { transcripts } from './transcripts';

export const patients = [
  {
    id: 1,
    name: "Sarah Johnson",
    specialty: "Cardiology",
    reason: "Chest pain evaluation",
    date: "2024-01-10",
    time: "10:30 AM",
    transcriptCount: 2,
    transcripts: transcripts[1] || []
  },
  {
    id: 2,
    name: "Michael Chen",
    specialty: "Dermatology",
    reason: "Skin rash",
    date: "2024-01-11",
    time: "2:15 PM",
    transcriptCount: 1,
    transcripts: transcripts[2] || []
  },
  {
    id: 3,
    name: "Sarah Jenkins",
    specialty: "Dermatology",
    reason: "Persistent acne",
    date: "2024-01-16",
    time: "11:00 AM",
    transcriptCount: 1,
    transcripts: transcripts[3] || []
  },
  {
    id: 4,
    name: "Maria Garcia",
    specialty: "Cardiology",
    reason: "Chest discomfort",
    date: "2024-02-14",
    time: "9:45 AM",
    transcriptCount: 1,
    transcripts: transcripts[4] || []
  },
  {
    id: 5,
    name: "James O'Malley",
    specialty: "Cardiology",
    reason: "Post-ablation checkup",
    date: "2024-02-23",
    time: "3:30 PM",
    transcriptCount: 1,
    transcripts: transcripts[5] || []
  },
  {
    id: 6,
    name: "David Miller",
    specialty: "Dermatology",
    reason: "Dry, itchy patches on elbows",
    date: "2024-01-19",
    time: "1:20 PM",
    transcriptCount: 1,
    transcripts: transcripts[6] || []
  },
  {
    id: 7,
    name: "Robert Williams",
    specialty: "Cardiology",
    reason: "Hypertension follow-up",
    date: "2024-02-05",
    time: "4:00 PM",
    transcriptCount: 1,
    transcripts: transcripts[7] || []
  },
  {
    id: 8,
    name: "Lisa Thompson",
    specialty: "Neurology",
    reason: "Migraine evaluation",
    date: "2024-03-04",
    time: "2:00 PM",
    transcriptCount: 1,
    transcripts: transcripts[8] || []
  },
  {
    id: 9,
    name: "David Brown",
    specialty: "Psychiatry",
    reason: "Depression consultation",
    date: "2024-03-06",
    time: "3:30 PM",
    transcriptCount: 1,
    transcripts: transcripts[9] || []
  }
];