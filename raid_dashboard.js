// --------------------------------------------------------------------------
// Discord Raid Notifier for SPT/Fika Servers (Node.js Version)
// v7.9 - Finalized Raid Reports
//
// Monitors log files for raid events and boss spawns. Reads profile data for stats.
// Maintains a persistent, live-updating stats embed with Top 3 leaderboards,
// a chronological kill feed, and a post-raid summary report.
// --------------------------------------------------------------------------

// --- Global Error Handlers ---
process.on('uncaughtException', (err, origin) => {
    console.clear();
    console.error('\x1b[31m[CRITICAL UNCAUGHT EXCEPTION]\x1b[0m');
    console.error(err);
    console.error('Origin:', origin);
    console.log('\nThis is a fatal error. The script will now close.');
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.clear();
    console.error('\x1b[31m[CRITICAL UNHANDLED REJECTION]\x1b[0m');
    console.error('Reason:', reason);
    console.log('\nThis is a fatal error, often caused by a network issue or an unhandled promise. The script will now close.');
    process.exit(1);
});

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const LOG_FILE_PATH = "C:\\SPT\\BepInEx\\LogOutput.log";
const PROFILES_PATH = "C:\\SPT\\user\\profiles";

// Webhook for the primary raid status channel (#raid-status)
const RAID_STATUS_WEBHOOK_URL = "SET WEB HOOK HERE";

// Webhook for the secondary achievements/stats channel (#achievements)
const ACHIEVEMENTS_WEBHOOK_URL = "SET WEB HOOK HERE";

const BOT_USERNAME = "SPTorbin Raid Notifier";
const BOT_AVATAR_URL = "https://i.redd.it/all-cats-from-eft-official-tiktok-v0-gymlu93ubrpb1.jpg?width=678&format=pjpg&auto=webp&s=277a2a7c000a7927d7ff71f99f30407756a0ebaf";
const MENTION_EVERYONE_ON_START = true;
const STATS_DATA_FILE_PATH = "./player_stats.json";
const MESSAGE_ID_FILE_PATH = "./discord_message_ids.json";
const KILL_FEED_HISTORY_PATH = "./kill_feed.json";
const MAX_KILL_FEED_MESSAGES = 3;

const raidStartPhrases = ["This kit is worth more than my car.", "Pray to the Tarkov gods.", "Alright Nikita, please be gentle.", "If I die, this was a great use of 800k Rubles.", "Remember the quest, don't get greedy.", "Did you bring the right ammo, or are we just tickling them?", "Check your spawns!", "Quiet, I hear bushes.", "Is that you walking? Please say that's you.", "Got footsteps, right off the rip.", "Alright, who's got the closest spawn?", "Don't skyline yourself, dumbass.", "He's one-shot, I swear!", "Contact! 2-man, USEC!", "Tossin' a 'nade, clear back!", "He's lit! Push him now!", "Leg meta engaged.", "Welcome back to the lobby.", "Hold that angle, I'm flanking.", "Head, eyes.", "Got 'em. Secure the area.", "Check his tag, what level was he?", "He had a family, probably.", "Is this GPU for me? 👉👈", "It's just a bunch of T-Plugs and Crickents.", "Hoover it all up, we'll sort it in the stash.", "Don't get greedy, we've got the good stuff.", "It's just a scav... oh god it's not just a scav.", "That scav had the aim of god.", "Cheeki Breeki!", "Tagilla is coming for your kneecaps.", "You hear that? That's the sound of a Killa powerslide.", "From where?!", "My legs are blacked.", "Aaaaaaand I'm back in the stash.", "My thorax is gone.", "Well, that was a short raid.", "He's cheating. 100%.", "You just got Tarkov'd."];

// --- Translation & Image Maps ---
const bossNameMap = { 'Тагилла': 'Tagilla', 'Решала': 'Reshala', 'Глухарь': 'Glukhar', 'Килла': 'Killa', 'Штурман': 'Shturman', 'Санитар': 'Sanitar', 'Зрячий': 'Zryachiy', 'Биг Пайп': 'Big Pipe', 'Берд Ай': 'Bird Eye', 'Кабан': 'Kaban', 'Коллонтай': 'Kollontay', 'Goons': 'The Goons', 'Blood Hounds': 'The Bloodhounds', 'Reshala': 'Reshala' };
const mapCodeNameMap = { 'bigmap': 'Customs', 'factory': 'Factory', 'interchange': 'Interchange', 'laboratory': 'The Lab', 'lighthouse': 'Lighthouse', 'rezervbase': 'Reserve', 'tarkovstreets': 'Streets of Tarkov', 'woods': 'Woods', 'shoreline': 'Shoreline', 'Sandbox': 'Ground Zero', 'Sandbox_high': 'Ground Zero' };
const bossImageMap = { 'Tagilla': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/b/b4/Tagilla_Portrait.png/revision/latest/scale-to-width-down/140?cb=20221124021033', 'Reshala': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/1/1a/Dealmaker_Portrait.png/revision/latest/scale-to-width-down/140?cb=20241231162333', 'Glukhar': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/4/44/Gluhar_Portrait.PNG/revision/latest/scale-to-width-down/140?cb=20241231164950', 'Killa': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/a/ac/Killa_Portrait.png/revision/latest/scale-to-width-down/140?cb=20221124023939', 'Shturman': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/3/3f/Shturman_Portrait.png/revision/latest/scale-to-width-down/140?cb=20221124231615', 'Sanitar': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/2/23/Sanitar_Portrait.png/revision/latest/scale-to-width-down/140?cb=20250503165416', 'Zryachiy': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/c/c6/ZryachiyPortrait.png/revision/latest/scale-to-width-down/140?cb=20230611213056', 'Kaban': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/e/e3/Kaban_Portrait.png/revision/latest/scale-to-width-down/140?cb=20230812135318', 'Kollontay': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/d3/Kollontay_Portrait.png/revision/latest/scale-to-width-down/140?cb=20240205005026', 'The Goons': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/8/87/Goons_Portrait.png', 'The Bloodhounds': 'https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/9/90/Cultist_Portrait.png' };

