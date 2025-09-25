// --------------------------------------------------------------------------
// Discord Raid Notifier for SPT/Fika Servers (Node.js Version)
// v3.1 - Patched constant variable assignment error
//
// Monitors a log file for raid events and posts status updates to Discord.
// Features a full terminal UI with separate panels for status and logs.
// --------------------------------------------------------------------------

// --- Global Error Handlers (Safety Net) ---
process.on('uncaughtException', (err, origin) => {
    console.clear();
    console.error('\x1b[31m[CRITICAL ERROR] An uncaught exception occurred! Details below:\x1b[0m');
    console.error(`\x1b[33mError:\x1b[0m`, err);
    console.error(`\x1b[33mOrigin:\x1b[0m`, origin);
    console.log('\x1b[33mThis window will remain open for 60 seconds so you can read the error.\x1b[0m');
    setTimeout(() => {}, 60000); // Keep window open
});
process.on('unhandledRejection', (reason, promise) => {
    console.clear();
    console.error('\x1b[31m[CRITICAL ERROR] An unhandled promise rejection occurred! Details below:\x1b[0m');
    console.error(`\x1b[33mReason:\x1b[0m`, reason);
    console.log('\x1b[33mThis window will remain open for 60 seconds so you can read the error.\x1b[0m');
    setTimeout(() => {}, 60000); // Keep window open
});

import axios from 'axios';
import fs from 'fs';

// --- CONFIGURATION ---
const LOG_FILE_PATH = ".\\BepInEx\\LogOutput.log";
const WEBHOOK_URL = "https://discord.com/api/webhooks/";
const BOT_USERNAME = "SPTorbin Raid Notifier";
const BOT_AVATAR_URL = "https://i.pinimg.com/originals/46/3d/12/463d12a965806fd5322aa4b7e0320952.jpg";
const MENTION_EVERYONE_ON_START = true;
const raidStartPhrases = [
    "Remember to take your meds.",
    "Hurry up Gib.",
    "Got Keys?",
    "Faben is only a lil dumb",
    "Prepare to get **HEAD, EYES.**",
    // Add as many phrases as you like
];

// --- END OF CONFIGURATION ---

// --- RNG Generator for Raid Start Text ---
function getRandomPhrase(array) {
    // Math.random() generates a number between 0 (inclusive) and 1 (exclusive).
    // Multiplying it by the array length gives a number from 0 up to (but not including) the length.
    // Math.floor() converts this to a valid integer index.
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}
// --- UI & State Variables ---
let currentPlayers = [];
let currentStatusMessageId = null;
let currentRaidState = "Waiting for Raid";
let currentRaidMap = "N/A";
let currentRaidTime = "N/A";
let logHistory = [];
const MAX_LOG_HISTORY = 15; // Number of log lines to show in the UI
let spinner = ['|', '/', '-', '\\'];
let spinnerIndex = 0;
let lastStatusMessage = "Initializing...";

// --- Helper Functions ---
const getMapImage = (mapName) => {
    const mapImages = {
        "Customs": "https://cdn.mapgenie.io/images/games/tarkov/maps/customs.jpg",
        "Factory": "https://cdn.mapgenie.io/images/games/tarkov/maps/factory.jpg",
        "Interchange": "https://cdn.mapgenie.io/images/games/tarkov/maps/interchange.jpg",
        "The Lab": "https://cdn.mapgenie.io/images/games/tarkov/maps/lab.jpg",
        "Lighthouse": "https://cdn.mapgenie.io/images/games/tarkov/maps/lighthouse.jpg",
        "Reserve": "https://cdn.mapgenie.io/images/games/tarkov/maps/reserve.jpg",
        "Ground Zero": "https://cdn.mapgenie.io/images/games/tarkov/maps/ground-zero.jpg",
        "Shoreline": "https://cdn.mapgenie.io/images/games/tarkov/maps/shoreline.jpg",
        "Streets of Tarkov": "https://cdn.mapgenie.io/images/games/tarkov/maps/streets.jpg",
        "Woods": "https://cdn.mapgenie.io/images/games/tarkov/maps/woods.jpg"
    };
    return mapImages[mapName] || "";
};

