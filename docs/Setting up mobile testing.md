# Mobile testing

## Connecting with physical device 
### Set up ADB

ADB is used to connect the phone with the laptop.

1. Install ADB on laptop
2. Turn on developer settings and pair laptop with phone via ADB
3. Make sure hotspot is enabled and laptop is connected to hotspot internet

### Set up Cursor's debug mode

1. Find the mac's IP address: `ipconfig getifaddr en0`
2. Turn on debug mode, it should open an ingest server.
3. Set this in laptop to expose the port to the phone: `adb reverse tcp:[port] tcp:[port]`
4. Confirm that there are logs in .cursor/debug.log


## Connecting with Android emulator (multi agent testing)

1. Follow these steps to install Android emulator: https://abp.io/docs/10.0/framework/ui/react-native/setting-up-android-emulator#:~:text=In%20this%20document,Startup%20Issues%20(macOS/Linux):
2. Two emulators are created: `1emu` and `2emu`. Start them with AVD manager like: `emulator -avd [emu name]`
3. Set up the emulator like: `emulator -avd [emu name] -no-window`
4.  Install the apk with this command: `eas build -p android --profile preview` then do: adb install `[build]` -p
5. 