// --- UI & State Variables ---
let raidStatusMessageId = null, statsMessageId = null;
let killFeedMessages = [];
let currentRaidState = "Waiting for Raid", currentRaidMap = "N/A", currentRaidTime = "N/A";
let currentPlayers = [], currentRaidBosses = [], playersDiedThisRaid = [];
let logHistory = [], MAX_LOG_HISTORY = 15;
let spinner = ['|', '/', '-', '\\'], spinnerIndex = 0, lastStatusMessage = "Initializing...";
let previousRaidSummary = null;
let currentRaidSummary = {};
let discordUpdateTimeout = null;

// --- Helper Functions ---
const getMapImage = (rawMapName) => { const cleaned = rawMapName.toLowerCase().replace(/_\w+$/, '').replace(/\d/g, '').replace('town', 'groundzero'); const properName = mapCodeNameMap[cleaned] || cleaned; const properNameKey = properName.toLowerCase().replace(/\s/g, ''); const mapImages = { "customs": "https://cdn.mapgenie.io/images/games/tarkov/maps/customs.jpg", "factory": "https://cdn.mapgenie.io/images/games/tarkov/maps/factory.jpg", "interchange": "https://cdn.mapgenie.io/images/games/tarkov/maps/interchange.jpg", "thelab": "https://cdn.mapgenie.io/images/games/tarkov/maps/lab.jpg", "lighthouse": "https://cdn.mapgenie.io/images/games/tarkov/maps/lighthouse.jpg", "reserve": "https://cdn.mapgenie.io/images/games/tarkov/maps/reserve.jpg", "groundzero": "https://cdn.mapgenie.io/images/games/tarkov/maps/ground-zero.jpg", "shoreline": "https://cdn.mapgenie.io/images/games/tarkov/maps/shoreline.jpg", "streetsoftarkov": "https://cdn.mapgenie.io/images/games/tarkov/maps/streets.jpg", "woods": "https://cdn.mapgenie.io/images/games/tarkov/maps/woods.jpg" }; return mapImages[properNameKey] || ""; };
const formatDisplayName = (rawMapName) => { const cleaned = rawMapName.toLowerCase().replace(/_\w+$/, '').replace(/\d/g, '').replace('town', 'groundzero'); return mapCodeNameMap[cleaned] || (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)); };
const getOrdinalSuffix = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };
const getTimeOfDay = (rawMapName) => rawMapName.toLowerCase().includes('_night') ? 'Night' : 'Day';
const logToUI = (message) => { if (logHistory.length >= MAX_LOG_HISTORY) logHistory.shift(); logHistory.push(`[NOTIFIER] ${message}`); lastStatusMessage = message; redrawUI(); };

// --- Data & State Management ---
const loadData = (filePath, defaultData) => { try { if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (error) { console.error(`[ERROR] Failed to load data from ${filePath}:`, error); } return defaultData; };
const saveData = (filePath, data) => { try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); } catch (error) { console.error(`[ERROR] Failed to save data to ${filePath}:`, error); } };
const initializePlayer = (data, playerName) => { if (!data.players[playerName]) { data.players[playerName] = { kills: {}, deaths: 0, pmcKills: 0, scavKills: 0, raidsSurvived: 0, raidsPlayed: 0, currentSurvivalStreak: 0, longestSurvivalStreak: 0 }; } };

// --- Profile Data Reading ---
const findCounterValue = (counters, keyToFind) => {
    if (!counters || !Array.isArray(counters)) return 0;
    const item = counters.find(c => c.Key.length === keyToFind.length && c.Key.every((k, i) => k === keyToFind[i]));
    return item ? item.Value : 0;
};

