const axios = require('axios');
const { MEALIE_URL, CALENDAR_ID, calendar, headers } = require('./config');

async function wipeClean() {
    try {
        // 1. DELETE "UNNAMED MEAL" FROM CALENDAR
        console.log("📅 Searching for 'Unnamed Meal' in Calendar...");
        const gRes = await calendar.events.list({
            calendarId: CALENDAR_ID,
            q: 'Unnamed Meal'
        });

        const events = gRes.data.items || [];
        for (const event of events) {
            try {
                console.log(`🗑️ Removing Calendar event: ${event.summary}`);
                await calendar.events.delete({ 
                    calendarId: CALENDAR_ID, 
                    eventId: event.id 
                });
                // Small delay to avoid hitting API rate limits
                await new Promise(r => setTimeout(r, 200)); 
            } catch (e) {
                console.error(`⚠️ Failed to delete ${event.id}, skipping. Error: ${e.message}`);
                // Continue to the next event even if this one fails
                continue;
            }
        }

        console.log("✨ Cleanup Finished.");
    } catch (err) {
        console.error("❌ Cleanup failed:", err.response?.data || err.message);
    }
}

wipeClean();
