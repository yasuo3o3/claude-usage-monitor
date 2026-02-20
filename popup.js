const PLAN_MAP = {
    "default_claude_max_20x": { name: "Max 20x" },
    "default_claude_max_5x": { name: "Max 5x" },
    "default_claude_pro": { name: "Pro" },
    // "free" fallback
};

document.addEventListener('DOMContentLoaded', () => {
    updateUI();

    document.getElementById('refresh-btn').addEventListener('click', async () => {
        const btn = document.getElementById('refresh-btn');
        btn.classList.add('spinning');

        // Send message to background to refresh data
        try {
            await chrome.runtime.sendMessage({ action: 'refresh' });
            await updateUI();
        } catch (e) {
            console.error(e);
        } finally {
            // Minimum spin time for visual feedback
            setTimeout(() => {
                btn.classList.remove('spinning');
            }, 500);
        }
    });
});

async function updateUI() {
    const data = await chrome.storage.local.get(['org', 'usage', 'lastUpdated']);

    // Check if data exists
    if (!data.org || !data.usage) {
        // Try fetch once if missing (handled by background on install, but good fallback)
        // If still missing, show login warning
        // Actually, let's just check if we have data. If not, assume not logged in or error.
        document.getElementById('main-content').classList.add('hidden');
        document.getElementById('login-warning').classList.remove('hidden');
        document.getElementById('plan-badge').textContent = 'Unknown';
        return;
    }

    // Have data, show main content
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('login-warning').classList.add('hidden');

    const { org, usage, lastUpdated } = data;

    // Update Header
    updatePlanBadge(org.rate_limit_tier);

    // Update 5-Hour Session
    const fiveHour = usage.five_hour || {};
    updateProgressBar('five-hour', fiveHour.utilization || 0, fiveHour.resets_at);

    // Update Weekly (All)
    const sevenDay = usage.seven_day || {};
    updateProgressBar('seven-day', sevenDay.utilization || 0, sevenDay.resets_at);

    // Update Sonnet
    const sonnet = usage.seven_day_sonnet;
    if (sonnet) {
        document.getElementById('sonnet-section').classList.remove('hidden');
        updateProgressBar('sonnet', sonnet.utilization || 0, sonnet.resets_at);
    } else {
        document.getElementById('sonnet-section').classList.add('hidden');
    }

    // Update Opus
    const opus = usage.seven_day_opus;
    if (opus) {
        document.getElementById('opus-section').classList.remove('hidden');
        updateProgressBar('opus', opus.utilization || 0, opus.resets_at);
    } else {
        document.getElementById('opus-section').classList.add('hidden');
    }

    // Update Status Message (simple logic based on highest utilization)
    updateStatusMessage(usage);

    // Update Last Updated
    if (lastUpdated) {
        const date = new Date(lastUpdated);
        const timeStr = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('last-updated').textContent = `更新: ${timeStr}`;
    }
}


function updatePlanBadge(tier) {
    const badge = document.getElementById('plan-badge');
    const plan = PLAN_MAP[tier];

    if (plan) {
        badge.textContent = plan.name;
    } else {
        badge.textContent = 'Free';
    }
}

function updateProgressBar(idPrefix, utilization, resetsAt) {
    const bar = document.getElementById(`${idPrefix}-bar`);
    const valText = document.getElementById(`${idPrefix}-val`);
    const resetText = document.getElementById(`${idPrefix}-reset`);

    // Clamp utilization 0-100
    const pct = Math.min(100, Math.max(0, utilization));

    bar.style.width = `${pct}%`;
    valText.textContent = `${Math.round(pct)}%`;

    // Color logic
    if (pct > 80) {
        bar.style.backgroundColor = '#F44336'; // Red
    } else if (pct > 50) {
        bar.style.backgroundColor = '#FFC107'; // Yellow/Amber
    } else {
        bar.style.backgroundColor = '#4CAF50'; // Green
    }

    // Reset time logic
    if (resetsAt) {
        const resetDate = new Date(resetsAt);
        const now = new Date();
        const diffMs = resetDate - now;

        if (diffMs > 0) {
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const remMins = diffMins % 60;
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) {
                resetText.textContent = `${diffDays}日後にリセット`;
            } else if (diffHours > 0) {
                resetText.textContent = `${diffHours}時間${remMins}分後にリセット`;
            } else {
                resetText.textContent = `${remMins}分後にリセット`;
            }
        } else {
            resetText.textContent = 'リセット済み';
        }
    } else {
        resetText.textContent = '';
    }
}

function updateStatusMessage(usage) {
    const msgDiv = document.getElementById('status-message');
    // Logic: warn if any usage is high
    const utils = [
        usage.five_hour?.utilization || 0,
        usage.seven_day?.utilization || 0,
        usage.seven_day_sonnet?.utilization || 0,
        usage.seven_day_opus?.utilization || 0
    ];

    const maxUtil = Math.max(...utils);

    if (maxUtil > 90) {
        msgDiv.textContent = '⚠️ 使用量が上限に近づいています';
        msgDiv.style.color = '#F44336';
    } else if (maxUtil > 80) {
        msgDiv.textContent = '⚠️ 使用量が高くなっています';
        msgDiv.style.color = '#FF9800'; // Orange
    } else {
        msgDiv.textContent = '✅ 通常通り利用可能です';
        msgDiv.style.color = '#4CAF50';
    }
}