const updateStatsFromProfiles = () => {
    logToUI("Syncing stats from player profiles...");
    try {
        if (!fs.existsSync(PROFILES_PATH)) {
            logToUI("Profiles directory not found.");
            console.error(`[ERROR] Profiles directory not found at: ${PROFILES_PATH}`);
            return false;
        }
        const profileFiles = fs.readdirSync(PROFILES_PATH).filter(f => f.endsWith('.json'));
        if (profileFiles.length === 0) {
            logToUI("No player profiles found to sync.");
            return true;
        }
        const playerData = loadData(STATS_DATA_FILE_PATH, { global: { bossSpawns: {}, totalRaids: 0, mapPlays: {} }, players: {} });
        let profilesSynced = 0;
        for (const file of profileFiles) {
            const profilePath = path.join(PROFILES_PATH, file);
            const profileData = loadData(profilePath, null);
            if (!profileData?.characters?.pmc) continue;
            const pmcData = profileData.characters.pmc;
            if (!pmcData.Info?.Nickname) continue;
            const playerName = pmcData.Info.Nickname;
            if (!pmcData.Stats?.Eft?.OverallCounters?.Items) continue;
            const counters = pmcData.Stats.Eft.OverallCounters.Items;
            initializePlayer(playerData, playerName);
            playerData.players[playerName].deaths = findCounterValue(counters, ["ExitStatus", "Killed", "Pmc"]);
            playerData.players[playerName].pmcKills = findCounterValue(counters, ["KilledPmc"]);
            playerData.players[playerName].scavKills = findCounterValue(counters, ["KilledSavage"]);
            playerData.players[playerName].raidsSurvived = findCounterValue(counters, ["ExitStatus", "Survived", "Pmc"]);
            playerData.players[playerName].raidsPlayed = findCounterValue(counters, ["Sessions", "Pmc"]);
            playerData.players[playerName].longestSurvivalStreak = findCounterValue(counters, ["LongestWinStreak", "Pmc"]);
            profilesSynced++;
        }
        saveData(STATS_DATA_FILE_PATH, playerData);
        logToUI(`Successfully synced stats for ${profilesSynced} profiles.`);
        return true;
    } catch (error) {
        logToUI("Critical error during profile sync.");
        console.error("[ERROR] A critical error occurred while processing profile files:", error);
        return false;
    }
};

// --- UI Drawing Function ---
const redrawUI = () => { console.clear(); const width = process.stdout.columns; const border = "\x1b[90m", titleColor = "\x1b[36m\x1b[1m", labelColor = "\x1b[37m", valueColor = "\x1b[33m", logColor = "\x1b[36m", statusColor = "\x1b[32m", reset = "\x1b[0m"; console.log(border + "┌" + "─".repeat(width - 2) + "┐" + reset); const title = " Discord Raid Notifier "; const titlePadding = Math.floor((width - title.length) / 2); console.log(border + "│" + " ".repeat(titlePadding) + titleColor + title + reset + " ".repeat(width - title.length - titlePadding - 2) + border + "│" + reset); console.log(border + "├" + "─".repeat(width - 2) + "┤" + reset); console.log(border + "│" + `${labelColor} Map: ${valueColor}${formatDisplayName(currentRaidMap).padEnd(20)}${labelColor}Time: ${valueColor}${currentRaidTime.padEnd(15)}${labelColor}Players: ${valueColor}${currentPlayers.length}`.padEnd(width - 4) + border + " │" + reset); console.log(border + "│" + `${labelColor} Status: ${statusColor}${currentRaidState.padEnd(40)}`.padEnd(width - 4) + border + " │" + reset); console.log(border + "├" + "─".repeat(width - 2) + "┤" + reset); const logTitle = " Live Log "; const logPadding = Math.floor((width - logTitle.length) / 2); console.log(border + "│" + "─".repeat(logPadding) + logTitle + "─".repeat(width - logTitle.length - logPadding - 2) + border + "│" + reset); logHistory.forEach(line => { const truncatedLine = line.substring(0, width - 6); console.log(border + "│ " + logColor + truncatedLine.padEnd(width - 4) + reset + border + " │" + reset); }); for (let i = 0; i < MAX_LOG_HISTORY - logHistory.length; i++) { console.log(border + "│ " + " ".repeat(width - 4) + border + " │" + reset); } console.log(border + "└" + "─".repeat(width - 2) + "┘" + reset); const footerText = ` ${spinner[spinnerIndex]} Monitoring... (Ctrl+C to stop) | Last Event: ${lastStatusMessage}`; process.stdout.write(statusColor + footerText.padEnd(width - 1) + reset); };

