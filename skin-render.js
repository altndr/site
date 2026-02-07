const WORKER_URL = "https://nameless-disk-9baf.skyblock.workers.dev";
const SKIN_API_BASE = "https://mcprofile.io/api/v1/bedrock/gamertag";

let currentPlayer = { name: "", uuid: null, profiles: {}, rank: "DEFAULT" };
let viewer;
let cachedPlayerData = null;

/**
 * UTILITY: Formats large numbers
 */
function formatNumber(num) {
    if (!num || num === 0) return "0";
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + "B";
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return Math.floor(num).toLocaleString();
}

const RANK_COLORS = {
    "OWNER": "#ff5555", "ADMIN": "#ff5555", "DEVELOPER": "#aa00aa",
    "MODERATOR": "#55ff55", "SR_MODERATOR": "#55ff55", "YOUTUBER": "#ff5555",
    "HELPER": "#5555ff", "TRAINEE": "#55ffff", "EMERALD": "#55ff55",
    "DIAMOND": "#55ffff", "GOLD": "#ffaa00", "VOTER": "#ffff55", "DEFAULT": "#94a3b8"
};

const CUMULATIVE_XP_TABLE = [
    0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925, 
    14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425, 
    322425, 522425, 822425, 1222425, 1722425, 2322425, 3022425, 
    3822425, 4722425, 5722725, 6822725, 8022425, 9322425, 10722425, 
    12222425, 13822425, 15522425, 17322425, 19222425, 21222425, 
    23322425, 25522425, 27822425, 30222425, 32722425, 35322425, 
    38072425, 40972425, 44072425, 47472425, 51172425, 55172425, 
    59472425, 64072425, 68972425, 74172425, 79672425, 85475425, 
    91572425, 97972425, 104672425, 111672425
];

/**
 * INITIAL LOAD
 */
window.onload = () => {
    // 1. Initial player fetch from URL path
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const pathUser = pathParts.pop();
    fetchPlayer(pathUser || "ImNdricim");

    // 2. Setup Search Input Listeners
    // We try to find the input by common IDs or by type
    const searchInput = document.getElementById('player-search-input') || document.querySelector('input[type="text"]');
    
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Stop page refresh
                const username = searchInput.value.trim();
                if (username) {
                    fetchPlayer(username);
                    searchInput.blur(); // Remove focus after searching
                }
            }
        });
    }
};

function clearPlayerData() {
    // 1. Reset global variables
    currentPlayer = { name: "", uuid: null, profiles: {}, rank: "DEFAULT" };
    cachedPlayerData = null;

    // 2. Clear Text Elements
    const nameEl = document.getElementById("name");
    if (nameEl) nameEl.innerHTML = `<span style="color: #ef4444;">Player not found.</span>`;

    const summaryContainer = document.getElementById('stats-summary');
    if (summaryContainer) summaryContainer.innerHTML = "";

    const skillsContainer = document.getElementById('skills-grid');
    if (skillsContainer) skillsContainer.innerHTML = "";

    const dropdown = document.getElementById('profile-dropdown-list');
    if (dropdown) dropdown.innerHTML = "";

    // 3. COMPLETE SKIN RESET
    if (viewer) {
        const canvas = document.getElementById("skin-canvas");
        if (canvas) {
            const context = canvas.getContext('2d') || canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (context) {
                // This effectively "wipes" the drawing surface
                canvas.width = canvas.width; 
            }
        }
        viewer.dispose();
        viewer = null;
    }
}

