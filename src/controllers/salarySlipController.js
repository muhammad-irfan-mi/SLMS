const BankAccount = require("../models/BankAccount");
const CashAccount = require("../models/CashAccount");
const Expense = require("../models/Expense");
const SalarySlip = require("../models/SalarySlip");
const Staff = require("../models/Staff");
const { deleteFileFromS3, uploadFileToS3 } = require("../services/s3.service");
const { createNotification, NOTIFICATION_TYPES, NOTIFICATION_TARGETS } = require("../utils/notificationService");


async function uploadDocumentImage(files, existingImage = null) {
    let image = existingImage;
    if (files?.documentImage?.[0]) {
        if (image) await deleteFileFromS3(image);
        image = await uploadFileToS3({
            fileBuffer: files.documentImage[0].buffer,
            fileName: files.documentImage[0].originalname,
            mimeType: files.documentImage[0].mimetype,
        });
    }
    return image;
}

const createSalaryExpense = async (teacherId, schoolId, amount, monthYear, actor, slipId, paymentMethod = 'bank', bankAccountId = null, cashAccountId = null) => {
    try {
        const teacher = await Staff.findById(teacherId).select('name email');
        if (!teacher) return null;

        if (paymentMethod === 'bank') {
            if (!bankAccountId) {
                console.error("Bank account ID required for bank payment");
                return null;
            }

            const bankAccount = await BankAccount.findOne({
                _id: bankAccountId,
                school: schoolId,
                isActive: true
            });

            if (!bankAccount) {
                console.error("Invalid bank account");
                return null;
            }
        }
        else if (paymentMethod === 'cash') {
            if (!cashAccountId) {
                console.error("Cash account ID required for cash payment");
                return null;
            }

            const cashAccount = await CashAccount.findOne({
                _id: cashAccountId,
                school: schoolId,
                isActive: true
            });

            if (!cashAccount) {
                console.error("Invalid cash account");
                return null;
            }
        }

        const expenseData = {
            school: schoolId,
            title: `Salary Payment - ${teacher.name} (${monthYear})`,
            description: `Salary payment for ${teacher.name} for month ${monthYear}`,
            category: 'salary',
            amount: amount,
            date: new Date(),
            paymentMethod: paymentMethod,
            bankAccountId: paymentMethod === 'bank' ? bankAccountId : null,
            cashAccountId: paymentMethod === 'cash' ? cashAccountId : null,
            status: 'approved',
            approvedAt: new Date()
        };

        const expense = new Expense(expenseData);
        await expense.save();

        await SalarySlip.findByIdAndUpdate(slipId, {
            expenseId: expense._id
        });

        return expense;
    } catch (error) {
        console.error("Error creating salary expense:", error);
        return null;
    }
};

const updateSalaryExpense = async (slip, actor, additionalAmount, paymentMethod = 'bank', bankAccountId = null, cashAccountId = null) => {
    try {
        if (!slip.expenseId) return null;

        const expense = await Expense.findById(slip.expenseId);
        if (!expense) return null;

        if (paymentMethod === 'bank') {
            if (!bankAccountId) {
                throw new Error("Bank account ID required for bank payment");
            }

            const bankAccount = await BankAccount.findOne({
                _id: bankAccountId,
                school: expense.school,
                isActive: true
            });

            if (!bankAccount) {
                throw new Error("Invalid bank account");
            }

            expense.bankAccountId = bankAccountId;
        }
        else if (paymentMethod === 'cash') {
            if (!cashAccountId) {
                throw new Error("Cash account ID required for cash payment");
            }

            const cashAccount = await CashAccount.findOne({
                _id: cashAccountId,
                school: expense.school,
                isActive: true
            });

            if (!cashAccount) {
                throw new Error("Invalid cash account");
            }

            expense.cashAccountId = cashAccountId;
        }

        expense.amount += additionalAmount;
        expense.paymentMethod = paymentMethod;
        expense.updatedAt = new Date();
        await expense.save();

        return expense;
    } catch (error) {
        console.error("Error updating salary expense:", error);
        return null;
    }
};

