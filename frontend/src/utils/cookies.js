/**
 * Cookie utility functions for managing hospital ID and other persistent data
 * Uses native browser cookie API for better reliability than localStorage
 */

/**
 * Set a cookie with the given name, value, and options
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} options - Cookie options (expires, path, domain, secure, sameSite)
 */
export function setCookie(name, value, options = {}) {
  if (typeof window === "undefined") return;
  
  const {
    expires = 7, // Default 7 days
    path = "/",
    domain = undefined,
    secure = true,
    sameSite = "strict"
  } = options;

  let cookieString = `${name}=${encodeURIComponent(value)}`;
  
  // Add expiration
  if (expires) {
    const date = new Date();
    date.setTime(date.getTime() + (expires * 24 * 60 * 60 * 1000));
    cookieString += `; expires=${date.toUTCString()}`;
  }
  
  // Add path
  cookieString += `; path=${path}`;
  
  // Add domain if specified
  if (domain) {
    cookieString += `; domain=${domain}`;
  }
  
  // Add secure flag
  if (secure) {
    cookieString += `; secure`;
  }
  
  // Add sameSite
  cookieString += `; samesite=${sameSite}`;
  
  document.cookie = cookieString;
  console.log(`🍪 Cookie set: ${name}=${value}`);
}

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value or null if not found
 */
export function getCookie(name) {
  if (typeof window === "undefined") return null;
  
  const nameEQ = name + "=";
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    let c = cookie.trim();
    if (c.indexOf(nameEQ) === 0) {
      const value = decodeURIComponent(c.substring(nameEQ.length));
      console.log(`🍪 Cookie retrieved: ${name}=${value}`);
      return value;
    }
  }
  
  console.log(`🍪 Cookie not found: ${name}`);
  return null;
}

/**
 * Delete a cookie by name
 * @param {string} name - Cookie name
 * @param {Object} options - Cookie options (path, domain)
 */
export function deleteCookie(name, options = {}) {
  if (typeof window === "undefined") return;
  
  const { path = "/", domain = undefined } = options;
  
  let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
  
  if (domain) {
    cookieString += `; domain=${domain}`;
  }
  
  document.cookie = cookieString;
  console.log(`🍪 Cookie deleted: ${name}`);
}

/**
 * Check if cookies are available in the current environment
 * @returns {boolean} - True if cookies are available
 */
export function areCookiesAvailable() {
  if (typeof window === "undefined") return false;
  
  try {
    // Test cookie functionality
    const testName = "__cookie_test__";
    const testValue = "test";
    setCookie(testName, testValue, { expires: 0.001 }); // Expires in ~1 minute
    const retrieved = getCookie(testName);
    deleteCookie(testName);
    return retrieved === testValue;
  } catch (error) {
    console.warn("🍪 Cookie functionality test failed:", error);
    return false;
  }
}

/**
 * Get all cookies as an object
 * @returns {Object} - Object with cookie names as keys and values as values
 */
export function getAllCookies() {
  if (typeof window === "undefined") return {};
  
  const cookies = {};
  const cookieArray = document.cookie.split(';');
  
  for (let cookie of cookieArray) {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  }
  
  return cookies;
}
