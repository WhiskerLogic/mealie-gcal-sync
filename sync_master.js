const axios = require('axios');
const { MEALIE_URL, MEALIE_PUBLIC_URL, CALENDAR_ID, DEDUPE_SAME_MEAL_TYPE, calendar, headers, buildEventTimes, getCalendarTimezone } = require('./config');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function syncMaster() {
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + 14);

    const startStr = now.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    console.log(`🔄 Master Sync: ${startStr} to ${endStr}`);

    const timezone = await getCalendarTimezone();
    console.log(`🕐 Using timezone: ${timezone}`);

    // --- FETCH DATA ---
    const mealieRes = await axios.get(`${MEALIE_URL}/api/households/mealplans`, {
        params: { start_date: startStr, end_date: endStr }, headers
    });
    let mealiePlans = mealieRes.data.items || [];

    if (DEDUPE_SAME_MEAL_TYPE) {
        mealiePlans = dedupeMealPlans(mealiePlans);
    }

    const gRes = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: new Date(startStr).toISOString(),
        timeMax: new Date(endStr).toISOString(),
        singleEvents: true
    });
    const gEvents = gRes.data.items || [];
    const processedGCalIds = new Set();

    // --- STEP 1: MATCHING & UPDATING ---
    for (const plan of mealiePlans) {
        try {
            const planDate = plan.date; 
            const planName = plan.recipe?.name || plan.title || plan.note || "Meal Plan Entry";
            
            const existingGCalEvent =
                gEvents.find(g => !processedGCalIds.has(g.id) && g.extendedProperties?.private?.mealie_meal_id === String(plan.id)) ||
                gEvents.find(g => !processedGCalIds.has(g.id) && g.description?.includes(`MEALIE_ID: ${plan.id}`));

            if (existingGCalEvent) {
                processedGCalIds.add(existingGCalEvent.id);
                if (existingGCalEvent.summary !== planName) {
                    console.log(`📝 Updating GCal title: ${planName}`);
                    await calendar.events.patch({
                        calendarId: CALENDAR_ID,
                        eventId: existingGCalEvent.id,
                        resource: { summary: planName }
                    });
                    await delay(200);
                }
            } else if (planName) {
                console.log(`⬆️  Pushing new entry to GCal: ${planName} (${planDate}, ${plan.entryType || 'all-day'})`);
                const newEv = await calendar.events.insert({
                    calendarId: CALENDAR_ID,
                    resource: {
                        summary: planName,
                        description: plan.recipe ? MEALIE_PUBLIC_URL + '/g/home/r/' + plan.recipe.slug : '',
                        extendedProperties: { private: { mealie_meal_id: String(plan.id) } },
                        ...buildEventTimes(planDate, plan.entryType, timezone),
                    }
                });
                processedGCalIds.add(newEv.data.id);
                await delay(200); // 🛑 Prevents ENETUNREACH
            }
        } catch (e) {
            console.error(`⚠️ Error processing Mealie Plan ${plan.id}: ${e.message}`);
        }
    }

    // --- STEP 2: CLEANUP ORPHANS ---
    for (const gEv of gEvents) {
        try {
            if (processedGCalIds.has(gEv.id)) continue;
            const isFromMealie = gEv.extendedProperties?.private?.mealie_meal_id || gEv.description?.includes("MEALIE_ID:");
            if (isFromMealie) {
                console.log(`🗑️  Removing orphaned GCal event: ${gEv.summary}`);
                await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: gEv.id });
                await delay(200);
            }
        } catch (e) {
            console.error(`⚠️ Error deleting event ${gEv.id}: ${e.message}`);
        }
    }

    // --- STEP 3: DOWNLOAD (GCal -> Mealie) ---
    for (const gEv of gEvents) {
        try {
            if (processedGCalIds.has(gEv.id)) continue;
            
            const gDate = gEv.start.date || gEv.start.dateTime?.split('T')[0];
            const isFromMealie = gEv.extendedProperties?.private?.mealie_meal_id || gEv.description?.includes("MEALIE_ID:");
            const alreadyInMealie = mealiePlans.find(p => p.date === gDate);

            if (!isFromMealie && !alreadyInMealie) {
                console.log(`⬇️  Partner added: "${gEv.summary}". Importing to Mealie...`);
                
                const desc = gEv.description || "";
                const urlMatch = desc.match(/https?:\/\/[^\s"<>]+/);
                let recipeUrl = urlMatch ? urlMatch[0] : null;

                if (recipeUrl?.includes('google.com/url?q=')) {
                    recipeUrl = new URL(recipeUrl).searchParams.get('q').split('&')[0];
                }

                let payload = { date: gDate, entryType: "dinner" };

                if (recipeUrl) {
                    const libRes = await axios.get(`${MEALIE_URL}/api/recipes?per_page=500`, { headers });
                    const existing = libRes.data.items.find(r => r.recipeSource === recipeUrl);

                    if (existing) {
                        payload.recipeId = existing.id;
                    } else {
                        try {
                            const scrapeRes = await axios.post(`${MEALIE_URL}/api/recipes/create/url`, { url: recipeUrl }, { headers });
                            await delay(2000); 
                            const details = await axios.get(`${MEALIE_URL}/api/recipes/${scrapeRes.data}`, { headers });
                            payload.recipeId = details.data.id;
                        } catch (e) {
                            payload.title = gEv.summary;
                            payload.note = `Source: ${recipeUrl}`;
                        }
                    }
                } else {
                    payload.title = gEv.summary;
                    payload.note = "Added via GCal";
                }

                await axios.post(`${MEALIE_URL}/api/households/mealplans`, payload, { headers });
                await delay(200);
            }
        } catch (e) {
            console.error(`⚠️ Error importing GCal event to Mealie: ${e.message}`);
        }
    }

    console.log("✨ Sync Finished.");
}

function dedupeMealPlans(plans) {
    const seen = new Set();
    const deduped = plans.filter(plan => {
        const recipeId = plan.recipe?.id;
        if (!recipeId) return true;
        const key = `${plan.date}|${plan.entryType}|${recipeId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const removed = plans.length - deduped.length;
    if (removed) console.log(`🔀 Deduped ${removed} duplicate meal(s) (same date + type + recipe)`);
    return deduped;
}

syncMaster().catch(console.error)