// Send notification to teacher
const sendSalaryNotification = async (slip, actor, action = 'created', paymentAmount = null) => {
    try {
        const teacher = await Staff.findById(slip.teacherId).select('name email');
        if (!teacher) return null;

        let title, message;
        if (action === 'created') {
            title = `Salary Slip Generated - ${slip.monthYear}`;
            message = `Your salary slip for ${slip.monthYear} has been generated. Total amount: ${slip.totalAmount}`;
        } else if (action === 'payment_approved') {
            title = `Salary Payment Received - ${slip.monthYear}`;
            message = `A payment of ${paymentAmount} has been recorded. Remaining: ${slip.remainingAmount}`;
        }

        return createNotification({
            type: NOTIFICATION_TYPES.SALARY,
            actor,
            targetTeachers: [slip.teacherId],
            school: slip.school,
            title,
            message,
            data: {
                slipId: slip._id,
                amount: paymentAmount,
                monthYear: slip.monthYear,
                status: slip.status
            },
            category: 'general',
            pinned: false
        });
    } catch (error) {
        console.error('Error sending salary notification:', error);
        return null;
    }
};

const createSalarySlip = async (req, res) => {
    try {
        const { teacherId, monthYear, title, description, paidAmount, paymentMethod, bankAccountId, cashAccountId } = req.body;
        const schoolId = req.user.school;

        if (!teacherId || !monthYear || !title) {
            return res.status(400).json({ message: "Missing required fields: teacherId, monthYear, title" });
        }

        // Validate teacher
        const teacher = await Staff.findOne({
            _id: teacherId,
            role: "teacher",
            school: schoolId,
            isActive: true
        });

        if (!teacher) {
            return res.status(404).json({ message: "Teacher not found in your school" });
        }

        const totalAmount = teacher.salary || 0;
        if (totalAmount <= 0) {
            return res.status(400).json({ message: "Teacher salary not configured. Please set salary first." });
        }

        const existingSlip = await SalarySlip.findOne({
            teacherId,
            monthYear,
            school: schoolId
        });

        if (existingSlip) {
            return res.status(400).json({
                message: `Salary slip for ${monthYear} already exists`,
                slip: existingSlip
            });
        }

        const documentImage = await uploadDocumentImage(req.files);
        let paidAmountValue = parseFloat(paidAmount) || 0;

        if (paidAmountValue > totalAmount) {
            return res.status(400).json({
                message: `Paid amount (${paidAmountValue}) cannot exceed total amount (${totalAmount})`
            });
        }

        let validBankAccountId = null;
        let validCashAccountId = null;

        if (paidAmountValue > 0) {
            if (paymentMethod === 'bank') {
                if (!bankAccountId) {
                    return res.status(400).json({
                        message: "Bank account ID is required for bank payment"
                    });
                }

                const bankAccount = await BankAccount.findOne({
                    _id: bankAccountId,
                    school: schoolId,
                    isActive: true
                });

                if (!bankAccount) {
                    return res.status(400).json({
                        message: "Invalid bank account."
                    });
                }

                validBankAccountId = bankAccountId;
            } else if (paymentMethod === 'cash') {
                if (!cashAccountId) {
                    return res.status(400).json({
                        message: "Cash account ID is required for cash payment"
                    });
                }

                const cashAccount = await CashAccount.findOne({
                    _id: cashAccountId,
                    school: schoolId,
                    isActive: true
                });

                if (!cashAccount) {
                    return res.status(400).json({
                        message: "Invalid cash account."
                    });
                }

                validCashAccountId = cashAccountId;
            } else {
                return res.status(400).json({
                    message: "Invalid payment method. Must be 'bank' or 'cash'"
                });
            }
        }

        const remainingAmount = totalAmount - paidAmountValue;
        const status = remainingAmount === 0 ? 'paid' : (paidAmountValue > 0 ? 'partial' : 'pending');

        const slipData = {
            teacherId,
            school: schoolId,
            monthYear,
            title,
            description: description || '',
            totalAmount,
            paidAmount: paidAmountValue,
            remainingAmount,
            status,
            documentImage
        };

        if (paidAmountValue > 0) {
            slipData.paymentHistory = [{
                amount: paidAmountValue,
                paymentMethod: paymentMethod || 'cash',
                bankAccountId: validBankAccountId,
                cashAccountId: validCashAccountId,
                paidAt: new Date(),
                approvedBy: req.user._id,
            }];
        }

        const slip = new SalarySlip(slipData);
        await slip.save();

        let expense = null;
        if (paidAmountValue > 0) {
            expense = await createSalaryExpense(
                teacherId,
                schoolId,
                paidAmountValue,
                monthYear,
                req.user,
                slip._id,
                paymentMethod || 'cash',
                validBankAccountId,
                validCashAccountId
            );
        }

        await sendSalaryNotification(slip, req.user, 'created');

        res.status(201).json({
            message: "Salary slip created successfully",
            slip: {
                _id: slip._id,
                teacherId: slip.teacherId,
                monthYear: slip.monthYear,
                title: slip.title,
                totalAmount: slip.totalAmount,
                paidAmount: slip.paidAmount,
                remainingAmount: slip.remainingAmount,
                status: slip.status,
                expenseId: expense?._id || null
            }
        });
    } catch (err) {
        console.error("Error creating salary slip:", err);
        res.status(500).json({ message: err.message });
    }
};

