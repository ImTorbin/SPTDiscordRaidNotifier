**Raid Dashboard Script: Installation and Configuration Guide**
This guide provides instructions on how to install and configure the raid dashboard script for your SPT server.
The script is designed to automatically send relevant raid information to a configured webhook, such as a Discord channel.

**🔧 Installation and Configuration**
*Step 1: Copy Files*
Copy the contents of this folder into your SPT server's root directory. This is typically where your Aki.Server.exe is located.

*Step 2: Configure Webhook*
Open the raid_dashboard.js file in a text editor (like Visual Studio Code or Notepad++).

**Find the line that defines the webhook URL:**

const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';

Replace 'YOUR_WEBHOOK_URL_HERE' with your Discord webhook URL, making sure to keep the single quotes around the URL.

*Step 3: Set Log Path*
Locate the line for the log file path:

const BepInEx_LOG_PATH = 'C:/path/to/your/BepInEx.log';

**Update the path to the correct location of your BepInEx.log file. Ensure that the path uses forward slashes (/).**

**🚀 Usage**
After completing these steps, the script will automatically run alongside your SPT server and send raid information to your configured webhook.

**⚠️ Troubleshooting**
If you encounter any issues, please double-check your webhook URL and log file path for typos or incorrect formatting. or send a dm to *@imtorbin* on discord