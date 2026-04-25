const cron = require('node-cron');
const Staff = require('../models/Staff');
const Student = require('../models/Student');

const permanentlyDisableExpiredAccounts = async () => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const expiredStaff = await Staff.find({
            isActive: false,
            deactivatedAt: { $lt: sevenDaysAgo },
            isRestorable: true  
        });

        for (const staff of expiredStaff) {
            console.log(`Marking staff account as non-restorable: ${staff.email} (deactivated on ${staff.deactivatedAt})`);
            staff.isRestorable = false;
            await staff.save();
        }

        const expiredStudents = await Student.find({
            isActive: false,
            deactivatedAt: { $lt: sevenDaysAgo },
            isRestorable: true
        });

        for (const student of expiredStudents) {
            console.log(`Marking student account as non-restorable: ${student.email} (deactivated on ${student.deactivatedAt})`);
            student.isRestorable = false;
            await student.save();
        }

        if (expiredStaff.length > 0 || expiredStudents.length > 0) {
            console.log(`Marked ${expiredStaff.length} staff and ${expiredStudents.length} student accounts as non-restorable (Account NOT deleted from DB)`);
        } else {
            console.log(`No expired accounts to mark as non-restorable`);
        }

    } catch (error) {
        console.error("Error marking expired accounts as non-restorable:", error);
    }
};

const scheduleAccountCleanup = () => {
    cron.schedule('0 0 * * *', async () => {
        console.log('Running account cleanup job...');
        await permanentlyDisableExpiredAccounts();
    });
    console.log('✅ Account cleanup job scheduled to run daily at midnight');
};

module.exports = { scheduleAccountCleanup };