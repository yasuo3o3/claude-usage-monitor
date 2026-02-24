const ALARM_NAME = 'fetch_usage';
const API_BASE = 'https://claude.ai/api';

chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });


chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        fetchUsageData();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'refresh') {
        fetchUsageData().then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep the message channel open for async response
    }
});

chrome.runtime.onInstalled.addListener(() => {

    fetchUsageData();
});

async function fetchUsageData() {
    try {
        const org = await getOrganization();
        if (!org) {
            updateBadge('!', '#FF0000');
            return;
        }

        const usage = await getUsage(org.uuid);
        if (!usage) {
            updateBadge('!', '#FF0000');
            return;
        }

        await chrome.storage.local.set({
            org: org,
            usage: usage,
            lastUpdated: new Date().toISOString()
        });

        updateBadgeFromUtilization(usage);

    } catch (error) {
        console.error('Failed to fetch data:', error);
        updateBadge('!', '#FF0000');
    }
}

async function getOrganization() {
    try {
        const response = await fetch(`${API_BASE}/organizations`);
        if (!response.ok) throw new Error('Failed to fetch organizations');
        const orgs = await response.json();
        if (!orgs || orgs.length === 0) return null;
        return orgs[0];
    } catch (error) {
        console.error('Error fetching organization:', error);
        return null;
    }
}

async function getUsage(orgUuid) {
    try {
        const response = await fetch(`${API_BASE}/organizations/${orgUuid}/usage`);
        if (!response.ok) throw new Error('Failed to fetch usage');
        return await response.json();
    } catch (error) {
        console.error('Error fetching usage:', error);
        return null;
    }
}

let badgeIntervalId = null;

function updateBadgeFromUtilization(usage) {
    // Clear any existing interval
    if (badgeIntervalId) {
        clearInterval(badgeIntervalId);
        badgeIntervalId = null;
    }

    const fiveHourUtil = Math.round(usage.five_hour?.utilization || 0);
    const sevenDayUtil = Math.round(usage.seven_day?.utilization || 0);

    let showFiveHour = true;

    // Helper function to update actual badge API
    function renderBadge() {
        if (showFiveHour) {
            const color = getColorForUtilization(fiveHourUtil);
            // Hide badge if 0
            if (fiveHourUtil <= 50) {
                chrome.action.setBadgeText({ text: '' });
            } else {
                chrome.action.setBadgeText({ text: `H${fiveHourUtil}` });
                chrome.action.setBadgeBackgroundColor({ color: color });
            }
        } else {
            const color = getColorForUtilization(sevenDayUtil);
            if (sevenDayUtil <= 50) {
                chrome.action.setBadgeText({ text: '' });
            } else {
                chrome.action.setBadgeText({ text: `W${sevenDayUtil}` });
                chrome.action.setBadgeBackgroundColor({ color: color });
            }
        }
        showFiveHour = !showFiveHour;
    }

    // Initial render
    renderBadge();

    // Set interval to alternate every 15 seconds
    badgeIntervalId = setInterval(renderBadge, 15000);
}

function getColorForUtilization(utilization) {
    if (utilization > 80) return '#F44336'; // Red
    if (utilization > 50) return '#FFC107'; // Yellow
    return '#4CAF50'; // Green (though effectively hidden if <= 50)
}

function updateBadge(text, color) {
    if (badgeIntervalId) {
        clearInterval(badgeIntervalId);
        badgeIntervalId = null;
    }
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
}
