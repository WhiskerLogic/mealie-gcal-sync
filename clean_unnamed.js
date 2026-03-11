const axios = require('axios');
const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

// --- CONFIG ---
const env = fs.readFileSync('/usr/local/bin/common_keys.txt', 'utf8');
const tokenMatch = env.match(/MEALIE_API_KEY=["']?([^"'\s]+)["']?/);
const MEALIE_TOKEN = tokenMatch ? tokenMatch[1].trim() : null;
const MEALIE_URL = "http://127.0.0.1:9925";
const headers = { 'Authorization': `Bearer ${MEALIE_TOKEN}` };

// Google Calendar Config
const CALENDAR_ID = 'd399fd6624bd772ba4cefdec02b2c9f9ac2bdc97db3bd556c072c8e57b0ad8b7@group.calendar.google.com';
const KEYFILEPATH = path.join(__dirname, 'credentials.json');
const auth = new google.auth.GoogleAuth({ keyFile: KEYFILEPATH, scopes: ['https://www.googleapis.com/auth/calendar'] });
const calendar = google.calendar({ version: 'v3', auth });

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
            console.log(`🗑️ Removing Calendar event: ${event.summary}`);
            await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: event.id });
        }

        console.log("✨ Cleanup Finished.");
    } catch (err) {
        console.error("❌ Cleanup failed:", err.response?.data || err.message);
    }
}

wipeClean();
