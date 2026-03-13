require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');

const MEALIE_URL = process.env.MEALIE_URL || 'http://127.0.0.1:9925';
const MEALIE_PUBLIC_URL = process.env.MEALIE_PUBLIC_URL || 'https://mealie.wooller.com';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const keyFile = process.env.GOOGLE_CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');
const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

const headers = { 'Authorization': `Bearer ${process.env.MEALIE_API_KEY}` };

const MEAL_TIMES = {
    breakfast: { time: '08:00', durationMinutes: 45 },
    lunch:    { time: '12:00', durationMinutes: 60 },
    dinner:   { time: '17:00', durationMinutes: 60 },
    snack:    { time: '15:00', durationMinutes: 30 },
};

function buildEventTimes(planDate, entryType, timezone) {
    const mealTime = MEAL_TIMES[entryType];
    if (!mealTime) {
        return { start: { date: planDate }, end: { date: planDate } };
    }
    const [h, m] = mealTime.time.split(':').map(Number);
    const endTotal = h * 60 + m + mealTime.durationMinutes;
    const endH = String(Math.floor(endTotal / 60) % 24).padStart(2, '0');
    const endM = String(endTotal % 60).padStart(2, '0');
    return {
        start: { dateTime: `${planDate}T${mealTime.time}:00`, timeZone: timezone },
        end:   { dateTime: `${planDate}T${endH}:${endM}:00`, timeZone: timezone },
    };
}

async function getCalendarTimezone() {
    try {
        const res = await calendar.calendars.get({ calendarId: CALENDAR_ID });
        return res.data.timeZone;
    } catch {
        return process.env.TZ || 'UTC';
    }
}

module.exports = {
    MEALIE_URL, MEALIE_PUBLIC_URL, CALENDAR_ID, calendar, headers,
    MEAL_TIMES, buildEventTimes, getCalendarTimezone,
};