// Record additional payment
const recordSalaryPayment = async (req, res) => {
    try {
        const { slipId } = req.params;
        const { amount, paymentMethod, bankAccountId, cashAccountId, remarks } = req.body;
        const schoolId = req.user.school;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Valid payment amount is required" });
        }

        const slip = await SalarySlip.findOne({ _id: slipId, school: schoolId });
        if (!slip) {
            return res.status(404).json({ message: "Salary slip not found" });
        }

        if (slip.status === 'paid') {
            return res.status(400).json({ message: "Salary already fully paid" });
        }

        const paymentAmount = parseFloat(amount);
        const currentPaidAmount = parseFloat(slip.paidAmount);
        const currentRemainingAmount = parseFloat(slip.remainingAmount);

        if (paymentAmount > currentRemainingAmount) {
            return res.status(400).json({
                message: `Payment amount (${paymentAmount}) exceeds remaining amount (${currentRemainingAmount})`
            });
        }

        if (paymentMethod === 'bank') {
            if (!bankAccountId) {
                return res.status(400).json({
                    success: false,
                    message: "Bank account ID is required for bank payment"
                });
            }

            const bankAccount = await BankAccount.findOne({
                _id: bankAccountId,
                school: schoolId,
                isActive: true
            });

            if (!bankAccount) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid bank account."
                });
            }

            validBankAccountId = bankAccountId;
        }
        else if (paymentMethod === 'cash') {
            if (!cashAccountId) {
                return res.status(400).json({
                    success: false,
                    message: "Cash account ID is required for cash payment"
                });
            }

            const cashAccount = await CashAccount.findOne({
                _id: cashAccountId,
                school: schoolId,
                isActive: true
            });

            if (!cashAccount) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid cash account."
                });
            }

            validCashAccountId = cashAccountId;
        }

        const documentImage = await uploadDocumentImage(req.files);

        const paymentRecord = {
            amount: paymentAmount,
            paymentMethod: paymentMethod || 'cash',
            bankAccountId: validBankAccountId,
            cashAccountId: validCashAccountId,
            paidAt: new Date(),
            approvedBy: req.user._id,
            remarks
        };

        if (documentImage) {
            paymentRecord.proofImage = documentImage;
        }

        slip.paymentHistory.push(paymentRecord);

        // Update amounts
        slip.paidAmount = currentPaidAmount + paymentAmount;
        slip.remainingAmount = currentRemainingAmount - paymentAmount;

        // Update status
        if (slip.remainingAmount <= 0) {
            slip.status = 'paid';
            slip.remainingAmount = 0;
        } else {
            slip.status = 'partial';
        }

        await slip.save();

        let expense = null;
        if (slip.expenseId) {
            expense = await updateSalaryExpense(slip, req.user, paymentAmount, paymentMethod || 'bank',
                validBankAccountId, validCashAccountId);
        } else {
            expense = await createSalaryExpense(
                slip.teacherId,
                schoolId,
                paymentAmount,
                slip.monthYear,
                req.user,
                slip._id,
                paymentMethod || 'bank',
                validBankAccountId,
                validCashAccountId
            );
        }

        await sendSalaryNotification(slip, req.user, 'payment_approved', paymentAmount);

        res.status(200).json({
            message: "Salary payment recorded successfully",
            slip: {
                _id: slip._id,
                totalAmount: slip.totalAmount,
                paidAmount: slip.paidAmount,
                remainingAmount: slip.remainingAmount,
                status: slip.status,
                paidPercentage: ((slip.paidAmount / slip.totalAmount) * 100).toFixed(2),
                expenseId: expense?._id || null
            }
        });
    } catch (err) {
        console.error("Error recording salary payment:", err);
        res.status(500).json({ message: err.message });
    }
};

