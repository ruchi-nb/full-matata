'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@/data/UserContext';
import { getAllHospitals } from '@/data/api-hospital-admin';
import { createDoctorOrPatient, createDoctorOrPatientWithRoleCheck } from '@/data/api-superadmin';
import { request } from '@/data/api';
import { Search, Building2, User, Mail, Phone, Key, RefreshCw, Save, X, FileText, Eye, EyeOff } from 'lucide-react';
import AdminLayout from "../layout";
import Sidebar from "@/components/Admin/Sidebar";

// Will fetch specialties from backend dynamically

const INDIAN_LANGUAGES = [
    "Hindi",
    "Bengali", 
    "Telugu",
    "Marathi",
    "Tamil",
    "Urdu",
    "Gujarati",
    "Kannada",
    "Malayalam",
];

export default function SuperAdminAddDoctorPage() {
    const { user } = useUser();
    const [hospitals, setHospitals] = useState([]);
    const [filteredHospitals, setFilteredHospitals] = useState([]);
    const [loadingHospitals, setLoadingHospitals] = useState(true);
    const [specialties, setSpecialties] = useState([]);
    const [loadingSpecialties, setLoadingSpecialties] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedHospital, setSelectedHospital] = useState(null);
    const [showHospitalList, setShowHospitalList] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: '',
        username: '',
        password: '',
        genMode: 'pattern',
        specialty_id: '', // Changed from specialty string to specialty_id
        languages: []
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [formError, setFormError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Fetch hospitals from database
    useEffect(() => {
        const fetchHospitals = async () => {
            try {
                setLoadingHospitals(true);
                setError('');
                const hospitalsData = await getAllHospitals();
                console.log('Fetched hospitals:', hospitalsData);
                setHospitals(hospitalsData || []);
                setFilteredHospitals(hospitalsData || []);
            } catch (error) {
                console.error('Failed to fetch hospitals:', error);
                setError('Failed to load hospitals. Please try again.');
                setHospitals([]);
                setFilteredHospitals([]);
            } finally {
                setLoadingHospitals(false);
            }
        };

        fetchHospitals();
    }, []);

    // Fetch specialties from backend
    useEffect(() => {
        const fetchSpecialties = async () => {
            try {
                setLoadingSpecialties(true);
                const response = await request('/hospitals/specialities', { method: 'GET' });
                console.log('Fetched specialties:', response);
                setSpecialties(response || []);
            } catch (error) {
                console.error('Failed to fetch specialties:', error);
                setSpecialties([]);
            } finally {
                setLoadingSpecialties(false);
            }
        };

        fetchSpecialties();
    }, []);

    // Filter hospitals based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredHospitals(hospitals);
        } else {
            const filtered = hospitals.filter(hospital =>
                hospital.hospital_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                hospital.hospital_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                hospital.hospital_id.toString().includes(searchTerm)
            );
            setFilteredHospitals(filtered);
        }
    }, [searchTerm, hospitals]);

    const toggleLanguage = (lang) => {
        setFormData(prev => {
            const exists = prev.languages.includes(lang);
            return { 
                ...prev, 
                languages: exists ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang] 
            };
        });
    };

    const handleHospitalSelect = (hospital) => {
        setSelectedHospital(hospital);
        setShowHospitalList(false);
        setSearchTerm('');
    };

    const generatePassword = () => {
        if (formData.genMode === 'random') {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
            const pw = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            setFormData(prev => ({ ...prev, password: pw }));
            return;
        }
        
        // Pattern: first 2 of first name + first 2 of last name + last 4 of phone + random 2
        const f2 = (formData.firstName || "").replace(/\s+/g, "").slice(0, 2).toLowerCase();
        const l2 = (formData.lastName || "").replace(/\s+/g, "").slice(0, 2).toLowerCase();
        const last4 = (formData.phone || "").replace(/\D/g, "").slice(-4);
        const extra = Array.from({ length: 2 }, () => "!@#$%abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 40)]).join('');
        const base = `${f2}${l2}${last4}${extra}`;
        setFormData(prev => ({ ...prev, password: base || Array.from({ length: 8 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]).join('') }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setFormError('');
        setSuccess('');

        try {
            // Validate required fields
            if (!formData.firstName || !formData.email || !formData.role || !formData.password) {
                throw new Error("Please fill in all required fields");
            }

            if (!selectedHospital) {
                throw new Error("Please select a hospital");
            }

            // Validate specialty for doctors
            if (formData.role === 'doctor' && !formData.specialty_id) {
                throw new Error("Please select a specialty for doctors");
            }

            // Prepare payload for doctor/patient creation with hospital linking
            const payload = {
                // User creation fields
                user_type: formData.role, // doctor or patient
                username: formData.username,
                email: formData.email,
                password: formData.password,
                first_name: formData.firstName,
                last_name: formData.lastName,
                phone: formData.phone || null,
                
                // Hospital linking
                hospital_id: selectedHospital.hospital_id,
                hospital_name: selectedHospital.hospital_name,
                
                // Professional details for doctors
                ...(formData.role === 'doctor' && {
                    specialty_ids: formData.specialty_id ? [parseInt(formData.specialty_id)] : null,
                    // languages field is not yet supported by backend - will add later
                })
            };

            console.log('Creating user with payload:', payload);

            // Create user and link to hospital using the new API with role check
            const result = await createDoctorOrPatientWithRoleCheck(payload);

            console.log('✅ User created successfully:', result);
            setSuccess(`User ${formData.firstName} ${formData.lastName} created successfully!`);
            
            // Reset form
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                role: '',
                username: '',
                password: '',
                genMode: 'pattern',
                specialty_id: '',
                languages: []
            });
            setSelectedHospital(null);

        } catch (error) {
            console.error('Failed to create user:', error);
            setFormError(error.message || 'Failed to create user. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            role: '',
            username: '',
            password: '',
            genMode: 'pattern',
            specialty_id: '',
            languages: []
        });
        setSelectedHospital(null);
        setFormError('');
        setSuccess('');
    };

    return (
        <AdminLayout>
            <div className="h-full w-64 bg-[#fafaf9] shadow-xl flex-shrink-0">
                <Sidebar />
            </div>
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <div className="p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Create User (Superadmin)</h1>
                            <p className="text-gray-600 mt-1">Create doctors or patients for any hospital using global roles</p>
                        </div>
                    </div>
                </div>

                {/* Hospital Selection */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Building2 className="h-5 w-5 mr-2 text-blue-600" />
                        Select Hospital
                    </h2>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Hospital Search and Selection */}
                    <div className="relative">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search hospitals by name, email, or ID..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setShowHospitalList(true);
                                    }}
                                    onFocus={() => setShowHospitalList(true)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowHospitalList(!showHospitalList)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {showHospitalList ? 'Hide' : 'Show'} List
                            </button>
                        </div>

                        {/* Selected Hospital Display */}
                        {selectedHospital && (
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-blue-900">{selectedHospital.hospital_name}</h3>
                                        <p className="text-sm text-blue-700">ID: {selectedHospital.hospital_id}</p>
                                        {selectedHospital.hospital_email && (
                                            <p className="text-sm text-blue-700">{selectedHospital.hospital_email}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedHospital(null)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Hospital List */}
                        {showHospitalList && (
                            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                                {loadingHospitals ? (
                                    <div className="p-4 text-center text-gray-500">
                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Loading hospitals...
                                    </div>
                                ) : filteredHospitals.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500">
                                        No hospitals found matching your search.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-200">
                                        {filteredHospitals.map((hospital) => (
                                            <button
                                                key={hospital.hospital_id}
                                                onClick={() => handleHospitalSelect(hospital)}
                                                className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="font-medium text-gray-900">{hospital.hospital_name}</h3>
                                                        <p className="text-sm text-gray-500">ID: {hospital.hospital_id}</p>
                                                        {hospital.hospital_email && (
                                                            <p className="text-sm text-gray-500">{hospital.hospital_email}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-gray-400">
                                                        {hospital.hospital_id}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* User Creation Form */}
                {selectedHospital ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                            <User className="h-5 w-5 mr-2 text-blue-600" />
                            Create User for {selectedHospital.hospital_name}
                        </h2>

                        {success && (
                            <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-lg">
                                {success}
                            </div>
                        )}

                        {formError && (
                            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Personal Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        First Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.firstName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter first name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Last Name 
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter last name"
                                    />
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Mail className="inline h-4 w-4 mr-1" />
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => {
                                            const email = e.target.value;
                                            // auto-generate username from email (use full email)
                                            const username = email
                                                                 .toLowerCase()
                                                                 .replace(/\s+/g, '')       // remove spaces
                                                                 .replace(/[^a-z0-9@._-]/g, ''); // remove invalid chars but keep @
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                email,
                                                username
                                            }));
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter email address"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Phone className="inline h-4 w-4 mr-1" />
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="+91 1234567890"
                                    />
                                </div>
                            </div>

                            {/* Role Selection */}
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Role *
                                </label>
                                <select
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select role</option>
                                    <option value="doctor">Doctor</option>
                                    <option value="patient">Patient</option>
                                </select>
                            </div>

                            {/* Login Credentials */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.username}
                                        disabled // disable editing
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Auto-filled from email"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Auto-filled from email</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Key className="inline h-4 w-4 mr-1" />
                                        Password *
                                    </label>
                                    <div className="flex space-x-2">
                                        <div className="relative flex-1">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={formData.password}
                                                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Click Generate or type your own"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex space-x-1">
                                            <select
                                                value={formData.genMode}
                                                onChange={(e) => setFormData(prev => ({ ...prev, genMode: e.target.value }))}
                                                className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                <option value="pattern">Pattern</option>
                                                <option value="random">Random</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={generatePassword}
                                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                            >
                                                Generate
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Professional Details - Only show for doctors */}
                            {formData.role === 'doctor' && (
                                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                                    <div className="flex items-center space-x-2 mb-6">
                                        <FileText className="h-5 w-5 text-blue-600" />
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Professional Details
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Specialty *
                                            </label>
                                            <select
                                                required
                                                value={formData.specialty_id}
                                                onChange={(e) => setFormData(prev => ({ ...prev, specialty_id: e.target.value }))}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                disabled={loadingSpecialties}
                                            >
                                                <option value="">
                                                    {loadingSpecialties ? 'Loading specialties...' : 'Select specialty'}
                                                </option>
                                                {specialties.map((s) => (
                                                    <option key={s.specialty_id} value={s.specialty_id}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {specialties.length === 0 && !loadingSpecialties && (
                                                <p className="text-xs text-amber-600 mt-1">
                                                    No specialties available. Please add specialties first.
                                                </p>
                                            )}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                                Languages (Select any)
                                            </label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {INDIAN_LANGUAGES.map((lang) => (
                                                    <label key={lang} className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.languages.includes(lang)}
                                                            onChange={() => toggleLanguage(lang)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-700">{lang}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Form Actions */}
                            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Create User
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                        <div className="text-gray-500">
                            <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Hospital</h3>
                            <p className="text-gray-500">Choose a hospital above to create users for that organization.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </AdminLayout>
    );
}