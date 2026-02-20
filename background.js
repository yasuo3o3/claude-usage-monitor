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

        const utilization = usage.five_hour.utilization || 0;
        updateBadgeFromUtilization(utilization);

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

function updateBadgeFromUtilization(utilization) {
    if (utilization > 80) {
        chrome.action.setBadgeText({ text: Math.round(utilization).toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
    } else if (utilization > 50) {
        chrome.action.setBadgeText({ text: Math.round(utilization).toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#FFC107' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

function updateBadge(text, color) {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
}