// Update salary slip
const updateSalarySlip = async (req, res) => {
    try {
        const slipId = req.params.id;
        const schoolId = req.user.school;
        const { title, description } = req.body;

        const slip = await SalarySlip.findOne({ _id: slipId, school: schoolId });
        if (!slip) {
            return res.status(404).json({ message: "Salary slip not found" });
        }

        if (title) slip.title = title;
        if (description) slip.description = description;
        slip.documentImage = await uploadDocumentImage(req.files, slip.documentImage);
        await slip.save();

        res.status(200).json({
            message: "Salary slip updated successfully",
            slip
        });
    } catch (err) {
        console.error("Error updating salary slip:", err);
        res.status(500).json({ message: err.message });
    }
};

// Delete salary slip (with expense cleanup)
const deleteSalarySlip = async (req, res) => {
    try {
        const slipId = req.params.id;
        const schoolId = req.user.school;

        const slip = await SalarySlip.findOne({ _id: slipId, school: schoolId });
        if (!slip) {
            return res.status(404).json({ message: "Salary slip not found" });
        }

        // Delete associated expense if exists
        if (slip.expenseId) {
            const expense = await Expense.findById(slip.expenseId);
            if (expense) {
                // Delete receipt from S3 if exists
                if (expense.receipt?.url) {
                    await deleteFileFromS3(expense.receipt.url);
                }
                await expense.deleteOne();
            }
        }

        if (slip.documentImage) await deleteFileFromS3(slip.documentImage);
        await slip.deleteOne();

        res.status(200).json({ message: "Salary slip and associated expense deleted successfully" });
    } catch (err) {
        console.error("Error deleting salary slip:", err);
        res.status(500).json({ message: err.message });
    }
};


const getTeacherSlips = async (req, res) => {
    try {
        const teacherId = req.user._id;
        const schoolId = req.user.school;
        const { page = 1, limit = 10, status } = req.query;
        const skip = (page - 1) * limit;

        const filter = { teacherId, school: schoolId };
        if (status) filter.status = status;

        const [slips, total] = await Promise.all([
            SalarySlip.find(filter)
                .sort({ monthYear: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            SalarySlip.countDocuments(filter)
        ]);

        // Calculate summary
        const summary = {
            totalSalary: 0,
            totalPaid: 0,
            totalPending: 0,
            paidCount: 0,
            partialCount: 0,
            pendingCount: 0
        };

        const formattedSlips = slips.map(slip => {
            summary.totalSalary += slip.totalAmount;
            summary.totalPaid += slip.paidAmount;
            summary.totalPending += slip.remainingAmount;
            if (slip.status === 'paid') summary.paidCount++;
            else if (slip.status === 'partial') summary.partialCount++;
            else summary.pendingCount++;

            return {
                _id: slip._id,
                monthYear: slip.monthYear,
                title: slip.title,
                totalAmount: slip.totalAmount,
                paidAmount: slip.paidAmount,
                remainingAmount: slip.remainingAmount,
                status: slip.status,
                paidPercentage: ((slip.paidAmount / slip.totalAmount) * 100).toFixed(2),
                paymentHistory: slip.paymentHistory,
                documentImage: slip.documentImage,
                createdAt: slip.createdAt
            };
        });

        res.status(200).json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            summary,
            slips: formattedSlips
        });
    } catch (err) {
        console.error("Error in getTeacherSlips:", err);
        res.status(500).json({ message: err.message });
    }
};