async function fetchPlayer(username) {
    try {
        // Update URL bar immediately
        window.history.pushState({}, '', `/${username}`);

        const statsRes = await fetch(`${WORKER_URL}/v1/player/${username}`);
        // If player doesn't exist, clear data and stop
        if (!statsRes.ok) {
            clearPlayerData();
            return;
        }
                const statsData = await statsRes.json();

        cachedPlayerData = statsData;

        currentPlayer.rank = statsData.selectedRank || "DEFAULT"; 
        currentPlayer.name = statsData.name;
        currentPlayer.uuid = statsData.pixelId || statsData.id; 
        currentPlayer.profiles = statsData.stats.skyBlock.profiles;

        const activeProfileId = statsData.stats.skyBlock.activeProfileId || Object.keys(currentPlayer.profiles)[0];
        
        renderProfileSelector(activeProfileId);
        await loadProfile(activeProfileId);

        // Fetch Skin
        fetch(`${SKIN_API_BASE}/${username}`)
            .then(res => res.json())
            .then(data => initSkin(data.skin))
            .catch(() => console.log("Skin not found."));

    } catch (error) {
        console.error("Fetch Error:", error);
        const nameEl = document.getElementById("name");
        if (nameEl) nameEl.innerText = "Player not found.";
    }
}

async function loadProfile(profileId) {
    try {
        const response = await fetch(`${WORKER_URL}/v1/skyblock/profile/${profileId}`);
        const data = await response.json();
        const member = data.members[currentPlayer.uuid] || Object.values(data.members)[0];

        if (member) {
            renderStats(data, member, cachedPlayerData);
        }
    } catch (e) {
        console.error("Failed to load profile details.", e);
    }
}

function updateHeader(profileId) {
    const nameEl = document.getElementById("name");
    const profileName = currentPlayer.profiles[profileId]?.cuteName || "Default";
    const rankColor = RANK_COLORS[currentPlayer.rank] || RANK_COLORS["DEFAULT"];
    
    let rankPrefix = "";
    if (currentPlayer.rank !== "DEFAULT") {
        rankPrefix = `<strong style="color: ${rankColor}; text-shadow: 0 0 10px ${rankColor}44;">${currentPlayer.rank}</strong> `;
    }

    if (nameEl) {
        nameEl.innerHTML = `
            <span style="font-weight: 400; color: #94a3b8;">Stats for</span> 
            ${rankPrefix}<u style="text-underline-offset: 6px; text-decoration-color: ${rankColor}88;">${currentPlayer.name}</u> 
            <span style="font-weight: 400; color: #94a3b8;">on</span> 
            <span class="profile-selector">
                <strong id="current-profile-name" class="profile-trigger-text" onclick="toggleProfileDropdown()">
                    ${profileName}
                </strong>
                <div id="profile-dropdown-list" class="profile-dropdown"></div>
            </span>
        `;
    }
}

function toggleProfileDropdown() {
    const list = document.getElementById('profile-dropdown-list');
    if (list) list.classList.toggle('show');
}

window.addEventListener('click', (event) => {
    const dropdown = document.getElementById('profile-dropdown-list');
    const trigger = document.getElementById('current-profile-name');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!trigger?.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove('show');
        }
    }
});

function renderProfileSelector(activeId) {
    updateHeader(activeId); 
    const list = document.getElementById('profile-dropdown-list');
    if (!list) return;

    list.innerHTML = '';
    Object.entries(currentPlayer.profiles).forEach(([pId, pData]) => {
        const item = document.createElement('div');
        item.className = `profile-option ${pId === activeId ? 'active' : ''}`;
        item.innerHTML = `<span>${pData.cuteName}</span>`;
        item.onclick = async (e) => {
            e.stopPropagation();
            document.getElementById('profile-dropdown-list')?.classList.remove('show');
            renderProfileSelector(pId);
            await loadProfile(pId);
        };
        list.appendChild(item);
    });
}

function getSkillData(totalXp, maxLevel = 50) {
    let level = 0;
    for (let i = 1; i <= maxLevel; i++) {
        if (totalXp >= (CUMULATIVE_XP_TABLE[i] || Infinity)) {
            level = i;
        } else {
            break;
        }
    }
    const isMax = level >= maxLevel;
    const currentLevelXpThreshold = CUMULATIVE_XP_TABLE[level] || 0;
    const nextLevelXpThreshold = isMax ? null : CUMULATIVE_XP_TABLE[level + 1];
    const progressXp = totalXp - currentLevelXpThreshold;
    const neededForNext = isMax ? 0 : (nextLevelXpThreshold - currentLevelXpThreshold);
    const percent = isMax ? 100 : Math.min((progressXp / (neededForNext || 1)) * 100, 100);

    return { level, current: progressXp, next: neededForNext, percent, isMax };
}