// --- UI Drawing Function ---
const redrawUI = () => {
    console.clear();
    const width = process.stdout.columns;

    // Colors
    const border = "\x1b[90m"; // Gray
    const titleColor = "\x1b[36m\x1b[1m"; // Bright Cyan, Bold
    const labelColor = "\x1b[37m"; // White
    const valueColor = "\x1b[33m"; // Yellow
    const logColor = "\x1b[36m"; // Cyan
    const statusColor = "\x1b[32m"; // Green
    const reset = "\x1b[0m";

    // Header
    console.log(border + "┌" + "─".repeat(width - 2) + "┐" + reset);
    const title = " Discord Raid Notifier ";
    const titlePadding = Math.floor((width - title.length) / 2);
    console.log(border + "│" + " ".repeat(titlePadding) + titleColor + title + reset + " ".repeat(width - title.length - titlePadding - 2) + border + "│" + reset);
    console.log(border + "├" + "─".repeat(width - 2) + "┤" + reset);

    // Status Panel
    console.log(border + "│" + `${labelColor} Map: ${valueColor}${currentRaidMap.padEnd(20)}${labelColor}Time: ${valueColor}${currentRaidTime.padEnd(15)}${labelColor}Players: ${valueColor}${currentPlayers.length}`.padEnd(width - 4) + border + " │" + reset);
    console.log(border + "│" + `${labelColor} Status: ${statusColor}${currentRaidState.padEnd(40)}`.padEnd(width - 4) + border + " │" + reset);
    console.log(border + "├" + "─".repeat(width - 2) + "┤" + reset);

    // Log Panel Header
    const logTitle = " Live Log ";
    const logPadding = Math.floor((width - logTitle.length) / 2);
    console.log(border + "│" + "─".repeat(logPadding) + logTitle + "─".repeat(width - logTitle.length - logPadding - 2) + border + "│" + reset);

    // Log Content
    logHistory.forEach(line => {
        const truncatedLine = line.substring(0, width - 6);
        console.log(border + "│ " + logColor + truncatedLine.padEnd(width - 4) + reset + border + " │" + reset);
    });
    // Fill remaining space
    for (let i = 0; i < MAX_LOG_HISTORY - logHistory.length; i++) {
        console.log(border + "│ " + " ".repeat(width - 4) + border + " │" + reset);
    }

    // Footer
    console.log(border + "└" + "─".repeat(width - 2) + "┘" + reset);
    const footerText = ` ${spinner[spinnerIndex]} Monitoring... (Ctrl+C to stop) | Last Event: ${lastStatusMessage}`;
    process.stdout.write(statusColor + footerText.padEnd(width - 1) + reset);
};

// --- Main Logic ---
const processLogLine = (line) => {
    if (logHistory.length >= MAX_LOG_HISTORY) {
        logHistory.shift();
    }
    logHistory.push(line);

    const raidStartPattern = /\[Info\s*:[^\]]+\] Starting on location (.*)/i;
    const playerJoinPattern = /(?:AddClientToBotEnemies|New player):\s*(.*)/;
    const raidEndPattern = /Destroyed FikaServer|Stopping server for raid/;

    const raidStartMatch = line.match(raidStartPattern);
    const playerJoinMatch = line.match(playerJoinPattern);
    const raidEndMatch = line.match(raidEndPattern);

    let stateChanged = false;

    if (raidStartMatch && currentRaidState === "Waiting for Raid") {
        currentRaidMap = raidStartMatch[1].trim();
        currentRaidTime = "N/A";
        currentPlayers = [];
        currentRaidState = "Raid Starting";
        lastStatusMessage = `Raid starting on ${currentRaidMap}.`;
        setDiscordStatus("Starting");
        stateChanged = true;
    } else if (playerJoinMatch && (currentRaidState === "Raid Starting" || currentRaidState === "In Progress")) {
        const playerName = playerJoinMatch[1].trim();
        if (!currentPlayers.includes(playerName)) {
            currentPlayers.push(playerName);
            if (currentRaidState === "Raid Starting") {
                currentRaidState = "In Progress";
                lastStatusMessage = `First player (${playerName}) joined.`;
                setDiscordStatus("InProgress");
            } else {
                lastStatusMessage = `Player joined: ${playerName}.`;
                updatePlayerListInPlace();
            }
            stateChanged = true;
        }
    } else if (raidEndMatch && currentRaidState !== "Waiting for Raid") {
        lastStatusMessage = "Raid has ended.";
        setDiscordStatus("Ended");
        currentPlayers = [];
        currentRaidMap = "N/A";
        currentRaidTime = "N/A";
        currentRaidState = "Waiting for Raid";
        stateChanged = true;
    }

    if (stateChanged) {
        redrawUI();
    }
};

// --- Discord Interaction ---
let updatePlayerListInPlace = async () => {
    if (!currentStatusMessageId || currentRaidState !== "In Progress") return;

    const playerListString = currentPlayers.map(p => `- ${p}`).join("\n") || "No players detected yet.";
    const playerCount = currentPlayers.length;

    const embed = {
        title: ":white_check_mark: Raid has started :white_check_mark:",
        description: "The raid is active. Please wait until the next raid is ready for players to join.",
        color: 3066993, // Green
        image: { url: getMapImage(currentRaidMap) },
        fields: [
            { name: "Map", value: `**${currentRaidMap}**`, inline: true },
            { name: "Time of Day", value: `**${currentRaidTime}**`, inline: true },
            { name: "Players in Raid", value: `(${playerCount})\n${playerListString}`, inline: false }
        ]
    };

    try {
        await axios.patch(`${WEBHOOK_URL}/messages/${currentStatusMessageId}`, { embeds: [embed] });
    } catch (error) {
        lastStatusMessage = `Failed to update player list: ${error.message}`;
    }
};