// --- Discord Interaction ---
const buildStatsEmbed = () => {
    const playerData = loadData(STATS_DATA_FILE_PATH, { global: { bossSpawns: {}, totalRaids: 0, mapPlays: {} }, players: {} });
    const { players, global } = playerData;
    const formatTopPlayers = (playerList, statKey, suffix = '', options = {}) => {
        const { defaultValue = "None yet", isRate = false } = options;
        if (!playerList || playerList.length === 0 || !playerList[0] || playerList[0][statKey] <= 0) return defaultValue;
        const medals = ['🥇', '🥈', '🥉'];
        return playerList.map((p, i) => `${medals[i] || '•'} **${p.name}** (${p[statKey]}${isRate ? '%' : ''} ${suffix})`.trim()).join('\n');
    };
    const sortedPlayers = Object.entries(players).map(([name, data]) => {
        const totalBossKills = Object.values(data.kills || {}).reduce((a, b) => a + b, 0);
        const kdr = data.deaths === 0 ? (data.pmcKills || 0).toFixed(2) : ((data.pmcKills || 0) / data.deaths).toFixed(2);
        const survivalRate = (data.raidsPlayed || 0) === 0 ? "0.0" : (((data.raidsSurvived || 0) / (data.raidsPlayed || 1)) * 100).toFixed(1);
        return { name, ...data, totalBossKills, kdr, survivalRate };
    });
    const topPmcKillers = [...sortedPlayers].sort((a, b) => (b.pmcKills || 0) - (a.pmcKills || 0)).slice(0, 3);
    const topBossKillers = [...sortedPlayers].sort((a, b) => b.totalBossKills - a.totalBossKills).slice(0, 3);
    const topScavKillers = [...sortedPlayers].sort((a, b) => (b.scavKills || 0) - (a.scavKills || 0)).slice(0, 3);
    const bestKDRs = [...sortedPlayers].sort((a, b) => b.kdr - a.kdr).slice(0, 3);
    const bestSurvivors = [...sortedPlayers].sort((a, b) => b.survivalRate - a.survivalRate).slice(0, 3);
    const mostDeaths = [...sortedPlayers].sort((a, b) => b.deaths - a.deaths).slice(0, 3);
    const longestStreaks = [...sortedPlayers].sort((a, b) => (b.longestSurvivalStreak || 0) - (a.longestSurvivalStreak || 0)).slice(0, 3);
    const mostEncounteredBoss = Object.entries(global.bossSpawns || {}).sort(([, a], [, b]) => b - a)[0];
    const mostPlayedMap = Object.entries(global.mapPlays || {}).sort(([, a], [, b]) => b - a)[0];
    const fields = [
        { name: "🩸 Most Bloodthirsty (PMCs):", value: formatTopPlayers(topPmcKillers, 'pmcKills', 'Kills'), inline: false },
		{ name: '\u200B', value: '\u200B', inline: false },
        { name: "🏆 Top Boss Hunters:", value: formatTopPlayers(topBossKillers, 'totalBossKills', 'Kills'), inline: false },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: "🧟‍♂️ Top Scav Slayers:", value: formatTopPlayers(topScavKillers, 'scavKills', 'Kills'), inline: false },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: "📈 Best K/D Ratios:", value: formatTopPlayers(bestKDRs, 'kdr', ''), inline: true },
        { name: "🌿 Best Survivalists:", value: formatTopPlayers(bestSurvivors, 'survivalRate', '', { isRate: true }), inline: true },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: "🔥 Longest Survival Streaks:", value: formatTopPlayers(longestStreaks, 'longestSurvivalStreak', 'Raids'), inline: true },
        { name: "💔 Most Deaths:", value: formatTopPlayers(mostDeaths, 'deaths', 'Deaths'), inline: true },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: `🗺️ Favorite Map (Total: ${global.totalRaids || 0})`, value: mostPlayedMap ? `**${formatDisplayName(mostPlayedMap[0])}** (${mostPlayedMap[1]} times)` : "N/A", inline: true },
        { name: "🎯 Most Seen Boss:", value: mostEncounteredBoss ? `**${mostEncounteredBoss[0]}** (${mostEncounteredBoss[1]} encounters)` : "N/A", inline: true },
    ];
    return { title: "📊 SPTorbin Raider Leaderboards", color: 5814783, fields, footer: { text: "Stats are updated live from raid logs and player profiles." }, timestamp: new Date().toISOString() };
};

const manageKillFeed = async (killInfo) => {
    let killFeed = loadData(KILL_FEED_HISTORY_PATH, []);
    if (killFeed.length >= MAX_KILL_FEED_MESSAGES) {
        const oldestKill = killFeed.shift();
        try {
            logToUI(`Deleting old kill feed message ${oldestKill.messageId}.`);
            await axios.delete(`${ACHIEVEMENTS_WEBHOOK_URL}/messages/${oldestKill.messageId}`);
        } catch (error) {
            console.error(`[WARN] Could not delete old kill feed message ${oldestKill.messageId}. It may have been manually deleted.`);
        }
    }
    const newKillEmbed = buildKillEmbed(killInfo, killFeed.length + 1, true);
    let newKillMessageId = null;
    try {
        logToUI(`Sending kill feed for ${killInfo.killerName} vs ${killInfo.bossName}.`);
        const response = await axios.post(`${ACHIEVEMENTS_WEBHOOK_URL}?wait=true`, { username: "Boss Kill Tracker", avatar_url: "https://i.imgur.com/K5O3uT8.png", embeds: [newKillEmbed] });
        newKillMessageId = response.data.id;
        killFeed.push({ messageId: newKillMessageId, data: killInfo });
    } catch (error) {
        logToUI("Failed to send new kill notification.");
        console.error("[ERROR] Could not send new kill feed message:", error.response?.data || error.message);
        return;
    }
    for (let i = 0; i < killFeed.length - 1; i++) {
        const kill = killFeed[i];
        const updatedEmbed = buildKillEmbed(kill.data, i + 1, false);
        try {
            logToUI(`Updating old kill feed message #${i + 1}.`);
            await axios.patch(`${ACHIEVEMENTS_WEBHOOK_URL}/messages/${kill.messageId}`, { embeds: [updatedEmbed] });
        } catch (error) {
            console.error(`[WARN] Could not update old kill feed message ${kill.messageId}. It was likely deleted.`);
            killFeed = killFeed.filter(k => k.messageId !== kill.messageId);
        }
    }
    saveData(KILL_FEED_HISTORY_PATH, killFeed);
};

