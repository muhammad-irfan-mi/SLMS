const cron = require("node-cron");
const ComplaintFeedback = require("../models/ComplaintFeedback");

// Run every hour to auto-delete expired entries
cron.schedule("0 * * * *", async () => {
    try {
        console.log("⏰ Starting complaint/feedback auto-delete job...");
        
        const now = new Date();
        
        // Find all entries where autoDeleteAt is in the past
        const entriesToDelete = await ComplaintFeedback.find({
            autoDeleteAt: { $lt: now }
        });

        console.log(`🗑️ Found ${entriesToDelete.length} entries to auto-delete`);

        // Delete all expired entries at once
        if (entriesToDelete.length > 0) {
            const deleteResult = await ComplaintFeedback.deleteMany({
                autoDeleteAt: { $lt: now }
            });
            
            console.log(`✅ Auto-deleted ${deleteResult.deletedCount} entries`);
            
            // Log what was deleted
            entriesToDelete.forEach(entry => {
                console.log(`   - ${entry.type}: "${entry.title}" (Created: ${entry.createdAt.toDateString()})`);
            });
        } else {
            console.log("✅ No entries to auto-delete at this time");
        }

    } catch (err) {
        console.error("❌ Error in auto-delete cron job:", err);
    }
});

console.log("✅ Complaint auto-delete cron job scheduled (runs every hour)");