/**
 * Phone Number Normalization Utility
 * 
 * Automatically adds +91 prefix to Indian mobile numbers
 * Handles various input formats and normalizes them consistently
 */

export const normalizePhoneNumber = (phone) => {
  if (!phone) return "";
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Remove leading zero if present
  const cleanDigits = digits.startsWith("0") ? digits.slice(1) : digits;
  
  // If it's a valid 10-digit Indian mobile number, add +91
  if (cleanDigits.length === 10 && /^[6-9]/.test(cleanDigits)) {
    return "+91" + cleanDigits;
  }
  
  // If it already has +91 prefix, return as is
  if (phone.startsWith("+91")) {
    return phone;
  }
  
  // If it starts with 91 and has 12 digits total, add + prefix
  if (cleanDigits.startsWith("91") && cleanDigits.length === 12 && /^91[6-9]/.test(cleanDigits)) {
    return "+" + cleanDigits;
  }
  
  // For any other valid format, try to extract 10 digits and add +91
  if (cleanDigits.length >= 10) {
    const last10Digits = cleanDigits.slice(-10);
    if (/^[6-9]/.test(last10Digits)) {
      return "+91" + last10Digits;
    }
  }
  
  // If we can't normalize, return original
  return phone;
};

/**
 * Phone number validation
 * Checks if the phone number is a valid Indian mobile number
 */
export const isValidIndianPhoneNumber = (phone) => {
  if (!phone) return false;
  
  const normalized = normalizePhoneNumber(phone);
  return normalized.startsWith("+91") && normalized.length === 13;
};

/**
 * Format phone number for display
 * Converts +91XXXXXXXXXX to +91 XXXXX XXXXX format
 */
export const formatPhoneForDisplay = (phone) => {
  if (!phone) return "";
  
  const normalized = normalizePhoneNumber(phone);
  if (normalized.startsWith("+91") && normalized.length === 13) {
    const digits = normalized.slice(3);
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  
  return normalized;
};
