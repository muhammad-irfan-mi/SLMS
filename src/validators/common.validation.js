
//  Disallow {}, <>, [] etc. (company-compliance safe name)
const nameRegex = /^[A-Za-z0-9\s.'-]{2,50}$/;
const schoolNameRegex = /^[A-Za-z0-9\s.,'&-]{3,150}$/;

// Email without spaces
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password: 8–20 chars, 1 uppercase, 1 number, 1 symbol
const passwordRegex =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,20}$/;

// CNIC (Pakistan format optional)
const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

// Phone (simple validation)
const phoneRegex = /^[0-9+]{10,15}$/;



const validateName = (name) => {
    if (!name) return "Name is required";

    const trimmed = name.trim();

    if (trimmed.length < 2)
        return "Name must be at least 2 characters long";

    if (trimmed.length > 50)
        return "Name must not exceed 50 characters";

    if (!/^[A-Za-z0-9\s.'-]+$/.test(trimmed))
        return "Name contains invalid characters";

    return null;
};

const validateSchoolName = (name) => {
    if (!name) return "School name is required";

    if (!schoolNameRegex.test(name))
        return "School name contains invalid characters";

    return null;
};

const validateEmail = (email) => {
    if (!email) return "Email is required";
    if (email.includes(" "))
        return "Email must not contain spaces";
    if (!emailRegex.test(email))
        return "Invalid email format";
    return null;
};

const validatePassword = (password) => {
    if (!password) return "Password is required";

    if (password.includes(" "))
        return "Password must not contain spaces";

    if (password.length < 8 || password.length > 20)
        return "Password must be between 8 and 20 characters";

    if (!/[A-Z]/.test(password))
        return "Password must contain at least one uppercase letter";

    if (!/\d/.test(password))
        return "Password must contain at least one number";

    if (!/[@$!%*?&#]/.test(password))
        return "Password must contain at least one special character";

    return null;
};


const validateCNIC = (cnic) => {
    if (!cnic) return null;
    if (!cnicRegex.test(cnic))
        return "Invalid CNIC format (xxxxx-xxxxxxx-x)";
    return null;
};

const validatePhone = (phone) => {
    if (!phone) return null;
    if (!phoneRegex.test(phone))
        return "Invalid phone number. Phone must be 10-15 digits";
    return null;
};

module.exports = {
    validateName,
    validateSchoolName,
    validateEmail,
    validatePassword,
    validateCNIC,
    validatePhone,
};
