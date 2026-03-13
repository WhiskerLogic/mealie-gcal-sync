const axios = require('axios');
const { MEALIE_URL, CALENDAR_ID, calendar, headers } = require('./config');

async function runSync() {
    
    // activeScrapes maps URL -> Mealie ID to prevent creating duplicates 
    // during the same run before the database can finish saving.
    const activeScrapes = new Map(); 

    // Fetch calendar from 1 year ago to 1 year ahead
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 10);
    //timeMin.setFullYear(timeMin.getFullYear() - 1);

    console.log("📡 Fetching Google Calendar...");
    const gRes = await calendar.events.list({ 
        calendarId: CALENDAR_ID, 
        timeMin: timeMin.toISOString(), 
        singleEvents: true, 
        orderBy: 'startTime', 
        maxResults: 1000 
    });
    
    const events = gRes.data.items || [];
    console.log(`🚀 Found ${events.length} events. Starting Sync...`);

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const mealName = (event.summary || "Unnamed Meal").trim();
        const mealDate = event.start.date || event.start.dateTime.split('T')[0];
        
        // 1. EXTRACT & UNWRAP URL
        const desc = event.description || "";
        const urlMatch = desc.match(/https?:\/\/[^\s"<>]+/); 
        let recipeUrl = urlMatch ? urlMatch[0] : null;

        if (recipeUrl && recipeUrl.includes('google.com/url?q=')) {
            try {
                const urlObj = new URL(recipeUrl);
                recipeUrl = urlObj.searchParams.get('q').split('&')[0];
            } catch (e) { /* use original if unwrapping fails */ }
        }

        let payload = { date: mealDate, entryType: "dinner" };

        if (recipeUrl) {
            console.log(`🌐 [${i+1}/${events.length}] ${mealDate}: ${mealName}`);
            try {
                let recipeId = null;

                // 2. CHECK LOCAL MEMORY FIRST (Mutex)
                if (activeScrapes.has(recipeUrl)) {
                    recipeId = activeScrapes.get(recipeUrl);
                    console.log(`   ♻️  Using just-scraped recipe (ID: ${recipeId})`);
                } else {
                    // 3. CHECK REMOTE LIBRARY
                    const libRes = await axios.get(`${MEALIE_URL}/api/recipes?per_page=500`, { headers });
                    const existing = (libRes.data.items || []).find(r => r.recipeSource === recipeUrl);

                    if (existing) {
                        recipeId = existing.id;
                        activeScrapes.set(recipeUrl, recipeId);
                        console.log(`   📚 Found in Library (ID: ${recipeId})`);
                    } else {
                        // 4. SCRAPE NEW
                        console.log(`   🌐 Scraper triggered for: ${recipeUrl}`);
                        const scrapeRes = await axios.post(`${MEALIE_URL}/api/recipes/create/url`, 
                            { url: recipeUrl }, { headers }
                        );
                        const slug = scrapeRes.data;

                        // 5. POLL UNTIL READY (Mealie background task)
                        for (let attempt = 1; attempt <= 10; attempt++) {
                            await new Promise(r => setTimeout(r, 2000));
                            try {
                                const details = await axios.get(`${MEALIE_URL}/api/recipes/${slug}`, { headers });
                                if (details.data && details.data.id) {
                                    recipeId = details.data.id;
                                    activeScrapes.set(recipeUrl, recipeId);
                                    console.log(`   ✅ Scrape Complete (ID: ${recipeId})`);
                                    break;
                                }
                            } catch (e) { /* Still processing... */ }
                        }
                    }
                }

                if (recipeId) {
                    payload.recipeId = recipeId;
                } else {
                    throw new Error("Scrape timeout");
                }
            } catch (err) {
                console.log(`   ⚠️  Fallback to Note: ${err.message}`);
                payload.title = mealName;
                payload.note = `Source: ${recipeUrl}`;
            }
        } else {
            // No URL found at all
            console.log(`📄 [${i+1}/${events.length}] ${mealDate}: ${mealName} (No URL found)`);
            payload.title = mealName;
            payload.note = "GCal Sync";
        }

        // 6. POST TO MEAL PLANNER
        try {
            await axios.post(`${MEALIE_URL}/api/households/mealplans`, payload, { headers });
        } catch (e) {
            console.error(`   ❌ Failed to add to planner: ${e.message}`);
        }
    }
    console.log("\n✨ Sync Complete! Your Mealie library and planner are now perfectly matched.");
}

runSync().catch(err => console.error("FATAL ERROR:", err.message));