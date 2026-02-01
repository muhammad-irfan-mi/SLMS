const BankAccount = require('../models/BankAccount');

// Create bank account
const createBankAccount = async (req, res) => {
    try {
        const user = req.user;
        const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

        if (!schoolId) {
            return res.status(400).json({
                success: false,
                message: "School information is required"
            });
        }

        const { accountHolderName, accountNumber, bankName, branchName, accountType, ifscCode } = req.body;

        const existingAccount = await BankAccount.findOne({
            school: schoolId,
            accountNumber: accountNumber
        });

        if (existingAccount) {
            return res.status(400).json({
                success: false,
                message: "Bank account with this account number already exists for your school"
            });
        }

        const bankAccount = await BankAccount.create({
            school: schoolId,
            accountHolderName,
            accountNumber,
            bankName,
            branchName: branchName || '',
            accountType,
            ifscCode,
            createdBy: user._id
        });

        res.status(201).json({
            success: true,
            message: "Bank account created successfully",
            data: bankAccount
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all bank accounts for school
const getBankAccounts = async (req, res) => {
    try {
        const user = req.user;
        const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

        if (!schoolId) {
            return res.status(400).json({
                success: false,
                message: "School information is required"
            });
        }

        const {
            page = 1,
            limit = 10,
            isActive = true,
            accountType,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const filter = { school: schoolId };

        if (accountType) {
            filter.accountType = accountType;
        }

        if (search) {
            filter.$or = [
                { accountHolderName: { $regex: search, $options: 'i' } },
                { accountNumber: { $regex: search, $options: 'i' } },
                { bankName: { $regex: search, $options: 'i' } },
                { branchName: { $regex: search, $options: 'i' } },
                { ifscCode: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const [bankAccounts, total] = await Promise.all([
            BankAccount.find(filter)
                .sort({ [sortBy]: sortDirection })
                .skip(skip)
                .limit(Number(limit))
                .populate('createdBy', 'name email role')
                .populate('updatedBy', 'name email role')
                .lean(),
            BankAccount.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: bankAccounts,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get single bank account by ID
const getBankAccountById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

        const bankAccount = await BankAccount.findOne({
            _id: id,
            school: schoolId
        })
            .populate('createdBy', 'name email role')
            .populate('updatedBy', 'name email role')
            .lean();

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: "Bank account not found"
            });
        }

        res.status(200).json({
            success: true,
            data: bankAccount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update bank account
const updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

        let bankAccount = await BankAccount.findOne({
            _id: id,
            school: schoolId
        });

        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: "Bank account not found"
            });
        }

        if (req.body.accountNumber && req.body.accountNumber !== bankAccount.accountNumber) {
            const existingAccount = await BankAccount.findOne({
                school: schoolId,
                accountNumber: req.body.accountNumber,
                _id: { $ne: id }
            });

            if (existingAccount) {
                return res.status(400).json({
                    success: false,
                    message: "Bank account with this account number already exists for your school"
                });
            }
        }

        const updateFields = { ...req.body, updatedBy: user._id };

        bankAccount = await BankAccount.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true }
        )
            .populate('createdBy', 'name email role')
            .populate('updatedBy', 'name email role');

        res.status(200).json({
            success: true,
            message: "Bank account updated successfully",
            data: bankAccount
        });
    } catch (error) {

        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

const deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const schoolId = user.school || user.schoolId || (user.schoolInfo && user.schoolInfo.id);

        await BankAccount.findOneAndDelete({
            _id: id,
            school: schoolId
        });

        res.status(200).json({
            success: true,
            message: "Bank account deleted successfully",
        });
    } catch (error) {
        console.error("Delete Bank Account Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


module.exports = {
    createBankAccount,
    getBankAccounts,
    getBankAccountById,
    updateBankAccount,
    deleteBankAccount,
};