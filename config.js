// config.js - The Engine for Denex
const DENEX_CONFIG = {
    // Your Supabase Credentials
    SB_URL: "https://thyatlpofpzfdtivfosf.supabase.co",
    SB_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoeWF0bHBvZnB6ZmR0aXZmb3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzA5ODksImV4cCI6MjA5MzA0Njk4OX0.pAA451fALaNjC4KwxyCosL4X5IOk5TR7X_Eg5xoSHaU",
    
    // Your EmailJS Credentials
    EMAILJS_SERVICE_ID: "service_n3qk167",
    EMAILJS_TEMPLATE_ID: "template_2bj7q15",
    EMAILJS_PUBLIC_KEY: "6vBr_6upNhGjBzivX"
};

// Denex Utilities
const DENEX_UTILS = {
    // Generates a random 6-digit code
    generateOTP: () => Math.floor(100000 + Math.random() * 900000),
    
    // Sends the email using your template
    sendEmailOTP: async (email, code) => {
        // Safety: Initialize right before sending to avoid "not defined" errors on load
        if (typeof emailjs !== 'undefined') {
            emailjs.init(DENEX_CONFIG.EMAILJS_PUBLIC_KEY);
            
            return emailjs.send(
                DENEX_CONFIG.EMAILJS_SERVICE_ID, 
                DENEX_CONFIG.EMAILJS_TEMPLATE_ID, 
                {
                    email: email,
                    otp_code: code,
                    app_name: "Denex"
                }
            );
        } else {
            console.error("EmailJS library not loaded yet!");
            throw new Error("Email service unavailable");
        }
    }
};

// Initialize Supabase Client (Helper function)
function getClient() {
    if (typeof supabase !== 'undefined') {
        return supabase.createClient(DENEX_CONFIG.SB_URL, DENEX_CONFIG.SB_KEY);
    }
    console.error("Supabase library not loaded!");
    return null;
}
