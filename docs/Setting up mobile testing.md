# Set up ADB

ADB is used to connect the phone with the laptop.

1. Install ADB on laptop
2. Turn on developer settings and pair laptop with phone via ADB


# Set up Cursor's debug mode

1. Find the mac's IP address: `ipconfig getifaddr en0`
2. Turn on debug mode, it should open an ingest server.
3. Set this in laptop to expose the port to the phone: `adb reverse tcp:[port] tcp:[port]`
4. Confirm that there are logs in .cursor/debug.log