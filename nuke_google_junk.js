const { CALENDAR_ID, calendar } = require('./config');

async function nukeJunk() {
    
    console.log("🔍 Searching for 'Unnamed Meal' entries...");
    
    const res = await calendar.events.list({
        calendarId: CALENDAR_ID,
        q: 'Unnamed Meal', // Search query
        singleEvents: true,
        maxResults: 2500,
    });

    const events = res.data.items || [];
    const junkEvents = events.filter(e => e.summary === 'Unnamed Meal');

    console.log(`🧨 Found ${junkEvents.length} junk entries. Commencing deletion...`);

    for (const event of junkEvents) {
        try {
            await calendar.events.delete({
                calendarId: CALENDAR_ID,
                eventId: event.id,
            });
            console.log(`🗑️ Deleted: ${event.start.date || event.start.dateTime}`);
            // Small delay to respect Google's rate limits
            await new Promise(r => setTimeout(r, 200)); 
        } catch (err) {
            console.error(`❌ Failed to delete ${event.id}:`, err.message);
        }
    }
    console.log("✅ Cleanup complete!");
}

nukeJunk();
