// const cron = require("node-cron");
// const Student = require("../models/Student");

// const startStudentCron = async () => {

//     cron.schedule("* * * * *", async () => {

//         try {
            
//             console.log("Running Student Cleanup Cron...");
            
//             const sevenDaysAgo = new Date(
//                 Date.now() - (7 * 24 * 60 * 60 * 1000)
//             );

//             const result = await Student.updateMany(
//                 {
//                     isActive: false,
//                     status: "active",
//                     isRestorable: true,
//                     deactivatedAt: {
//                         $lte: sevenDaysAgo
//                     }
//                 },
//                 {
//                     $set: {
//                         status: "left",
//                         isRestorable: false
//                     }
//                 }
//             );

//             console.log(
//                 `${result.modifiedCount} student(s) marked as LEFT`
//             );

//         } catch (err) {

//             console.error(
//                 "Student Cron Error:",
//                 err.message
//             );

//         }

//     });

// };

// module.exports = startStudentCron;










const cron = require("node-cron");
const Student = require("../models/Student");
const Staff = require("../models/Staff");

const updateInactiveUsers = async (Model, userType) => {
    const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const result = await Model.updateMany(
        {
            isActive: false,
            status: "active",
            isRestorable: true,
            deactivatedAt: {
                $lte: sevenDaysAgo
            }
        },
        {
            $set: {
                status: "left",
                isRestorable: false
            }
        }
    );

    console.log(
        `[CRON] ${userType}: ${result.modifiedCount} account(s) updated.`
    );
};

const startAccountCleanupCron = () => {

    console.log("✅ Account cleanup job scheduled.");

    // Production
    cron.schedule("* * * * *", async () => {

        console.log("[CRON] Running Account Cleanup...");

        try {

            await Promise.all([
                updateInactiveUsers(Student, "Student"),
                updateInactiveUsers(Staff, "Staff")
            ]);

            console.log("[CRON] Account Cleanup Completed.");

        } catch (err) {

            console.error("[CRON]", err.message);

        }

    });

};

module.exports = startAccountCleanupCron;