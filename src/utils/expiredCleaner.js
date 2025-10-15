const cron = require("node-cron");
const propertyModel = require("../models/property.model");
const { deleteFileFromS3 } = require("../services/s3.service");

// Run every hour
cron.schedule("0 * * * *", async () => {
    try {
        const now = new Date();
        const expiredProps = await propertyModel.find({ expiresAt: { $lt: now } });

        for (let prop of expiredProps) {
            for (let imgUrl of prop.images) {
                await deleteFileFromS3(imgUrl);
            }

            await Property.findByIdAndDelete(prop._id);

            console.log(`⏳ Deleted expired property: ${prop._id}`);
        }
    } catch (err) {
        console.error("Error cleaning expired properties:", err);
    }
});