// Get single slip details
const getSalarySlipById = async (req, res) => {
    try {
        const { id } = req.params;
        const teacherId = req.user._id;
        const userRole = req.user.role;
        const schoolId = req.user.school;

        const slip = await SalarySlip.findOne({
            _id: id,
            ...(userRole === 'teacher' ? { teacherId } : { school: schoolId })
        }).lean();

        if (!slip) {
            return res.status(404).json({ message: "Salary slip not found" });
        }

        const teacher = await Staff.findById(slip.teacherId).select('name email joiningDate salary');

        res.status(200).json({
            slip: {
                _id: slip._id,
                monthYear: slip.monthYear,
                title: slip.title,
                description: slip.description,
                totalAmount: slip.totalAmount,
                paidAmount: slip.paidAmount,
                remainingAmount: slip.remainingAmount,
                status: slip.status,
                paidPercentage: ((slip.paidAmount / slip.totalAmount) * 100).toFixed(2),
                paymentHistory: slip.paymentHistory,
                documentImage: slip.documentImage,
                createdAt: slip.createdAt,
                updatedAt: slip.updatedAt
            },
            teacher: {
                _id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                baseSalary: teacher.salary
            }
        });
    } catch (err) {
        console.error("Error getting salary slip:", err);
        res.status(500).json({ message: err.message });
    }
};


// Get teachers salary status for a specific year
const getTeachersSalaryStatus = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { year, page = 1, limit = 20, search } = req.query;

        if (!year) {
            return res.status(400).json({ message: "Year is required (format: YYYY)" });
        }

        const skip = (page - 1) * limit;

        // Get all teachers
        let teachersQuery = Staff.find({
            school: schoolId,
            role: "teacher",
            isActive: true
        }).select('_id name email joiningDate salary');

        if (search) {
            teachersQuery = teachersQuery.or([
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]);
        }

        const teachers = await teachersQuery.lean();
        const teacherIds = teachers.map(t => t._id);

        // Get all salary slips for the specified year
        const slips = await SalarySlip.find({
            school: schoolId,
            monthYear: { $regex: `^${year}`, $options: 'i' },
            teacherId: { $in: teacherIds }
        }).sort({ monthYear: 1 }).lean();

        // Group slips by teacher
        const slipsByTeacher = new Map();
        slips.forEach(slip => {
            const teacherId = slip.teacherId.toString();
            if (!slipsByTeacher.has(teacherId)) {
                slipsByTeacher.set(teacherId, []);
            }
            slipsByTeacher.get(teacherId).push(slip);
        });

        // Build results with teacher data and their slips
        const results = [];
        let globalSummary = {
            totalTeachers: teachers.length,
            totalSalaryAmount: 0,
            totalPaidAmount: 0,
            totalPendingAmount: 0,
            fullyPaidCount: 0,
            partialCount: 0,
            pendingCount: 0,
            noSlipCount: 0
        };

        for (const teacher of teachers) {
            const teacherSlips = slipsByTeacher.get(teacher._id.toString()) || [];
            const teacherSalary = teacher.salary || 0;

            // Calculate teacher's summary
            // let teacherTotalSalary = 0;
            // let teacherTotalPaid = 0;
            // let teacherTotalPending = 0;
            // let teacherFullyPaidCount = 0;
            // let teacherPartialCount = 0;
            // let teacherPendingCount = 0;

            const formattedSlips = teacherSlips.map(slip => {
                // teacherTotalSalary += slip.totalAmount;
                // teacherTotalPaid += slip.paidAmount;
                // teacherTotalPending += slip.remainingAmount;

                // if (slip.status === 'paid') teacherFullyPaidCount++;
                // else if (slip.status === 'partial') teacherPartialCount++;
                // else teacherPendingCount++;

                return {
                    _id: slip._id,
                    monthYear: slip.monthYear,
                    title: slip.title,
                    totalAmount: slip.totalAmount,
                    paidAmount: slip.paidAmount,
                    remainingAmount: slip.remainingAmount,
                    status: slip.status,
                    // paidPercentage: ((slip.paidAmount / slip.totalAmount) * 100).toFixed(2),
                    paymentHistory: slip.paymentHistory,
                    createdAt: slip.createdAt
                };
            });

            // Update global summary
            // globalSummary.totalSalaryAmount += teacherTotalSalary;
            // globalSummary.totalPaidAmount += teacherTotalPaid;
            // globalSummary.totalPendingAmount += teacherTotalPending;
            // globalSummary.fullyPaidCount += teacherFullyPaidCount;
            // globalSummary.partialCount += teacherPartialCount;
            // globalSummary.pendingCount += teacherPendingCount;

            if (teacherSlips.length === 0) {
                globalSummary.noSlipCount++;
                // For teachers with no slips, show their base salary as pending
                teacherTotalSalary = teacherSalary;
                teacherTotalPending = teacherSalary;
            }

            results.push({
                teacher: {
                    _id: teacher._id,
                    name: teacher.name,
                    email: teacher.email,
                    joiningDate: teacher.joiningDate,
                    baseSalary: teacherSalary
                },
                // summary: {
                //     totalSalary: teacherTotalSalary,
                //     totalPaid: teacherTotalPaid,
                //     totalPending: teacherTotalPending,
                //     fullyPaidCount: teacherFullyPaidCount,
                //     partialCount: teacherPartialCount,
                //     pendingCount: teacherPendingCount,
                //     hasSlips: teacherSlips.length > 0
                // },
                salarySlips: formattedSlips
            });
        }

        // Paginate results
        const paginatedResults = results.slice(skip, skip + limit);
        const total = results.length;

        res.status(200).json({
            year: parseInt(year),
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
            // summary: globalSummary,
            teachers: paginatedResults
        });
    } catch (err) {
        console.error("Error in getTeachersSalaryStatus:", err);
        res.status(500).json({ message: err.message });
    }
};