const buildKillEmbed = (killInfo, number, isLatest) => {
    const { killerName, bossName, killCount, mapName } = killInfo;
    const currentTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const title = isLatest ? `💀 #${number} (Latest Kill) 💀` : `💀 #${number} 💀`;
    const embed = {
        title: title,
        description: `**${killerName}** murdered **${bossName}** on **${formatDisplayName(mapName)}** at ${currentTime}.`,
        color: isLatest ? 15158332 : 10038562,
        fields: [{ name: 'Kill Count', value: `This is **${killerName}**'s **${killCount}${getOrdinalSuffix(killCount)}** time killing **${bossName}**.`, inline: false }],
        footer: { text: "Kill confirmed." },
        timestamp: new Date().toISOString()
    };
    if (bossImageMap[bossName]) embed.thumbnail = { url: bossImageMap[bossName] };
    return embed;
};

const updateStatsEmbed = async () => {
    const statsEmbed = buildStatsEmbed();
    if (!statsMessageId) {
        try {
            logToUI("Posting initial stats embed...");
            const response = await axios.post(`${ACHIEVEMENTS_WEBHOOK_URL}?wait=true`, { username: "Raid Statistics", avatar_url: "https://i.imgur.com/K5O3uT8.png", embeds: [statsEmbed] });
            statsMessageId = response.data.id;
            saveData(MESSAGE_ID_FILE_PATH, { statsMessageId });
        } catch (error) {
            logToUI("Failed to create initial stats message.");
            console.error("[ERROR] Failed to create initial stats message:", error.response?.data || error.message);
        }
    } else {
        try {
            logToUI("Updating stats embed...");
            await axios.patch(`${ACHIEVEMENTS_WEBHOOK_URL}/messages/${statsMessageId}`, { embeds: [statsEmbed] });
        } catch (error) {
            if (error.response?.status === 404) {
                logToUI("Stats message not found, creating new one.");
                statsMessageId = null;
                saveData(MESSAGE_ID_FILE_PATH, { statsMessageId: null });
                await updateStatsEmbed();
            } else {
                logToUI("Failed to update stats message.");
                console.error(`[ERROR] Failed to update stats message ${statsMessageId}:`, error.response?.data || error.message);
            }
        }
    }
};

