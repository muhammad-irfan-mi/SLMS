const crypto = require('crypto');

class OTPService {
  generateOTP() {
    // Generate 6-digit OTP
    return crypto.randomInt(100000, 999999).toString();
  }

  calculateExpiry(minutes = 10) {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + minutes);
    return expiry;
  }

  isOTPExpired(expiryDate) {
    return new Date() > new Date(expiryDate);
  }

  validateOTP(enteredOTP, storedOTP, expiryDate) {
    if (this.isOTPExpired(expiryDate)) {
      return { valid: false, message: 'OTP has expired' };
    }
    
    if (enteredOTP !== storedOTP) {
      return { valid: false, message: 'Invalid OTP' };
    }
    
    return { valid: true, message: 'OTP verified successfully' };
  }

  canResendOTP(lastAttempt, maxAttempts = 5, coolDownMinutes = 1) {
    if (!lastAttempt) return true;
    
    const now = new Date();
    const timeSinceLastAttempt = (now - new Date(lastAttempt)) / (1000 * 60);
    
    if (timeSinceLastAttempt < coolDownMinutes) {
      return false;
    }
    
    return true;
  }
}

module.exports = new OTPService();