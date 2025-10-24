// Validation utility functions for forms

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return '';
};

export const validatePhone = (phone) => {
  const phoneRegex = /^[\d\s\-+()]{10,}$/;
  if (!phone) return ''; // Phone is optional in most cases
  if (!phoneRegex.test(phone)) return 'Please enter a valid phone number (at least 10 digits)';
  return '';
};

// Normalize phone number to backend-compatible format (no spaces)
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with +91, return as is
  if (cleaned.startsWith('+91')) {
    return cleaned;
  }
  
  // If it starts with 91 (without +), add the +
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  // If it's a 10-digit number, add +91 prefix
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  // If it starts with 0 followed by 10 digits, remove 0 and add +91
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '+91' + cleaned.slice(1);
  }
  
  // For any other format, try to extract the last 10 digits
  if (cleaned.length >= 10) {
    const last10Digits = cleaned.slice(-10);
    return '+91' + last10Digits;
  }
  
  // If we can't normalize properly, return the cleaned version
  return cleaned;
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return '';
};

export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} is required`;
  }
  return '';
};

export const validateLength = (value, min, max, fieldName = 'This field') => {
  if (!value) return '';
  const length = value.length;
  if (min && length < min) return `${fieldName} must be at least ${min} characters`;
  if (max && length > max) return `${fieldName} must not exceed ${max} characters`;
  return '';
};

export const validateUsername = (username) => {
  if (!username) return 'Username is required';
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 50) return 'Username must not exceed 50 characters';
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, dots, hyphens, and underscores';
  }
  return '';
};

export const validateHospitalName = (name) => {
  if (!name || name.trim() === '') return 'Hospital name is required';
  if (name.length < 3) return 'Hospital name must be at least 3 characters';
  if (name.length > 255) return 'Hospital name must not exceed 255 characters';
  return '';
};

export const validateAddress = (address) => {
  if (!address) return ''; // Address is optional
  if (address.length > 1024) return 'Address must not exceed 1024 characters';
  return '';
};

// Validate multiple fields at once
export const validateForm = (fields) => {
  const errors = {};
  let isValid = true;

  Object.keys(fields).forEach(key => {
    const { value, validator, ...options } = fields[key];
    const error = validator(value, options);
    if (error) {
      errors[key] = error;
      isValid = false;
    }
  });

  return { isValid, errors };
};

// Real-time validation debouncer
export const debounce = (func, delay = 300) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