// Get teacher's salary history (only months with data)
const getTeacherSalaryHistory = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { teacherId } = req.query;

        if (!teacherId) {
            return res.status(400).json({ message: "teacherId is required" });
        }

        const teacher = await Staff.findById(teacherId).select('name email joiningDate salary');
        if (!teacher) {
            return res.status(404).json({ message: "Teacher not found" });
        }

        const slips = await SalarySlip.find({
            school: schoolId,
            teacherId
        }).sort({ monthYear: 1 }).lean();

        // Only include months that have data
        const salaryHistory = slips.map(slip => ({
            monthYear: slip.monthYear,
            totalAmount: slip.totalAmount,
            paidAmount: slip.paidAmount,
            remainingAmount: slip.remainingAmount,
            status: slip.status,
            paidPercentage: ((slip.paidAmount / slip.totalAmount) * 100).toFixed(2),
            paymentHistory: slip.paymentHistory,
            createdAt: slip.createdAt
        }));

        // Calculate overall stats
        const totalSalary = slips.reduce((sum, s) => sum + s.totalAmount, 0);
        const totalPaid = slips.reduce((sum, s) => sum + s.paidAmount, 0);
        const totalPending = totalSalary - totalPaid;

        res.status(200).json({
            teacher: {
                _id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                baseSalary: teacher.salary
            },
            summary: {
                totalSalary,
                totalPaid,
                totalPending,
                collectionRate: totalSalary > 0 ? ((totalPaid / totalSalary) * 100).toFixed(2) : 0
            },
            salaryHistory
        });
    } catch (err) {
        console.error("Error in getTeacherSalaryHistory:", err);
        res.status(500).json({ message: err.message });
    }
};

