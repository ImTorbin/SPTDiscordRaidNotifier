Raid Dashboard Script: Installation and Configuration Guide
<HEADLESS CLIENT ONLY>

I have not worked out a version that is able to run without a headless client.

This guide provides instructions on how to install and configure the raid dashboard script for your SPT server. The script is designed to automatically send relevant raid information to a configured webhook, such as a Discord channel. Please keep in mind this is an early iteration. Suggestions and bugs are welcome to be brought to my attention.

🔧 Installation and Configuration
Step 1: Copy Files
Copy the contents of this folder into your SPT server's root directory.

Step 2: Configure Webhook
Open the raid_dashboard.js file in a text editor (like Visual Studio Code or Notepad++).

Find the line that defines the webhook URL:

Code
const WEBHOOK_URL = 'https://discord.com/api/webhooks/';
Replace 'https://discord.com/api/webhooks/' with your Discord webhook URL, making sure to keep the single quotes around the URL.

🚀 Usage
After completing these steps, run the included batch file and the script will run alongside your SPT server and send raid information to your configured webhook.

⚠️ Troubleshooting
If you encounter any issues, please double-check your webhook URL and log file path for typos or incorrect formatting.
