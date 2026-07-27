// src/scripts/generateDummyData.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import all models
const School = require('../models/School');
const Staff = require('../models/Staff');
const Student = require('../models/Student');
const ClassSection = require('../models/ClassSection');
const Subject = require('../models/Subject');
const Schedule = require('../models/Schedule');
const ExamSchedule = require('../models/ExamSchedule');
const Result = require('../models/Result');
const FeeDetail = require('../models/FeeDetail');
const FeePayment = require('../models/FeePayment');
const Expense = require('../models/Expense');
const SalarySlip = require('../models/SalarySlip');
const Attendance = require('../models/Attendance').default || require('../models/Attendance');
const Leave = require('../models/Leave');
const BankAccount = require('../models/BankAccount');
const CashAccount = require('../models/CashAccount');
const FeeComponent = require('../models/FeeComponent');
const SliderImage = require('../models/SliderImage');
const Event = require('../models/Event');

// Import enums
const ENUMS = require('../config/enums.config');

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    classes: ['Play Group', 'Nursery', 'Prep', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'],
    sections: ['A', 'B', 'C'],
    subjects: [
        'English', 'Urdu', 'Mathematics', 'Science', 'Social Studies',
        'Computer Science', 'Islamiat', 'Physics', 'Chemistry', 'Biology',
        'Software Engineering', 'Database', 'Networking'
    ],
    studentsPerClass: 10,
    totalStaff: 30,
    months: [
        '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
        '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
        '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
        '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
        '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
    ],
    numBankAccounts: 5,
    numSliders: 30,
    numEvents: 50,
    attendanceDays: 30,
    leaveCount: 300,
    examTypes: ['midterm', 'final'],
    expenseCount: 300,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateEmail = (name, type) => {
    const cleanName = name.toLowerCase().replace(/\s/g, '.');
    return `${cleanName}${getRandomNumber(1, 999)}@${type}.com`;
};

const generatePhone = () => `03${getRandomNumber(0, 9)}${getRandomNumber(0, 9)}${getRandomNumber(0, 9)}${getRandomNumber(0, 9)}${getRandomNumber(0, 9)}${getRandomNumber(0, 9)}${getRandomNumber(0, 9)}${getRandomNumber(0, 9)}`;

const generateCNIC = () => {
    const part1 = getRandomNumber(10000, 99999);
    const part2 = getRandomNumber(1000000, 9999999);
    const part3 = getRandomNumber(1, 9);
    return `${part1}-${part2}-${part3}`;
};

const generateRollNo = (index) => String(index + 1).padStart(4, '0');
const generateRegistrationNumber = (year, index) => `REG-${year}-${String(index + 1).padStart(4, '0')}`;
const generateTime = (hourMin, hourMax) => {
    const hour = getRandomNumber(hourMin, hourMax);
    const minute = getRandomNumber(0, 59);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

// ============================================================
// PASSWORD HELPER - Matches auth controller
// ============================================================
const DEFAULT_PASSWORD = 'Password@123'; // Matches validation: 8+ chars, uppercase, lowercase, number, special

// Password validation (same as auth controller)
const validatePassword = (password) => {
    const errors = [];

    if (password.length < 8) {
        errors.push("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
        errors.push("Password must contain at least one number");
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push("Password must contain at least one special character (!@#$%^&*)");
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

// Hash password using bcrypt (same as auth controller)
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

// ============================================================
// MAIN GENERATOR
// ============================================================
class DummyDataGenerator {
    constructor() {
        this.schoolId = null;
        this.classMap = new Map();
        this.subjectMap = new Map();
        this.teacherIds = [];
        this.studentIds = [];
        this.bankAccountIds = [];
        this.cashAccountId = null;
        this.feeComponentIds = [];
        this.sliderIds = [];
        this.eventIds = [];
        this.teacherSalaryMap = new Map();
        this.hasherPassword = null;
    }

    // STEP 1: Create School (with password already set)
    async createSchool() {
        console.log('🏫 Creating School...');

        // School has password set (verified = true, password exists)
        const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

        const school = await School.create({
            name: faker.company.name() + ' School System',
            address: faker.location.streetAddress() + ', ' + faker.location.city(),
            email: faker.internet.email(),
            phone: generatePhone(),
            cnic: generateCNIC(),
            schoolId: 'SCH-' + faker.string.alphanumeric(6).toUpperCase(),
            verified: true,
            isDeleted: false,
            noOfStudents: 0,
            remainVideo: 2,
            password: hashedPassword, // Password already set
            permissions: [
                'classsection', 'staff', 'fees', 'student', 'subject',
                'slider', 'socialmedia', 'salary', 'expenses', 'reports',
                'bankaccount', 'cash', 'schedule', 'result', 'examschedule',
                'attendance', 'leave'
            ]
        });
        this.schoolId = school._id;
        console.log(`✅ School created: ${school.name} (ID: ${this.schoolId})`);
        console.log(`   Email: ${school.email}`);
        console.log(`   Password: ${DEFAULT_PASSWORD}`);
        console.log(`   School ID: ${school.schoolId}`);
        return school;
    }

    // STEP 2: Create Class Sections
    async createClassSections() {
        console.log('📚 Creating Class Sections...');
        const classSections = [];
        let order = 0;

        for (const className of CONFIG.classes) {
            const sections = CONFIG.sections.map(name => ({ name }));
            const classSection = await ClassSection.create({
                school: this.schoolId,
                class: className,
                order: order++,
                fee: getRandomNumber(2000, 8000),
                sections: sections
            });
            classSections.push(classSection);
            this.classMap.set(className, {
                id: classSection._id
            });
        }
        console.log(`✅ Created ${classSections.length} classes with sections`);
        return classSections;
    }

    // STEP 3: Create Subjects
    async createSubjects() {
        console.log('📖 Creating Subjects...');
        const subjects = [];
        const classNames = Array.from(this.classMap.keys());

        for (const subjectName of CONFIG.subjects) {
            const className = getRandomItem(classNames);
            const classData = this.classMap.get(className);

            const classDoc = await ClassSection.findById(classData.id);
            if (!classDoc || !classDoc.sections || classDoc.sections.length === 0) continue;

            const section = getRandomItem(classDoc.sections);
            const sectionId = section._id;

            const subject = await Subject.create({
                school: this.schoolId,
                name: subjectName,
                code: subjectName.substring(0, 4).toUpperCase() + getRandomNumber(10, 99),
                classId: classData.id,
                sectionId: sectionId,
                isActive: true
            });
            subjects.push(subject);
            this.subjectMap.set(subjectName, subject._id);
        }
        console.log(`✅ Created ${subjects.length} subjects`);
        return subjects;
    }

    // STEP 4: Create Fee Components
    async createFeeComponents() {
        console.log('💰 Creating Fee Components...');
        const feeComponents = [];
        const componentNames = ['Tuition Fee', 'Transport Fee', 'Library Fee', 'Maintenance Fee', 'Examination Fee'];

        for (const name of componentNames) {
            const component = await FeeComponent.create({
                school: this.schoolId,
                name: name,
                code: name.substring(0, 4).toUpperCase() + getRandomNumber(10, 99),
                category: getRandomItem(ENUMS.FEE_COMPONENT_CATEGORIES.ALL),
                billingType: getRandomItem(ENUMS.FEE_COMPONENT_BILLING_TYPES.ALL),
                isCustomizable: Math.random() > 0.5,
                defaultAmount: getRandomNumber(500, 5000),
                isRequired: true,
                status: getRandomItem(ENUMS.FEE_COMPONENT_STATUSES.ALL),
                description: faker.lorem.sentence()
            });
            feeComponents.push(component);
            this.feeComponentIds.push(component._id);
        }
        console.log(`✅ Created ${feeComponents.length} fee components`);
        return feeComponents;
    }

    // STEP 5: Create Staff (verified = true, password set)
    async createStaff() {
        console.log('👨‍🏫 Creating Staff Members...');
        const staff = [];
        const classNames = Array.from(this.classMap.keys());
        const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

        // Create admin (verified = true, password set)
        const admin = await Staff.create({
            school: this.schoolId,
            name: faker.person.fullName(),
            email: generateEmail('admin', 'school'),
            phone: generatePhone(),
            address: faker.location.streetAddress(),
            cnic: generateCNIC(),
            role: ENUMS.STAFF_ROLES.ADMIN_OFFICE,
            salary: 80000,
            joiningDate: faker.date.past({ years: 2 }),
            isActive: true,
            isIncharge: false,
            verified: true,
            password: hashedPassword,
            images: {
                cnicFront: 'https://example.com/cnic-front.jpg',
                cnicBack: 'https://example.com/cnic-back.jpg',
                recentPic: 'https://example.com/profile.jpg'
            }
        });
        staff.push(admin);
        console.log(`   Admin: ${admin.email} / ${DEFAULT_PASSWORD}`);

        // Create teachers (verified = true, password set)
        const teachersToCreate = CONFIG.totalStaff - 1;
        for (let i = 0; i < teachersToCreate; i++) {
            const name = faker.person.fullName();
            const isIncharge = i < 5;
            const className = getRandomItem(classNames);
            const classData = this.classMap.get(className);

            const classDoc = await ClassSection.findById(classData.id);
            if (!classDoc || !classDoc.sections || classDoc.sections.length === 0) {
                console.log(`⚠️ No sections found for class: ${className}, skipping...`);
                continue;
            }

            const section = getRandomItem(classDoc.sections);
            const sectionId = section._id;
            const sectionName = section.name || 'A';

            const salary = getRandomNumber(25000, 80000);
            const teacher = await Staff.create({
                school: this.schoolId,
                name: name,
                email: generateEmail(name, 'school'),
                phone: generatePhone(),
                address: faker.location.streetAddress(),
                cnic: generateCNIC(),
                role: ENUMS.STAFF_ROLES.TEACHER,
                salary: salary,
                joiningDate: faker.date.past({ years: 2 }),
                isActive: true,
                isIncharge: isIncharge,
                classInfo: { id: classData.id, name: className },
                sectionInfo: { id: sectionId, name: sectionName },
                verified: true,
                password: hashedPassword,
                images: {
                    cnicFront: 'https://example.com/cnic-front.jpg',
                    cnicBack: 'https://example.com/cnic-back.jpg',
                    recentPic: 'https://example.com/profile.jpg'
                }
            });
            staff.push(teacher);
            this.teacherIds.push(teacher._id);
            this.teacherSalaryMap.set(teacher._id.toString(), salary);

            if (i < 5) {
                console.log(`   Teacher: ${teacher.email} / ${DEFAULT_PASSWORD}`);
            }
        }
        console.log(`✅ Created ${staff.length} staff members (${this.teacherIds.length} teachers)`);
        console.log(`   All staff password: ${DEFAULT_PASSWORD}`);
        return staff;
    }

    // STEP 6: Create Students (verified = true, password set)
    async createStudents() {
        console.log('🧑‍🎓 Creating Students...');
        const students = [];
        const classNames = Array.from(this.classMap.keys());
        const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

        for (const className of classNames) {
            const classData = this.classMap.get(className);
            const classDoc = await ClassSection.findById(classData.id);

            if (!classDoc || !classDoc.sections || classDoc.sections.length === 0) {
                console.log(`⚠️ No sections found for class: ${className}, skipping...`);
                continue;
            }

            for (const section of classDoc.sections) {
                const sectionId = section._id;
                const sectionName = section.name || 'A';
                const count = CONFIG.studentsPerClass;

                for (let i = 0; i < count; i++) {
                    const name = faker.person.fullName();
                    const student = await Student.create({
                        school: this.schoolId,
                        name: name,
                        username: name.toLowerCase().replace(/\s/g, '.') + getRandomNumber(1, 999),
                        email: generateEmail(name, 'student'),
                        phone: generatePhone(),
                        address: faker.location.streetAddress(),
                        cnic: generateCNIC(),
                        rollNo: generateRollNo(i),
                        registrationNumber: generateRegistrationNumber(2026, i),
                        classInfo: { id: classData.id, name: className },
                        sectionInfo: { id: sectionId, name: sectionName },
                        isActive: true,
                        isDefaulter: false,
                        role: ENUMS.USER_ROLES.STUDENT,
                        verified: true,
                        password: hashedPassword,
                        discount: Math.random() > 0.8 ? getRandomNumber(5, 20) : 0,
                        isFixed: false,
                        status: getRandomItem(ENUMS.STUDENT_STATUSES.ALL)
                    });
                    students.push(student);
                    this.studentIds.push(student._id);
                }
            }
        }
        await School.findByIdAndUpdate(this.schoolId, { noOfStudents: students.length });
        console.log(`✅ Created ${students.length} students`);
        console.log(`   All students password: ${DEFAULT_PASSWORD}`);
        return students;
    }

    // STEP 7: Create Multiple Bank & Cash Accounts
    async createAccounts() {
        console.log('💰 Creating Bank & Cash Accounts...');

        for (let i = 0; i < CONFIG.numBankAccounts; i++) {
            const bankAccount = await BankAccount.create({
                school: this.schoolId,
                accountNumber: faker.string.numeric(10),
                bankName: faker.company.name() + ' Bank',
                branchName: faker.location.city() + ' Branch',
                iban: 'PK' + faker.string.numeric(22),
                amount: getRandomNumber(500000, 2000000),
                isActive: true,
                createdBy: this.teacherIds[0] || this.schoolId
            });
            this.bankAccountIds.push(bankAccount._id);
        }

        const cashAccount = await CashAccount.create({
            school: this.schoolId,
            title: 'Main Cash Account',
            description: 'Default cash account for school operations',
            amount: getRandomNumber(100000, 500000),
            isActive: true,
            createdBy: this.teacherIds[0] || this.schoolId
        });
        this.cashAccountId = cashAccount._id;

        console.log(`✅ Created ${this.bankAccountIds.length} Bank accounts and 1 Cash account`);
        return { bankAccountIds: this.bankAccountIds, cashAccount };
    }

    // STEP 8: Create Schedules
    async createSchedules() {
        console.log('📅 Creating Schedules...');
        const schedules = [];
        const classNames = Array.from(this.classMap.keys());

        for (const className of classNames) {
            const classData = this.classMap.get(className);
            const classDoc = await ClassSection.findById(classData.id);

            if (!classDoc || !classDoc.sections || classDoc.sections.length === 0) {
                console.log(`⚠️ No sections found for class: ${className}, skipping schedules...`);
                continue;
            }

            for (const section of classDoc.sections) {
                const sectionId = section._id;

                const shuffledSubjects = [...this.subjectMap.values()].sort(() => Math.random() - 0.5);
                const assignedSubjects = shuffledSubjects.slice(0, 6);

                for (const subjectId of assignedSubjects) {
                    const teacherId = getRandomItem(this.teacherIds);
                    const days = ENUMS.DAYS.ALL.slice(0, 5);
                    for (let d = 0; d < 3 && d < days.length; d++) {
                        const schedule = await Schedule.create({
                            school: this.schoolId,
                            classId: classData.id,
                            sectionId: sectionId,
                            subjectId: subjectId,
                            teacherId: teacherId,
                            day: days[d],
                            type: getRandomItem(ENUMS.SCHEDULE_TYPES.ALL),
                            startTime: generateTime(8, 12),
                            endTime: generateTime(9, 14),
                            isActive: true
                        });
                        schedules.push(schedule);
                    }
                }
            }
        }
        console.log(`✅ Created ${schedules.length} schedules`);
        return schedules;
    }

    // STEP 9: Create Exam Schedules
    async createExamSchedules() {
        console.log('📝 Creating Exam Schedules...');
        const examSchedules = [];
        const classNames = Array.from(this.classMap.keys());

        for (const className of classNames) {
            const classData = this.classMap.get(className);
            const classDoc = await ClassSection.findById(classData.id);

            if (!classDoc || !classDoc.sections || classDoc.sections.length === 0) {
                console.log(`⚠️ No sections found for class: ${className}, skipping exam schedules...`);
                continue;
            }

            for (const section of classDoc.sections) {
                const sectionId = section._id;

                const shuffledSubjects = [...this.subjectMap.values()].sort(() => Math.random() - 0.5);
                const assignedSubjects = shuffledSubjects.slice(0, 4);

                for (const subjectId of assignedSubjects) {
                    const teacherId = getRandomItem(this.teacherIds);
                    for (const examType of CONFIG.examTypes) {
                        const examDate = faker.date.future({ years: 1 });
                        const day = ENUMS.DAYS.ALL[examDate.getDay() % 7];
                        const examSchedule = await ExamSchedule.create({
                            school: this.schoolId,
                            classId: classData.id,
                            sectionId: sectionId,
                            subjectId: subjectId,
                            teacherId: teacherId,
                            examDate: examDate,
                            day: day,
                            startTime: '09:00',
                            endTime: '11:00',
                            type: examType,
                            year: 2026,
                            totalMarks: 100,
                            status: getRandomItem(ENUMS.EXAM_STATUSES.ALL)
                        });
                        examSchedules.push(examSchedule);
                    }
                }
            }
        }
        console.log(`✅ Created ${examSchedules.length} exam schedules`);
        return examSchedules;
    }

    // STEP 10: Create Results
    async createResults() {
        console.log('📊 Creating Results...');
        const results = [];
        const studentSlice = this.studentIds.slice(0, Math.min(this.studentIds.length, 1000));

        for (const studentId of studentSlice) {
            const student = await Student.findById(studentId);
            if (!student) continue;

            for (const examType of CONFIG.examTypes) {
                const schedules = await Schedule.find({
                    school: this.schoolId,
                    classId: student.classInfo.id,
                    sectionId: student.sectionInfo.id
                }).lean();

                const subjectIds = schedules.map(s => s.subjectId).filter(Boolean);
                const uniqueSubjects = [...new Set(subjectIds.map(id => id.toString()))];
                const selectedSubjects = uniqueSubjects.slice(0, 4);

                if (selectedSubjects.length === 0) continue;

                const resultSubjects = [];
                for (const subjectId of selectedSubjects) {
                    const subject = await Subject.findById(subjectId);
                    resultSubjects.push({
                        subjectId: subjectId,
                        totalMarks: 100,
                        obtainedMarks: getRandomNumber(40, 100),
                        remarks: getRandomItem(['Good', 'Excellent', 'Needs Improvement', 'Outstanding', 'Satisfactory']),
                        subjectName: subject?.name || 'Unknown'
                    });
                }

                const totalMarks = resultSubjects.reduce((sum, s) => sum + s.totalMarks, 0);
                const obtainedMarks = resultSubjects.reduce((sum, s) => sum + s.obtainedMarks, 0);
                const percentage = ((obtainedMarks / totalMarks) * 100);

                let grade = 'F';
                if (percentage >= 90) grade = 'A+';
                else if (percentage >= 80) grade = 'A';
                else if (percentage >= 70) grade = 'B';
                else if (percentage >= 60) grade = 'C';
                else if (percentage >= 50) grade = 'D';

                const result = await Result.create({
                    school: this.schoolId,
                    studentId: studentId,
                    classId: student.classInfo.id,
                    sectionId: student.sectionInfo.id,
                    examType: examType,
                    year: 2026,
                    subjects: resultSubjects,
                    totalMarks: totalMarks,
                    obtainedMarks: obtainedMarks,
                    percentage: Math.round(percentage * 100) / 100,
                    grade: grade,
                    remarks: faker.lorem.sentence(),
                    createdBy: this.teacherIds[0]
                });
                results.push(result);
            }
        }
        console.log(`✅ Created ${results.length} results`);
        return results;
    }

    // STEP 11: Create Fees & Payments
    async createFeesAndPayments() {
        console.log('💰 Creating Fees & Payments...');
        const fees = [];
        const payments = [];

        const studentSlice = this.studentIds.slice(0, Math.min(this.studentIds.length, 1000));

        for (const studentId of studentSlice) {
            const student = await Student.findById(studentId);
            if (!student) continue;

            const monthsToCreate = CONFIG.months.slice(0, 6);
            for (const month of monthsToCreate) {
                const amount = getRandomNumber(3000, 8000);
                const discountAmount = Math.random() > 0.7 ? getRandomNumber(100, 500) : 0;
                const finalAmount = amount - discountAmount;
                const paidAmount = Math.random() > 0.2 ? finalAmount : getRandomNumber(1000, finalAmount - 1);
                const remainingAmount = finalAmount - paidAmount;
                const status = remainingAmount === 0 ? 'paid' :
                    (paidAmount > 0 ? 'partially_paid' : 'pending');

                const fee = await FeeDetail.create({
                    school: this.schoolId,
                    studentId: studentId,
                    month: month,
                    dueDate: faker.date.future({ years: 1 }),
                    finalAmount: finalAmount,
                    discountAmount: discountAmount,
                    paidAmount: paidAmount,
                    remainingAmount: remainingAmount,
                    title: `Monthly Fee - ${month}`,
                    description: `Fee for ${month}`,
                    status: status,
                    voucherNumber: `FV-${month.replace('-', '')}-${String(fees.length + 1).padStart(4, '0')}`,
                    discountApplied: discountAmount > 0 ? {
                        type: getRandomItem(ENUMS.DISCOUNT_TYPES.ALL),
                        value: discountAmount,
                        amount: discountAmount
                    } : undefined
                });
                fees.push(fee);

                if (paidAmount > 0) {
                    const paymentMethod = getRandomItem(ENUMS.PAYMENT_METHODS.ALL);
                    const bankAccountId = paymentMethod === 'bank' ? getRandomItem(this.bankAccountIds) : null;
                    const payment = await FeePayment.create({
                        school: this.schoolId,
                        feeId: fee._id,
                        studentId: studentId,
                        amount: paidAmount,
                        paymentMethod: paymentMethod,
                        bankAccountId: bankAccountId,
                        cashAccountId: paymentMethod === 'cash' ? this.cashAccountId : null,
                        status: getRandomItem(ENUMS.FEE_PAYMENT_STATUSES.ALL),
                        approvedBy: this.teacherIds[0] || this.schoolId,
                        approvedAt: new Date(),
                        proofImage: Math.random() > 0.8 ? 'https://example.com/payment-proof.jpg' : null
                    });
                    payments.push(payment);
                }
            }
        }
        console.log(`✅ Created ${fees.length} fees and ${payments.length} payments`);
        return { fees, payments };
    }

    // STEP 12: Create Expenses
    async createExpenses() {
        console.log('💸 Creating Expenses...');
        const expenses = [];
        const categories = ENUMS.EXPENSE_CATEGORIES.ALL;
        const statuses = ENUMS.EXPENSE_STATUSES.ALL;
        const paymentMethods = ENUMS.PAYMENT_METHODS.ALL;

        for (let i = 0; i < CONFIG.expenseCount; i++) {
            const paymentMethod = getRandomItem(paymentMethods);
            const bankAccountId = paymentMethod === 'bank' ? getRandomItem(this.bankAccountIds) : null;
            const expense = await Expense.create({
                school: this.schoolId,
                title: faker.company.catchPhrase(),
                description: faker.lorem.sentence(),
                category: getRandomItem(categories),
                amount: getRandomNumber(1000, 50000),
                date: faker.date.past({ years: 1 }),
                paymentMethod: paymentMethod,
                bankAccountId: bankAccountId,
                cashAccountId: paymentMethod === 'cash' ? this.cashAccountId : null,
                status: getRandomItem(statuses),
                approvedAt: new Date()
            });
            expenses.push(expense);
        }
        console.log(`✅ Created ${expenses.length} expenses`);
        return expenses;
    }

    // STEP 13: Create Salary Slips
    async createSalarySlips() {
        console.log('💳 Creating Salary Slips...');
        const salarySlips = [];
        const statuses = ENUMS.SALARY_SLIP_STATUSES.ALL;
        const paymentMethods = ENUMS.PAYMENT_METHODS.ALL;

        const allMonths = [];
        for (let year = 2024; year <= 2026; year++) {
            for (let month = 1; month <= 12; month++) {
                const monthStr = `${year}-${String(month).padStart(2, '0')}`;
                allMonths.push(monthStr);
            }
        }
        const salaryMonths = allMonths.slice(0, 12);

        for (const teacherId of this.teacherIds) {
            const teacher = await Staff.findById(teacherId);
            if (!teacher) continue;

            const totalSalary = this.teacherSalaryMap.get(teacherId.toString()) || teacher.salary || getRandomNumber(25000, 50000);

            for (const month of salaryMonths) {
                const paidAmount = Math.random() > 0.15 ? totalSalary : getRandomNumber(10000, totalSalary - 1);
                const remainingAmount = totalSalary - paidAmount;
                const status = remainingAmount === 0 ? 'paid' :
                    (paidAmount > 0 ? 'partial' : 'pending');

                const paymentMethod = getRandomItem(paymentMethods);
                const bankAccountId = paymentMethod === 'bank' ? getRandomItem(this.bankAccountIds) : null;
                const slip = await SalarySlip.create({
                    school: this.schoolId,
                    teacherId: teacherId,
                    monthYear: month,
                    title: `Salary - ${month}`,
                    description: `Monthly salary for ${month}`,
                    totalAmount: totalSalary,
                    paidAmount: paidAmount,
                    remainingAmount: remainingAmount,
                    status: status,
                    paymentHistory: paidAmount > 0 ? [{
                        amount: paidAmount,
                        paymentMethod: paymentMethod,
                        bankAccountId: bankAccountId,
                        cashAccountId: paymentMethod === 'cash' ? this.cashAccountId : null,
                        paidAt: new Date(),
                        approvedBy: this.teacherIds[0] || this.schoolId
                    }] : []
                });
                salarySlips.push(slip);
            }
        }
        console.log(`✅ Created ${salarySlips.length} salary slips`);
        return salarySlips;
    }

    // STEP 14: Create Attendance
    async createAttendance() {
        console.log('📋 Creating Attendance...');
        const attendance = [];
        const attendanceMap = new Map();
        const statuses = ENUMS.ATTENDANCE_STATUSES.ALL;

        const studentSlice = this.studentIds.slice(0, Math.min(this.studentIds.length, 200));

        for (const studentId of studentSlice) {
            const student = await Student.findById(studentId);
            if (!student) continue;

            const daysToCreate = getRandomNumber(20, CONFIG.attendanceDays);
            for (let d = 0; d < daysToCreate; d++) {
                const date = faker.date.recent({ days: 60 });
                const dateStr = date.toISOString().split('T')[0];

                const key = `${student.classInfo.id.toString()}-${student.sectionInfo.id.toString()}-${dateStr}`;

                if (!attendanceMap.has(key)) {
                    attendanceMap.set(key, {
                        school: this.schoolId,
                        classId: student.classInfo.id,
                        sectionId: student.sectionInfo.id,
                        teacherId: getRandomItem(this.teacherIds),
                        date: dateStr,
                        students: []
                    });
                }

                attendanceMap.get(key).students.push({
                    studentId: studentId,
                    name: student.name,
                    email: student.email,
                    status: getRandomItem(statuses)
                });
            }
        }

        for (const recordData of attendanceMap.values()) {
            try {
                const existing = await Attendance.findOne({
                    school: this.schoolId,
                    classId: recordData.classId,
                    sectionId: recordData.sectionId,
                    date: recordData.date
                });

                if (existing) {
                    existing.students.push(...recordData.students);
                    await existing.save();
                    attendance.push(existing);
                } else {
                    const record = await Attendance.create(recordData);
                    attendance.push(record);
                }
            } catch (error) {
                if (error.code === 11000) {
                    // Skip duplicate
                } else {
                    console.error('Error creating attendance:', error);
                }
            }
        }

        console.log(`✅ Created ${attendance.length} attendance records`);
        return attendance;
    }

    // STEP 15: Create Leaves
    async createLeaves() {
        console.log('📝 Creating Leaves...');
        const leaves = [];
        const leaveTypes = ENUMS.LEAVE_TYPES.ALL;
        const leaveStatuses = ENUMS.LEAVE_STATUSES.ALL;

        const allIds = [...this.studentIds, ...this.teacherIds];
        const totalToCreate = Math.min(CONFIG.leaveCount, allIds.length * 2);

        for (let i = 0; i < totalToCreate; i++) {
            const userId = getRandomItem(allIds);
            const isStudent = this.studentIds.includes(userId);
            const type = getRandomItem(leaveTypes);
            const dates = [];
            const startDate = faker.date.recent({ days: 90 });
            const numDays = getRandomNumber(1, 3);

            for (let d = 0; d < numDays; d++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + d);
                dates.push(date.toISOString().split('T')[0]);
            }

            const student = isStudent ? await Student.findById(userId) : null;
            const teacher = !isStudent ? await Staff.findById(userId) : null;

            const leave = await Leave.create({
                school: this.schoolId,
                [isStudent ? 'studentId' : 'teacherId']: userId,
                [isStudent ? 'studentName' : 'teacherName']: isStudent ? student?.name : teacher?.name,
                userType: isStudent ? 'student' : 'teacher',
                dates: dates,
                subject: faker.lorem.words(3),
                reason: faker.lorem.sentence(),
                status: getRandomItem(leaveStatuses),
                reviewedBy: getRandomItem(this.teacherIds) || null,
                reviewedAt: Math.random() > 0.5 ? new Date() : null,
                remark: Math.random() > 0.5 ? faker.lorem.sentence() : null
            });
            leaves.push(leave);
        }
        console.log(`✅ Created ${leaves.length} leave requests`);
        return leaves;
    }

    // STEP 16: Create Slider Images
    async createSliders() {
        console.log('🖼️ Creating Slider Images...');
        const sliders = [];
        const categories = ENUMS.SLIDER_CATEGORIES.ALL;
        const roles = ENUMS.UPLOADED_BY_ROLES.ALL;

        for (let i = 0; i < CONFIG.numSliders; i++) {
            const slider = await SliderImage.create({
                title: faker.lorem.words(3),
                caption: faker.lorem.sentence(),
                link: faker.internet.url(),
                order: i,
                active: Math.random() > 0.2,
                image: `https://picsum.photos/seed/${i}/800/400`,
                category: getRandomItem(categories),
                uploadedBy: this.teacherIds[0] || this.schoolId,
                school: Math.random() > 0.3 ? this.schoolId : null,
                uploadedByRole: getRandomItem(roles)
            });
            sliders.push(slider);
        }
        console.log(`✅ Created ${sliders.length} slider images`);
        return sliders;
    }

    // STEP 17: Create Events
    async createEvents() {
        console.log('📅 Creating Events...');
        const events = [];

        for (let i = 0; i < CONFIG.numEvents; i++) {
            const event = await Event.create({
                school: this.schoolId,
                title: faker.lorem.words(3),
                description: faker.lorem.sentence(),
                eventDate: faker.date.future({ years: 1 }),
                status: getRandomItem(ENUMS.EVENT_STATUSES.ALL),
                images: Math.random() > 0.5 ? [`https://picsum.photos/seed/${i + 100}/800/400`] : [],
                bannerImage: `https://picsum.photos/seed/${i + 200}/1200/400`,
                createdBy: this.teacherIds[0] || this.schoolId
            });
            events.push(event);
        }
        console.log(`✅ Created ${events.length} events`);
        return events;
    }

    // RUN ALL
    async generateAll() {
        console.log('\n🚀 Starting Dummy Data Generation...\n');
        const startTime = Date.now();

        try {
            const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/school_db';
            // await mongoose.connect(mongoURI);
            await mongoose.connect(mongoURI, {
                serverSelectionTimeoutMS: 1500000, // 60 seconds
                socketTimeoutMS: 60000,
                connectTimeoutMS: 60000,
                maxPoolSize: 10,
                minPoolSize: 2,
                retryWrites: true,
                retryReads: true,
            });
            console.log('✅ Connected to MongoDB\n');

            await this.createSchool();
            await this.createClassSections();
            await this.createSubjects();
            await this.createFeeComponents();
            await this.createStaff();
            await this.createStudents();
            await this.createAccounts();
            await this.createSchedules();
            await this.createExamSchedules();
            await this.createResults();
            await this.createFeesAndPayments();
            await this.createExpenses();
            await this.createSalarySlips();
            await this.createAttendance();
            await this.createLeaves();
            await this.createSliders();
            await this.createEvents();

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);

            console.log('\n✅ ALL DATA GENERATED SUCCESSFULLY!');
            console.log(`⏱️  Time taken: ${duration} seconds`);
            console.log(`🏫 School ID: ${this.schoolId}`);
            console.log(`🧑‍🎓 Total Students: ${this.studentIds.length}`);
            console.log(`👨‍🏫 Total Teachers: ${this.teacherIds.length}`);
            console.log(`📚 Total Classes: ${CONFIG.classes.length}`);
            console.log(`📖 Total Subjects: ${CONFIG.subjects.length}`);
            console.log('\n📊 Summary:');
            console.log(`   - Staff: ${this.teacherIds.length + 1}`);
            console.log(`   - Students: ${this.studentIds.length}`);
            console.log(`   - Results: ${await Result.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Fees: ${await FeeDetail.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Fee Payments: ${await FeePayment.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Expenses: ${await Expense.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Salary Slips: ${await SalarySlip.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Attendance: ${await Attendance.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Leaves: ${await Leave.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Schedules: ${await Schedule.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Exam Schedules: ${await ExamSchedule.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Bank Accounts: ${this.bankAccountIds.length}`);
            console.log(`   - Slider Images: ${await SliderImage.countDocuments({ school: this.schoolId })}`);
            console.log(`   - Events: ${await Event.countDocuments({ school: this.schoolId })}`);

            console.log('\n🔑 DEFAULT PASSWORD FOR ALL USERS:');
            console.log(`   ${DEFAULT_PASSWORD}`);
            console.log('   (School Admin, Teachers, Students all have the same password)');

            process.exit(0);
        } catch (error) {
            console.error('❌ Error generating data:', error);
            console.error('Stack:', error.stack);
            process.exit(1);
        }
    }
}

// ============================================================
// RUN
// ============================================================
if (require.main === module) {
    const generator = new DummyDataGenerator();
    generator.generateAll();
}

module.exports = DummyDataGenerator;