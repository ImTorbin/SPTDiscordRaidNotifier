This script enhances your Single Player Tarkov (SPT-AKI) server by sending real-time raid information to your Discord server via webhooks. Get automatic notifications for raid starts and a live feed of boss kills.

Please note that this is an early iteration. Suggestions and bug reports are welcome!

❗ Prerequisites
Before you begin, please ensure you have the following:

An installed and working SPT-Fika server.

Boss Notifier Mod: This mod is required for the Boss Kill Feed to function correctly.

Download Link: https://hub.sp-tarkov.com/files/file/1737-boss-notifier

A Discord server where you have permissions to create and manage webhooks.

Two separate text channels in your Discord server: one for general raid notifications and one for the boss kill feed.

🔧 Installation and Configuration

Step 1: Install the Required Mod
Download the Boss Notifier mod from the link above and install it according to its instructions (typically by extracting it into your user/mods/ directory).

Step 2: Copy Script Files
Copy the contents of this folder into your SPT server's root directory.

Step 3: Configure Your Webhooks

In your Discord server, create a webhook for your raid notifications channel and a second webhook for your boss kill feed channel.

Open the raid_dashboard.js file in a text editor (like Visual Studio Code or Notepad++).

Find the lines that define the webhook URLs:

// Paste your Discord webhook URLs here
const RAID_WEBHOOK_URL = 'YOUR_RAID_NOTIFICATION_WEBHOOK_URL_HERE';

const BOSS_KILL_WEBHOOK_URL = 'YOUR_BOSS_KILL_FEED_WEBHOOK_URL_HERE';


Replace the placeholder text with your actual webhook URLs. Make sure to keep the single quotes ' ' around each URL.

🚀 Usage
After completing the installation and configuration, run the included batch file. The script will start alongside your SPT server and automatically send raid information to your configured Discord channels.

⚠️ Known Issues & Limitations
This script currently requires a headless client to run. A version that can operate without one has not yet been developed.

As an early version, you may encounter bugs.

🤔 Troubleshooting
No notifications are being sent: Double-check that your webhook URLs are correctly pasted into the raid_dashboard.js file. Verify there are no typos and that the URLs are enclosed in single quotes.

Boss kill notifications are missing: Ensure you have correctly installed the mandatory Boss Notifier mod in your user/mods/ folder.
