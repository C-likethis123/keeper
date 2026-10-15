These WOFF2 fonts and glyph maps contain only Keeper's used icons.
Original fonts and maps from `@expo/vector-icons` 15.0.3 live under
`scripts/icon-sources/`; only subsets under `src/assets/icons/` ship.
`src/components/shared/Icons.tsx` renders the maps; browser CSS loads the fonts.

- FontAwesome.woff2: Font Awesome 4.7, Dave Gandy. SIL OFL 1.1; see OFL-1.1.txt.
  Upstream: https://github.com/FortAwesome/Font-Awesome/tree/v4.7.0
- Ionicons.woff2: Ionic. MIT; see Ionicons-LICENSE.txt.
  Upstream: https://github.com/ionic-team/ionicons
- MaterialCommunityIcons.woff2: Pictogrammers Material Design Icons. See
  MaterialCommunityIcons-LICENSE.txt and Apache-2.0.txt.
  Upstream: https://github.com/Templarian/MaterialDesign-Webfont
- Glyph maps: retained Expo/react-native-vector-icons MIT notices in
  expo-vector-icons-LICENSE.txt and react-native-vector-icons-LICENSE.txt.

To add icons, update `scripts/icon-sources/used-icons.json`, then run
`python3 scripts/subset-icons.py` with `fonttools[woff]` installed
(e.g. in a temporary virtual environment). Commit regenerated JSON and WOFF2
files together. Normal installs and builds need no Python dependencies.

Icon components accept only names present in generated maps, so typecheck
flags missing additions, including names passed through shared wrappers.
Unknown names from untyped callers still render empty.
