# Over the air updates

# Minor Updates 

These types of changes are eligible for OTA updates. Nothing else needs to be done.

JS changes, React components, CSS/styling, images, and config files (e.g., app.json changes that don't affect native code).

# Major Updates 

These changes are major and cannot be updated via over the air updates. The runtime version needs to be bumped in this case.

Adding new native libraries
Upgrading the Expo SDK
Changing app permissions
Modifying android/ or ios/ folders necessitates a new build and app store submission.