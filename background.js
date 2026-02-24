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
            updateBadge('!', '#888888');
            return;
        }

        const usage = await getUsage(org.uuid);
        if (!usage) {
            updateBadge('!', '#888888');
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
        updateBadge('!', '#888888');
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

function calculateExpectedUtilization(resetsAt, totalWindowHours) {
    if (!resetsAt) return null;

    const resetDate = new Date(resetsAt);
    const now = new Date();
    const diffMs = resetDate - now;

    if (diffMs <= 0) return null;

    const totalWindowMs = totalWindowHours * 60 * 60 * 1000;
    const timeRemainingMs = diffMs;
    const timeElapsedMs = totalWindowMs - timeRemainingMs;

    if (timeElapsedMs <= 0) return null;

    return (timeElapsedMs / totalWindowMs) * 100;
}

function getFiveHourBadgeData(utilization, resetsAt) {
    const expected = calculateExpectedUtilization(resetsAt, 5);

    if (expected === null) {
        if (utilization >= 100) return { color: '#F44336', show: true };
        if (utilization >= 90) return { color: '#FFC107', show: true };
        return { show: false };
    }

    if (utilization < 60) return { show: false };

    const paceRatio = utilization / expected;
    if (paceRatio > 1.0) return { color: '#F44336', show: true };
    return { color: '#FFC107', show: true };
}

function getSevenDayBadgeData(utilization, resetsAt) {
    const expected = calculateExpectedUtilization(resetsAt, 168);

    if (expected === null) {
        if (utilization >= 100) return { color: '#F44336', show: true };
        if (utilization >= 80) return { color: '#FFC107', show: true };
        return { show: false };
    }

    const paceRatio = utilization / expected;
    if (paceRatio <= 0.8) return { show: false };
    if (paceRatio > 1.0) return { color: '#F44336', show: true };
    return { color: '#FFC107', show: true };
}

function updateBadgeFromUtilization(usage) {
    // Clear any existing interval
    if (badgeIntervalId) {
        clearInterval(badgeIntervalId);
        badgeIntervalId = null;
    }

    const fiveHourUtil = Math.round(usage.five_hour?.utilization || 0);
    const fiveHourResetsAt = usage.five_hour?.resets_at || null;
    const sevenDayUtil = Math.round(usage.seven_day?.utilization || 0);
    const sevenDayResetsAt = usage.seven_day?.resets_at || null;

    let showFiveHour = true;

    // Helper function to update actual badge API
    function renderBadge() {
        if (showFiveHour) {
            const badgeData = getFiveHourBadgeData(fiveHourUtil, fiveHourResetsAt);
            if (!badgeData.show) {
                chrome.action.setBadgeText({ text: '' });
            } else {
                chrome.action.setBadgeText({ text: `H${fiveHourUtil}` });
                chrome.action.setBadgeBackgroundColor({ color: badgeData.color });
            }
        } else {
            const badgeData = getSevenDayBadgeData(sevenDayUtil, sevenDayResetsAt);
            if (!badgeData.show) {
                chrome.action.setBadgeText({ text: '' });
            } else {
                chrome.action.setBadgeText({ text: `W${sevenDayUtil}` });
                chrome.action.setBadgeBackgroundColor({ color: badgeData.color });
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