const setDiscordStatus = async (state) => {
    if (raidStatusMessageId) { try { await axios.delete(`${RAID_STATUS_WEBHOOK_URL}/messages/${raidStatusMessageId}`); } catch (error) { /* Ignore */ } raidStatusMessageId = null; }

    let embed = {}, content = "";
    switch (state) {
        case "Starting":
            embed = { title: ":hourglass_flowing_sand: Raid Starting Soon!", description: `A new raid is ready! ${raidStartPhrases[Math.floor(Math.random() * raidStartPhrases.length)]}`, color: 11403055, image: { url: getMapImage(currentRaidMap) }, fields: [{ name: "Map", value: `**${formatDisplayName(currentRaidMap)}**`, inline: true }, { name: "Time of Day", value: `**${currentRaidTime}**`, inline: true }] };
            if (MENTION_EVERYONE_ON_START) content = "@here";
            break;
        case "InProgress":
            const playerListString = currentPlayers.map(p => `- ${p}`).join("\n") || "No players detected yet.";
            embed = { title: ":crossed_swords: Raid in Progress!", description: "The raid is active. Good luck!", color: 16711680, image: { url: getMapImage(currentRaidMap) }, fields: [{ name: "Map", value: `**${formatDisplayName(currentRaidMap)}**`, inline: true }, { name: "Time of Day", value: `**${currentRaidTime}**`, inline: true }, { name: "Players in Raid", value: `(${currentPlayers.length})\n${playerListString}`, inline: false }] };
            if (currentRaidBosses.length > 0) {
                embed.title = "🔥 BOSS ACTIVE! 🔥";
                embed.description = "A boss has been spotted!";
                embed.color = 15844367;
                const bossListString = currentRaidBosses.map(b => `- ${b}`).join('\n');
                embed.fields.push({ name: "Active Bosses", value: `(${currentRaidBosses.length})\n${bossListString}`, inline: false });
            }
            break;
        case "Ended":
            if (previousRaidSummary && previousRaidSummary.participants) {
                embed.title = "✅ Raid Report | Waiting for Next";
                embed.description = `Here's the summary of the last raid on **${previousRaidSummary.map}**.`;
                embed.color = 4321431;

                const duration = previousRaidSummary.durationMinutes;
                const participantCount = previousRaidSummary.participants.length;
                const infoValue = `🗺️ **Map:** ${previousRaidSummary.map}\n⏱️ **Duration:** ${duration} min\n👥 **Operators:** ${participantCount}`;

                const bossList = previousRaidSummary.bossesSpawned.length > 0 ? previousRaidSummary.bossesSpawned.map(b => `• ${b}`).join('\n') : "None";

                const totalKills = previousRaidSummary.kills.pmc + previousRaidSummary.kills.scav + previousRaidSummary.kills.bosses;
                let highlightsValue = `**Total Kills:** ${totalKills} (PMCs: ${previousRaidSummary.kills.pmc}, Scavs: ${previousRaidSummary.kills.scav}, Bosses: ${previousRaidSummary.kills.bosses})`;

                if (totalKills > 0) {
                    const playersWithStats = Object.entries(previousRaidSummary.playerStats).map(([name, stats]) => ({
                        name,
                        ...stats,
                        totalKills: stats.pmcKills + stats.scavKills + stats.bossKills
                    }));

                    const raidMVP = playersWithStats.sort((a, b) => b.totalKills - a.totalKills)[0];
                    if (raidMVP && raidMVP.totalKills > 0) {
                        highlightsValue += `\n🏆 **Raid MVP:** ${raidMVP.name} (${raidMVP.totalKills} kills)`;
                    }

                    const bossHunters = playersWithStats.filter(p => p.bossKills > 0).sort((a, b) => b.bossKills - a.bossKills);
                    if (bossHunters.length > 0) {
                        const topHunter = bossHunters[0];
                        highlightsValue += `\n💀 **Top Boss Hunter:** ${topHunter.name} (${topHunter.bossKills} kill${topHunter.bossKills > 1 ? 's' : ''})`;
                    }
                }
                
                embed.fields = [
                    { name: "Raid Info", value: infoValue, inline: true },
                    { name: "Boss Encounters", value: bossList, inline: true },
                    { name: "Raid Highlights", value: highlightsValue, inline: false }
                ];
                
                embed.footer = { text: `Raid ended at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` };
            } else {
                embed = { title: ":zzz: No Raid in Progress", description: "The server is quiet. Waiting for a new raid to start.", color: 9807270, image: { url: "https://media.tenor.com/W5pHtj5JE2MAAAAM/escape-from-tarkov-tarkov.gif" } };
            }
            break;
    }

    try {
        logToUI(`Posting status '${state}' to Discord.`);
        const response = await axios.post(`${RAID_STATUS_WEBHOOK_URL}?wait=true`, { username: BOT_USERNAME, avatar_url: BOT_AVATAR_URL, embeds: [embed], content });
        raidStatusMessageId = response.data.id;
    } catch (error) {
        logToUI(`Failed to post raid status '${state}'.`);
        console.error('[ERROR] Failed to post raid status:', error.response?.data || error.message);
    }
};

