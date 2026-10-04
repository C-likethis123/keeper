import AttachVideoModal from "@keeper/components/AttachVideoModal";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import { ThemeProvider } from "@/constants/themes/ThemeProvider";

/** Browser adapter around the canonical Expo video modal. */
export function BrowserAttachVideoModal(props: { visible: boolean; currentVideo?: string | null; onDismiss: () => void; onSave: (url: string) => void; onRemove: () => void }) {
	return <ThemeProvider value={darkTheme}><AttachVideoModal {...props} /></ThemeProvider>;
}