function renderStats(profile, member, playerData) {
    const summaryContainer = document.getElementById('stats-summary');
    if (!summaryContainer || !playerData) return;

    // 1. Join Date & Playtime
    const firstLoginStr = playerData.firstLogin || new Date().toISOString();
    const joinedDateObj = new Date(firstLoginStr);
    const yearsAgo = ((Date.now() - joinedDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
    const joinedDateFormatted = joinedDateObj.toLocaleDateString();

    const totalSeconds = playerData.totalPlaytime || 0;
    const totalHours = (totalSeconds / 3600).toFixed(1);
    const sbHours = ((playerData.playtimePerGame?.SKYBLOCK || 0) / 3600).toFixed(1);
    const hubHours = ((playerData.playtimePerGame?.HUB || 0) / 3600).toFixed(1);
    const limboHours = ((playerData.playtimePerGame?.LIMBO || 0) / 3600).toFixed(1);

    // 2. Currency
    const purse = member.coinPurse || 0;
    const bank = profile.banking?.balance || 0;
    const bankTier = profile.banking?.tier || "BASIC";
    const highestBank = profile.banking?.highestBalance || 0;

    // 3. Souls / Shards
    const collected = member.realityShardData?.collectedShards?.length || 0;
    const fusions = member.realityShardData?.fusions || 0;

    // FIX: Consistent Skill Average Calculation
    const skillKeys = ['farming', 'mining', 'combat', 'foraging', 'enchanting', 'taming'];
    let totalLevels = 0;
    if (member.skills) {
        skillKeys.forEach(k => {
            const xp = member.skills[k] || 0;
            let mLevel = 50;
            const bonus = member.skills.capIncreases?.[k.toUpperCase()] || 0;
            mLevel += bonus;
            totalLevels += getSkillData(xp, mLevel).level;
        });
    }
    const avgLevel = (totalLevels / skillKeys.length).toFixed(1);

    summaryContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Joined*</span>
            <span class="stat-value gray">${yearsAgo}Y</span>
            <div class="tooltip">
                <span class="tooltip-title">Arrival</span>
                First Login: ${joinedDateFormatted}
            </div>
        </div>
        <div class="stat-item">
            <span class="stat-label">Playtime*</span>
            <span class="stat-value">${totalHours}h</span>
            <div class="tooltip">
                <span class="tooltip-title">Session Breakdown</span>
                <div style="display: flex; justify-content: space-between; gap: 20px;">
                    <span>Skyblock:</span> <span>${sbHours}h</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Hub:</span> <span>${hubHours}h</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Limbo:</span> <span>${limboHours}h</span>
                </div>
            </div>
        </div>
        <div class="stat-item">
            <span class="stat-label">Purse</span>
            <span class="stat-value gold">${formatNumber(purse)}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Bank*</span>
            <span class="stat-value gold">${formatNumber(bank)}</span>
            <div class="tooltip">
                <span class="tooltip-title">${bankTier} Account</span>
                Highest: ${formatNumber(highestBank)}
            </div>
        </div>
        <div class="stat-item">
            <span class="stat-label">Shards*</span>
            <span class="stat-value cyan" style="color: #22d3ee;">${collected}/114</span>
            <div class="tooltip">
                <span class="tooltip-title">Reality Data</span>
                Fusions: ${fusions}
            </div>
        </div>
        <div class="stat-item">
            <span class="stat-label">Avg Skill*</span>
            <span class="stat-value">${avgLevel}</span>
            <div class="tooltip">Based on 6 core skills.</div>
        </div>
    `;

    renderSkills(member);
}

function renderSkills(member) {
    const skillsContainer = document.getElementById('skills-grid');
    if (!skillsContainer) return;
    
    if (!member.skills) {
        skillsContainer.innerHTML = "<p>No skill data available.</p><br><p>Enable Skill API in game.</p>";
        return;
    }

    const skillMap = {
        farming: { name: 'Farming', icon: 'GOLDEN_HOE' },
        mining: { name: 'Mining', icon: 'STONE_PICKAXE' },
        combat: { name: 'Combat', icon: 'STONE_SWORD' },
        foraging: { name: 'Foraging', icon: 'SAPLING:3' },
        enchanting: { name: 'Enchanting', icon: 'ENCHANTING_TABLE' },
        taming: { name: 'Taming', icon: 'SPAWN_EGG' }
    };

    let totalLevels = 0;
    let skillCardsHtml = "";
    const skillKeys = Object.keys(skillMap);

    skillKeys.forEach(apiKey => {
        const totalXp = member.skills[apiKey] || 0;
        let maxLevel = 50;
        const capBonus = member.skills.capIncreases?.[apiKey.toUpperCase()] || 0;
        maxLevel += capBonus;

        const data = getSkillData(totalXp, maxLevel);
        totalLevels += data.level;

        let state = "green";
        if (totalXp <= 0) state = "gray";
        else if (data.isMax) state = "orange";

        skillCardsHtml += createSkillCard(
            skillMap[apiKey].name, 
            skillMap[apiKey].icon, 
            data.level, 
            data.current, 
            data.next, 
            data.percent, 
            state,
            false
        );
    });

    const avg = (totalLevels / skillKeys.length).toFixed(1);
    const avgPercent = (parseFloat(avg) / 50) * 100;
    const avgHtml = createSkillCard('Skill Average', 'CHART_BAR', avg, avg, 50, avgPercent, "green", true);

    skillsContainer.innerHTML = avgHtml + skillCardsHtml;
}

function createSkillCard(label, icon, level, current, next, percent, state, isWide) {
    const isAverage = label === 'Skill Average';
    let iconUrl = isAverage ? 
        "https://sky.shiiyu.moe/api/head/2e2cc42015e6678f8fd49ccc01fbf787f1ba2c32bcf559a015332fc5db50" : 
        `https://sky.shiiyu.moe/api/item/${icon}`;
    
    const displayShort = isAverage ? `${level} / 51.7` : (state === "orange" ? `${formatNumber(current)}` : `${formatNumber(current)} / ${formatNumber(next)} XP`);
    const displayFull = isAverage ? `${level} / 51.7` : (state === "orange" ? `${current.toLocaleString()}` : `${current.toLocaleString()} / ${next.toLocaleString()} XP`);
    
    return `
        <div class="skill-card-container ${isWide ? 'wide' : ''}" data-state="${state}">
            <div class="skill-icon-wrapper">
                <img src="${iconUrl}" alt="${label}" class="skill-icon">
            </div>
            <div class="skill-content">
                <div class="skill-header">
                    <span class="skill-name">${label}</span>
                    <span class="skill-level">${level}</span>
                </div>
                <div class="skill-progress-wrapper">
                    <div class="skill-progress-bar" style="width: ${percent}%"></div>
                    <div class="skill-progress-text">
                        <span class="xp-short">${displayShort}</span>
                        <span class="xp-full">${displayFull}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initSkin(skinUrl) {
    const canvas = document.getElementById("skin-canvas");
    const container = document.querySelector(".skin-panel");
    if (!canvas || !container) return;
    if (viewer) viewer.dispose();

    viewer = new skinview3d.SkinViewer({
        canvas,
        width: container.clientWidth,
        height: container.clientHeight,
        skin: skinUrl,
        fov: 45
    });

    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = false;
    viewer.animation = new skinview3d.WalkingAnimation();
    viewer.camera.position.set(0, 0, 75);
}

window.addEventListener("resize", () => {
    const container = document.querySelector(".skin-panel");
    if (viewer && container && container.clientWidth > 0) {
        viewer.setSize(container.clientWidth, container.clientHeight);
    }
});