const parseEntity = (rawEntity) => {
    const namePart = rawEntity.split('(')[0].trim();
    let finalName = namePart;

    // 1. Check for Bosses first (most specific)
    for (const cyrillicName in bossNameMap) {
        if (namePart.includes(cyrillicName)) {
            finalName = bossNameMap[cyrillicName];
            return { name: finalName, type: 'Boss' };
        }
    }
    for (const key in bossNameMap) {
        const englishName = bossNameMap[key];
        if (namePart.toLowerCase() === englishName.toLowerCase()) {
            finalName = englishName;
            return { name: finalName, type: 'Boss' };
        }
    }

    // 2. Check for explicit (PMC) or (Scav) tags
    const typeMatch = rawEntity.match(/\((PMC|Scav)\)/);
    if (typeMatch) {
        return { name: finalName, type: typeMatch[1] };
    }

    // 3. Check for Cyrillic characters to identify as Scav
    const cyrillicPattern = /[А-яЁё]/;
    if (cyrillicPattern.test(namePart)) {
        return { name: finalName, type: 'Scav' };
    }

    // 4. Default: If not a Boss, tagged, or Scav, it's an AI PMC
    return { name: finalName, type: 'PMC' };
};
// --- Main Logic ---
const processLogLine = (line) => {
    if (logHistory.length >= MAX_LOG_HISTORY) logHistory.shift();
    logHistory.push(line);

    const raidStartPattern = /\[Info\s*:Fika\.Headless\] Starting with: (\{.*\})/;
    const playerJoinPattern = /New player:\s*(.*)/;
    const coopPlayerPattern = /\[Info\s*:CoopHandler\] AddClientToBotEnemies: (.*)/;
    const playerDeathPattern = /\[Info\s*:DanW-QuestingBots\]\s*(.+?)\s+was killed by\s+(.+?)\./;
    const bossSpawnPattern = /\[Info\s*:BossNotifier\] (.*?) (?:has|have) been located/i;
    const raidEndPattern = /Destroyed FikaServer|Stopping server for raid/;

    const raidStartMatch = line.match(raidStartPattern);
    const playerJoinMatch = line.match(playerJoinPattern);
    const coopPlayerMatch = line.match(coopPlayerPattern);
    const playerDeathMatch = line.match(playerDeathPattern);
    const bossSpawnMatch = line.match(bossSpawnPattern);
    const raidEndMatch = line.match(raidEndPattern);

    let achievementsChanged = false;

    if (raidStartMatch && currentRaidState === "Waiting for Raid") {
        const raidInfo = JSON.parse(raidStartMatch[1]);
        currentRaidMap = raidInfo.location;
        currentRaidTime = getTimeOfDay(currentRaidMap);
        if (raidInfo.players && Array.isArray(raidInfo.players)) {
            currentPlayers = [...raidInfo.players];
            logToUI(`Detected ${currentPlayers.length} initial players from raid data.`);
        } else {
            currentPlayers = [];
        }
        currentRaidBosses = [];
        playersDiedThisRaid = [];
        currentRaidState = "Raid Starting";
        currentRaidSummary = {
            startTime: new Date(),
            map: formatDisplayName(currentRaidMap),
            kills: { pmc: 0, scav: 0, bosses: 0 },
            playerStats: {},
            bossesSpawned: []
        };
        currentPlayers.forEach(p => {
            currentRaidSummary.playerStats[p] = { pmcKills: 0, scavKills: 0, bossKills: 0 };
        });
        const playerData = loadData(STATS_DATA_FILE_PATH, { global: { bossSpawns: {}, totalRaids: 0, mapPlays: {} }, players: {} });
        playerData.global.totalRaids = (playerData.global.totalRaids || 0) + 1;
        const mapNameKey = formatDisplayName(currentRaidMap);
        playerData.global.mapPlays[mapNameKey] = (playerData.global.mapPlays[mapNameKey] || 0) + 1;
        saveData(STATS_DATA_FILE_PATH, playerData);
        logToUI(`Raid starting on ${formatDisplayName(currentRaidMap)}.`);
        setDiscordStatus("Starting");
        achievementsChanged = true;
    }

    else if (bossSpawnMatch && currentRaidState !== "Waiting for Raid") {
        clearTimeout(discordUpdateTimeout); // Ensure a boss spawn message is not delayed by a player joining right before
        const rawBossName = bossSpawnMatch[1].trim();
        const bossName = bossNameMap[rawBossName] || rawBossName;
        if (!currentRaidBosses.includes(bossName)) {
            const playerData = loadData(STATS_DATA_FILE_PATH, { global: { bossSpawns: {}, totalRaids: 0, mapPlays: {} }, players: {} });
            if (!playerData.global.bossSpawns[bossName]) playerData.global.bossSpawns[bossName] = 0;
            playerData.global.bossSpawns[bossName]++;
            saveData(STATS_DATA_FILE_PATH, playerData);
            currentRaidBosses.push(bossName);
            logToUI(`Boss spawned: ${bossName}!`);
            setDiscordStatus("InProgress");
            achievementsChanged = true;
        }
    }

    else if (playerJoinMatch && (currentRaidState === "Raid Starting" || currentRaidState === "In Progress")) {
        const playerName = playerJoinMatch[1].trim().replace(/\s*\(.*\)\s*$/, '');
        if (!currentPlayers.includes(playerName)) {
            currentPlayers.push(playerName);
            if (currentRaidSummary.playerStats) {
                currentRaidSummary.playerStats[playerName] = { pmcKills: 0, scavKills: 0, bossKills: 0 };
            }
            logToUI(`Player detected (New Player): ${playerName}.`);
            if (currentRaidState === "Raid Starting") currentRaidState = "In Progress";
            
            clearTimeout(discordUpdateTimeout);
            discordUpdateTimeout = setTimeout(() => {
                setDiscordStatus("InProgress");
            }, 500);
        }
    }
    
    else if (coopPlayerMatch && (currentRaidState === "Raid Starting" || currentRaidState === "In Progress")) {
        const playerName = coopPlayerMatch[1].trim();
        if (!currentPlayers.includes(playerName)) {
            currentPlayers.push(playerName);
            if (currentRaidSummary.playerStats) {
                currentRaidSummary.playerStats[playerName] = { pmcKills: 0, scavKills: 0, bossKills: 0 };
            }
            logToUI(`Player detected (CoopHandler): ${playerName}.`);
            if (currentRaidState === "Raid Starting") currentRaidState = "In Progress";
            
            clearTimeout(discordUpdateTimeout);
            discordUpdateTimeout = setTimeout(() => {
                setDiscordStatus("InProgress");
            }, 500);
        }
    }

    else if (playerDeathMatch) {
        const victim = parseEntity(playerDeathMatch[1].trim());
        const killer = parseEntity(playerDeathMatch[2].trim());
        if (currentPlayers.includes(killer.name) && currentRaidSummary.playerStats) {
            const stats = currentRaidSummary.playerStats[killer.name];
            if (stats) {
                switch (victim.type) {
                    case 'PMC':
                        if (killer.name !== victim.name) {
                            stats.pmcKills++;
                            currentRaidSummary.kills.pmc++;
                        }
                        break;
                    case 'Boss':
                        stats.bossKills++;
                        currentRaidSummary.kills.bosses++;
                        break;
                    case 'Scav':
                        stats.scavKills++;
                        currentRaidSummary.kills.scav++;
                        break;
                }
            }
        }
        if (currentPlayers.includes(victim.name) && !playersDiedThisRaid.includes(victim.name)) {
            playersDiedThisRaid.push(victim.name);
            logToUI(`${victim.name} was killed by ${killer.name}. This breaks their streak.`);
            const playerData = loadData(STATS_DATA_FILE_PATH, { global: {}, players: {} });
            if (playerData.players[victim.name]) {
                playerData.players[victim.name].currentSurvivalStreak = 0;
                saveData(STATS_DATA_FILE_PATH, playerData);
                achievementsChanged = true;
            }
        }
        if (currentPlayers.includes(killer.name) && victim.type === 'Boss') {
            const playerData = loadData(STATS_DATA_FILE_PATH, { global: {}, players: {} });
            initializePlayer(playerData, killer.name);
            playerData.players[killer.name].kills[victim.name] = (playerData.players[killer.name].kills[victim.name] || 0) + 1;
            saveData(STATS_DATA_FILE_PATH, playerData);
            const killCount = playerData.players[killer.name].kills[victim.name];
            manageKillFeed({ killerName: killer.name, bossName: victim.name, killCount, mapName: currentRaidMap });
            logToUI(`Boss kill: ${killer.name} killed ${victim.name}!`);
            achievementsChanged = true;
        }
    }

    else if (raidEndPattern.test(line) && currentRaidState !== "Waiting for Raid") {
        clearTimeout(discordUpdateTimeout); // Cancel any pending player join updates if the raid ends abruptly
        logToUI("Raid has ended. Calculating survival...");
        if (currentRaidSummary.startTime) {
            const endTime = new Date();
            const durationMs = endTime - currentRaidSummary.startTime;
            currentRaidSummary.durationMinutes = Math.round(durationMs / 60000);
            currentRaidSummary.participants = [...currentPlayers];
            currentRaidSummary.survivors = currentPlayers.filter(p => !playersDiedThisRaid.includes(p));
            currentRaidSummary.bossesSpawned = [...currentRaidBosses];
            previousRaidSummary = { ...currentRaidSummary };
        }
        const playerData = loadData(STATS_DATA_FILE_PATH, { global: { bossSpawns: {}, totalRaids: 0, mapPlays: {} }, players: {} });
        currentPlayers.forEach(player => {
            if (!playersDiedThisRaid.includes(player)) {
                initializePlayer(playerData, player);
                const newStreak = (playerData.players[player].currentSurvivalStreak || 0) + 1;
                playerData.players[player].currentSurvivalStreak = newStreak;
            }
        });
        saveData(STATS_DATA_FILE_PATH, playerData);
        updateStatsFromProfiles();
        setDiscordStatus("Ended");
        currentRaidState = "Waiting for Raid";
        currentPlayers = [];
        currentRaidBosses = [];
        playersDiedThisRaid = [];
        currentRaidMap = "N/A";
        currentRaidTime = "N/A";
        achievementsChanged = true;
    }

    if (achievementsChanged) {
        updateStatsEmbed();
    }
    redrawUI();
};
// --- Main Application Start ---
async function main() {
    console.log('--- Initializing Notifier ---');
    if (!RAID_STATUS_WEBHOOK_URL.includes('https://discord.com/api/webhooks/') || !ACHIEVEMENTS_WEBHOOK_URL.includes('https://discord.com/api/webhooks/')) {
        console.error('\x1b[31m[FATAL STARTUP ERROR]\x1b[0m One or both webhook URLs are invalid.');
        return;
    }
    if (!fs.existsSync(LOG_FILE_PATH)) {
        console.error(`\x1b[31m[FATAL STARTUP ERROR]\x1b[0m Log file not found: ${LOG_FILE_PATH}`);
        return;
    }
    console.log('Validation checks passed.');
    const messageIds = loadData(MESSAGE_ID_FILE_PATH, { statsMessageId: null });
    statsMessageId = messageIds.statsMessageId;
    killFeedMessages = loadData(KILL_FEED_HISTORY_PATH, []);
    logToUI("Kill feed loaded. Will not clear old messages.");
    try {
        let lastSize = fs.statSync(LOG_FILE_PATH).size;
        fs.watchFile(LOG_FILE_PATH, { persistent: true, interval: 500 }, (curr, prev) => {
            if (curr.mtime <= prev.mtime) return;
            if (curr.size < lastSize) { lastSize = 0; }
            if (curr.size > lastSize) {
                const stream = fs.createReadStream(LOG_FILE_PATH, { start: lastSize, end: curr.size - 1, encoding: 'utf-8' });
                lastSize = curr.size;
                stream.on('data', (chunk) => {
                    chunk.toString().split('\n').forEach(line => {
                        if (line.trim() !== '') processLogLine(line);
                    });
                });
                stream.on('error', (err) => {
                    logToUI(`Error reading log file.`);
                    console.error('[ERROR] File stream error:', err);
                });
            }
        });
    } catch (error) {
        console.error('\x1b[31m[FATAL STARTUP ERROR]\x1b[0m Could not monitor log file.', error);
        return;
    }
    logToUI("Performing initial stat sync from profiles...");
    updateStatsFromProfiles();
    await updateStatsEmbed();
    await setDiscordStatus("Ended");
    logToUI("Initialization complete. Monitoring for raids...");
    setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinner.length;
        redrawUI();
    }, 250);
}

main();
