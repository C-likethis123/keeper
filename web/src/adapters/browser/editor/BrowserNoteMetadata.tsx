import { FilterChip } from "@keeper/components/shared/FilterChip";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import type { CanonicalNoteStatus, CanonicalNoteType } from "@keeper/features/notes/note-contract";
import { ThemeProvider } from "@react-navigation/native";

const TYPES: Array<[CanonicalNoteType, string]> = [["note", "Note"], ["journal", "Journal"], ["resource", "Resource"], ["todo", "Todo"], ["template", "Template"], ["drawing", "Drawing"]];
const STATUSES: Array<[CanonicalNoteStatus, string]> = [["open", "Open"], ["doing", "Doing"], ["blocked", "Blocked"], ["done", "Done"]];

/** Browser wiring around canonical Expo metadata chips. */
export function BrowserNoteMetadata({ noteType, status, onNoteType, onStatus }: { noteType: CanonicalNoteType; status: CanonicalNoteStatus | null; onNoteType: (type: CanonicalNoteType) => void; onStatus: (status: CanonicalNoteStatus) => void }) {
	return <ThemeProvider value={darkTheme}><section className="browser-editor-type" aria-label="Note metadata"><div>{TYPES.map(([value, label]) => <FilterChip key={value} label={label} selected={noteType === value} onPress={() => onNoteType(value)} />)}</div>{noteType === "todo" ? <div>{STATUSES.map(([value, label]) => <FilterChip key={value} label={label} selected={(status ?? "open") === value} onPress={() => onStatus(value)} />)}</div> : null}</section></ThemeProvider>;
}