const getSchoolSalarySummary = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({ message: "Year is required" });
        }

        const teachers = await Staff.find({
            school: schoolId,
            role: "teacher",
            isActive: true
        }).select('_id salary');

        const totalTeachers = teachers.length;
        const totalMonthlySalary = teachers.reduce((sum, t) => sum + (t.salary || 0), 0);

        // Get all slips for the year
        const slips = await SalarySlip.find({
            school: schoolId,
            monthYear: { $regex: `^${year}`, $options: 'i' }
        }).lean();

        // Group by month
        const monthlyData = {};

        for (let i = 1; i <= 12; i++) {
            const monthStr = `${year}-${String(i).padStart(2, '0')}`;
            const monthSlips = slips.filter(s => s.monthYear === monthStr);

            const monthTotalAmount = monthSlips.reduce((sum, s) => sum + s.totalAmount, 0);
            const monthPaidAmount = monthSlips.reduce((sum, s) => sum + s.paidAmount, 0);

            // Only include months that have data
            if (monthSlips.length > 0) {
                monthlyData[monthStr] = {
                    teacherCount: monthSlips.length,
                    totalAmount: monthTotalAmount,
                    paidAmount: monthPaidAmount,
                    pendingAmount: monthTotalAmount - monthPaidAmount,
                    paidCount: monthSlips.filter(s => s.status === 'paid').length,
                    partialCount: monthSlips.filter(s => s.status === 'partial').length,
                    pendingCount: monthSlips.filter(s => s.status === 'pending').length,
                    collectionRate: monthTotalAmount > 0 ? ((monthPaidAmount / monthTotalAmount) * 100).toFixed(2) : 0
                };
            }
        }

        res.status(200).json({
            year: parseInt(year),
            totalTeachers,
            totalMonthlySalary,
            monthlyData
        });
    } catch (err) {
        console.error("Error in getSchoolSalarySummary:", err);
        res.status(500).json({ message: err.message });
    }
};

