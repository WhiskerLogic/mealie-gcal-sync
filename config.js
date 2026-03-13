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

module.exports = { MEALIE_URL, MEALIE_PUBLIC_URL, CALENDAR_ID, calendar, headers };
