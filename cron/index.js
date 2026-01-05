const cron = require("node-cron");
const propertyModel = require("../models/property.model");
const { deleteFileFromS3 } = require("../services/s3.service");

// Property expiration cron (every hour)
cron.schedule("0 * * * *", async () => {
    try {
        console.log("⏰ Running property expiration check...");
        const now = new Date();
        const expiredProps = await propertyModel.find({ expiresAt: { $lt: now } });

        for (let prop of expiredProps) {
            for (let imgUrl of prop.images) {
                await deleteFileFromS3(imgUrl);
            }

            await propertyModel.findByIdAndDelete(prop._id);
            console.log(`✅ Deleted expired property: ${prop._id}`);
        }
        
        console.log(`✅ Property expiration check completed. Deleted: ${expiredProps.length}`);
    } catch (err) {
        console.error("❌ Error cleaning expired properties:", err);
    }
});

// Import complaint auto-delete cron
require("./complaintAutoDelete");

console.log("✅ All cron jobs scheduled successfully!");