const getStaffLedgerSummary = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const {
            page = 1,
            limit = 20,
            search,
            role = 'teacher' | 'admin_office', 
            status, 
            month,
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const sortDirection = sortOrder === 'asc' ? 1 : -1;

        const staffFilter = {
            school: schoolId,
            isActive: true
        };

        if (role && role !== 'all') {
            staffFilter.role = role;
        }

        if (search) {
            staffFilter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } }
            ];
        }

        const staffMembers = await Staff.find(staffFilter)
            .select('_id name email role employeeId joiningDate salary department')
            .sort({ [sortBy]: sortDirection })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const totalStaff = await Staff.countDocuments(staffFilter);

        const staffIds = staffMembers.map(s => s._id);

        const slipFilter = {
            school: schoolId,
            teacherId: { $in: staffIds }
        };

        if (month) {
            slipFilter.monthYear = { $regex: `^${month}`, $options: 'i' };
        }

        const slips = await SalarySlip.find(slipFilter)
            .sort({ monthYear: -1 })
            .lean();

        const expenseFilter = {
            school: schoolId,
            category: 'salary'
        };

        if (month) {
            expenseFilter.title = { $regex: month, $options: 'i' };
        }

        const expenses = await Expense.find(expenseFilter)
            .lean();

        const slipsByStaff = {};
        slips.forEach(slip => {
            const key = slip.teacherId.toString();
            if (!slipsByStaff[key]) {
                slipsByStaff[key] = [];
            }
            slipsByStaff[key].push(slip);
        });

        const expensesByStaff = {};
        slips.forEach(slip => {
            if (slip.expenseId) {
                const expense = expenses.find(e => e._id.toString() === slip.expenseId.toString());
                if (expense) {
                    const key = slip.teacherId.toString();
                    if (!expensesByStaff[key]) {
                        expensesByStaff[key] = [];
                    }
                    expensesByStaff[key].push(expense);
                }
            }
        });

        const ledgerEntries = staffMembers.map(staff => {
            const staffSlips = slipsByStaff[staff._id.toString()] || [];
            const staffExpenses = expensesByStaff[staff._id.toString()] || [];

            const totalSalaryAmount = staffSlips.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            const totalPaidAmount = staffSlips.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
            const totalRemaining = staffSlips.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);

            let adjustedRemaining = totalRemaining;
            let adjustedSalary = totalSalaryAmount;
            if (staffSlips.length === 0 && staff.salary > 0) {
                adjustedSalary = staff.salary;
                adjustedRemaining = staff.salary;
            }

            const paidCount = staffSlips.filter(s => s.status === 'paid').length;
            const partialCount = staffSlips.filter(s => s.status === 'partial').length;
            const pendingCount = staffSlips.filter(s => s.status === 'pending').length;
            const hasSlips = staffSlips.length > 0;

            const recentPayments = staffExpenses
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(e => ({
                    _id: e._id,
                    amount: e.amount,
                    paymentMethod: e.paymentMethod,
                    date: e.createdAt,
                    status: e.status
                }));

            const months = staffSlips.map(s => ({
                monthYear: s.monthYear,
                totalAmount: s.totalAmount,
                paidAmount: s.paidAmount,
                remainingAmount: s.remainingAmount,
                status: s.status,
                paidPercentage: s.totalAmount > 0
                    ? Math.round((s.paidAmount / s.totalAmount) * 100 * 100) / 100
                    : 0
            }));

            return {
                staff: {
                    _id: staff._id,
                    name: staff.name,
                    email: staff.email,
                    role: staff.role,
                    employeeId: staff.employeeId,
                    joiningDate: staff.joiningDate,
                    department: staff.department,
                    baseSalary: staff.salary || 0
                },
                summary: {
                    totalSalary: Math.round(adjustedSalary * 100) / 100,
                    totalPaid: Math.round(totalPaidAmount * 100) / 100,
                    totalRemaining: Math.round(adjustedRemaining * 100) / 100,
                    paidCount,
                    partialCount,
                    pendingCount,
                    hasSlips,
                    collectionRate: adjustedSalary > 0
                        ? Math.round((totalPaidAmount / adjustedSalary) * 100 * 100) / 100
                        : 0
                },
                recentPayments,
                months
            };
        });

        let filteredEntries = ledgerEntries;
        if (status) {
            if (status === 'paid') {
                filteredEntries = ledgerEntries.filter(e => e.summary.paidCount > 0 && e.summary.totalRemaining === 0);
            } else if (status === 'partial') {
                filteredEntries = ledgerEntries.filter(e => e.summary.partialCount > 0 && e.summary.totalRemaining > 0);
            } else if (status === 'pending') {
                filteredEntries = ledgerEntries.filter(e => e.summary.pendingCount > 0 || !e.summary.hasSlips);
            }
        }

        const paginatedEntries = filteredEntries.slice(0, Number(limit));

        const globalSummary = filteredEntries.reduce((acc, entry) => {
            acc.totalStaff++;
            acc.totalSalary += entry.summary.totalSalary;
            acc.totalPaid += entry.summary.totalPaid;
            acc.totalRemaining += entry.summary.totalRemaining;
            acc.fullyPaidCount += entry.summary.paidCount > 0 && entry.summary.totalRemaining === 0 ? 1 : 0;
            acc.partialCount += entry.summary.partialCount > 0 && entry.summary.totalRemaining > 0 ? 1 : 0;
            acc.pendingCount += entry.summary.pendingCount > 0 || !entry.summary.hasSlips ? 1 : 0;
            return acc;
        }, {
            totalStaff: 0,
            totalSalary: 0,
            totalPaid: 0,
            totalRemaining: 0,
            fullyPaidCount: 0,
            partialCount: 0,
            pendingCount: 0
        });

        res.status(200).json({
            success: true,
            pagination: {
                total: filteredEntries.length,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(filteredEntries.length / Number(limit))
            },
            globalSummary: {
                ...globalSummary,
                collectionRate: globalSummary.totalSalary > 0
                    ? Math.round((globalSummary.totalPaid / globalSummary.totalSalary) * 100 * 100) / 100
                    : 0
            },
            data: paginatedEntries
        });

    } catch (error) {
        console.error("Error getting staff ledger summary:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createSalarySlip,
    recordSalaryPayment,
    updateSalarySlip,
    deleteSalarySlip,
    getTeacherSlips,
    getSalarySlipById,
    getTeachersSalaryStatus,
    getTeacherSalaryHistory,
    getSchoolSalarySummary,
    getStaffLedgerSummary
};