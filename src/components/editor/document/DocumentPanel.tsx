import "@/components/shared/shared.css";
import type React from "react";
import { useStyles } from "@/hooks/useStyles";
import {
	DocumentPanelHeader,
	createDocumentPanelStyles,
	openExternalUrl,
} from "./DocumentPanel.shared";

const createStyles = (theme: Parameters<typeof createDocumentPanelStyles>[0]) =>
	createDocumentPanelStyles(theme, { showRightBorder: true });

export function DocumentPanel(props: {
	variant: "article";
	url: string;
	onDismiss: () => void;
	theme?: "dark" | "light";
	style?: React.CSSProperties;
}) {
	const styles = useStyles(createStyles);
	return (
		<div
			className="keeper-layout"
			style={{ ...styles.panel, ...props.style }}
			data-testid="article-split-panel"
		>
			<DocumentPanelHeader
				dismissLabel="Hide article"
				iconName="newspaper-o"
				onDismiss={props.onDismiss}
				onOpenExternally={() => openExternalUrl(props.url)}
				openExternalLabel="Open article externally"
				styles={styles}
				title="Article"
			/>
			<div className="keeper-layout" style={styles.viewerContainer}>
				<iframe
					src={props.url}
					title="Article"
					style={{
						border: "0",
						width: "100%",
						height: "100%",
						backgroundColor: "#ffffff",
					}}
				/>
			</div>
		</div>
	);
}