let setDiscordStatus = async (state) => {
    // 1. Delete the previous message if one exists
    if (currentStatusMessageId) {
        try {
            await axios.delete(`${WEBHOOK_URL}/messages/${currentStatusMessageId}`);
        } catch (error) {
            lastStatusMessage = `Could not delete previous message.`;
        }
        currentStatusMessageId = null;
    }

    // 2. Build the new embed based on the state
    let embed = {};
    let content = "";

    switch (state) {
        case "Starting":
            // 1. Get a random phrase
            const raidDescriptionPhrase = getRandomPhrase(raidStartPhrases);

            embed = {
                title: ":hourglass_flowing_sand: Raid Starting Soon! :hourglass_flowing_sand:",
                // 2. Use the random phrase in the description
                description: `A new raid is being created and is ready to join! ${raidDescriptionPhrase}`,
                color: 11403055, // Green
                image: { url: getMapImage(currentRaidMap) },
                fields: [
                    { name: "Map", value: `**${currentRaidMap}**`, inline: true },
                    { name: "Time of Day", value: `**${currentRaidTime}**`, inline: true }
                ]
            };
            if (MENTION_EVERYONE_ON_START) {
                content = "@here";
            }
            break;

        case "InProgress":
            const playerListString = currentPlayers.map(p => `- ${p}`).join("\n") || "No players detected yet.";
            const playerCount = currentPlayers.length;
            embed = {
                title: ":x: Raid in Progress! :x:",
                description: "The raid is active. Please wait until the next raid is ready for players",
                color: 16711680, // Red
                image: { url: getMapImage(currentRaidMap) },
                fields: [
                    { name: "Map", value: `**${currentRaidMap}**`, inline: true },
                    { name: "Time of Day", value: `**${currentRaidTime}**`, inline: true },
                    { name: "Players in Raid", value: `(${playerCount})\n${playerListString}`, inline: false }
                ]
            };
            break;

        case "Ended":
            embed = {
                title: ":zzz: No Raid in Progress :zzz:",
                description: "The server is quiet. Waiting for a new raid to start.",
                color: 9807270, // Gray
                image: { url: "https://media.tenor.com/W5pHtj5JE2MAAAAM/escape-from-tarkov-tarkov.gif" },
            };
            break;
    }

    // 3. Post the new message and store its ID
    const payload = {
        username: BOT_USERNAME,
        avatar_url: BOT_AVATAR_URL,
        embeds: [embed],
        content: content
    };

    try {
        const response = await axios.post(`${WEBHOOK_URL}?wait=true`, payload);
        currentStatusMessageId = response.data.id;
    } catch (error) {
        lastStatusMessage = `Failed to post new status: ${error.message}`;
    }
};

// --- Main Monitoring Logic ---
const startMonitoring = () => {
    // Initial UI draw
    redrawUI();

    if (!fs.existsSync(LOG_FILE_PATH)) {
        lastStatusMessage = `Log file not found at '${LOG_FILE_PATH}'.`;
        redrawUI();
        setTimeout(() => process.exit(1), 10000);
        return;
    }
    
    if (!WEBHOOK_URL.startsWith("https://discord.com/api/webhooks/")) {
        lastStatusMessage = "Your Webhook URL is not set correctly.";
        redrawUI();
        setTimeout(() => process.exit(1), 10000);
        return;
    }

    try {
        let lastSize = fs.statSync(LOG_FILE_PATH).size;

        fs.watchFile(LOG_FILE_PATH, { persistent: true, interval: 500 }, (curr, prev) => {
            if (curr.mtime <= prev.mtime) return;
            if (curr.size < lastSize) lastSize = 0;
            if (curr.size > lastSize) {
                const stream = fs.createReadStream(LOG_FILE_PATH, {
                    start: lastSize,
                    end: curr.size - 1,
                    encoding: 'utf-8'
                });
                lastSize = curr.size;
                stream.on('data', (chunk) => {
                    chunk.split('\n').filter(line => line.trim() !== '').forEach(line => {
                        processLogLine(line);
                        redrawUI(); // Redraw for every new log line
                    });
                });
                stream.on('error', (err) => {
                    lastStatusMessage = `Error reading log file: ${err.message}`;
                });
            }
        });

        // Post initial status and start animation
        lastStatusMessage = "Posting initial status to Discord...";
        redrawUI();
        setDiscordStatus("Ended").then(() => {
            lastStatusMessage = "Initial status posted. Monitoring for raids...";
            redrawUI();
        });

        setInterval(() => {
            spinnerIndex = (spinnerIndex + 1) % spinner.length;
            redrawUI();
        }, 250);

    } catch (err) {
        lastStatusMessage = `A startup error occurred: ${err.message}`;
        redrawUI();
        setTimeout(() => process.exit(1), 10000);
    }
};

// --- Stand-in functions for Discord to prevent errors during UI-only testing ---
// These are simplified versions of the real functions that just log the action.
// You can comment these out when you are ready to use the real Discord functionality.

const originalSetDiscordStatus = setDiscordStatus;
setDiscordStatus = async (state) => {
    // console.log(`[DEBUG] Setting Discord status to: ${state}`);
    await originalSetDiscordStatus(state);
};

const originalUpdatePlayerListInPlace = updatePlayerListInPlace;
updatePlayerListInPlace = async () => {
    // console.log(`[DEBUG] Updating player list in place.`);
    await originalUpdatePlayerListInPlace();
};

startMonitoring();

