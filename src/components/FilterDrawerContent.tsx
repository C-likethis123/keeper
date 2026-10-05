import "@/components/shared/shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { SyncAccessButton } from "@/components/SyncAccessButton";
import type { NoteStatus, NoteType } from "@/services/notes/types";
import { useFilterStore } from "@/stores/filterStore";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";
import { useSafeAreaInsets } from "@/components/shared/SafeArea";

const FILTER_OPTIONS: { label: string; value?: NoteType }[] = [
	{ label: "All notes", value: undefined },
	{ label: "Journals", value: "journal" },
	{ label: "Resources", value: "resource" },
	{ label: "Todos", value: "todo" },
	{ label: "Drawings", value: "drawing" },
];

const STATUS_OPTIONS: { label: string; value?: NoteStatus }[] = [
	{ label: "All", value: undefined },
	{ label: "Open", value: "open" },
	{ label: "Doing", value: "doing" },
	{ label: "Blocked", value: "blocked" },
	{ label: "Done", value: "done" },
];

function FilterRow({
	label,
	selected,
	onPress,
	theme,
	styles,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	theme: ExtendedTheme;
	styles: ReturnType<typeof createStyles>;
}) {
	return (
		<button
			type="button"
			className="keeper-control"
			style={{ ...styles.option, ...(selected ? styles.optionSelected : {}) }}
			onClick={onPress}
			aria-pressed={true}
		>
			<span
				className="keeper-copy"
				style={{
					...styles.optionText,
					...(selected ? styles.optionTextSelected : {}),
				}}
			>
				{label}
			</span>
			{selected ? (
				<FontAwesome
					name="check"
					size={16}
					color={theme.colors.primaryContrast}
				/>
			) : null}
		</button>
	);
}

export function FilterDrawerContent({
	navigation,
}: {
	navigation: { closeDrawer: () => void };
}) {
	const theme = useStyles(getTheme);
	const styles = useStyles(createStyles);
	const noteTypes = useFilterStore((s) => s.noteTypes);
	const status = useFilterStore((s) => s.status);
	const hideDone = useFilterStore((s) => s.hideDone);
	const setNoteTypes = useFilterStore((s) => s.setNoteTypes);
	const setStatus = useFilterStore((s) => s.setStatus);
	const setHideDone = useFilterStore((s) => s.setHideDone);

	const insets = useSafeAreaInsets();

	const selectedType = noteTypes.length > 0 ? noteTypes[0] : undefined;

	const handleSelectType = (value?: NoteType) => {
		if (value == null) {
			setNoteTypes([]);
			setStatus(undefined);
		} else {
			setNoteTypes([value]);
			if (value !== "todo") {
				setStatus(undefined);
			}
		}
	};

	const handleSelectStatus = (value?: NoteStatus) => {
		setStatus(value);
		navigation.closeDrawer();
	};

	return (
		<div
			className="keeper-layout"
			style={{ ...styles.container, ...{ paddingTop: insets.top } }}
		>
			<div className="keeper-layout" style={styles.header}>
				<span className="keeper-copy" style={styles.headerTitle}>
					Filter
				</span>
				<button
					type="button"
					className="keeper-control"
					onClick={() => navigation.closeDrawer()}
					aria-label="Close filter"
				>
					<FontAwesome name="times" size={20} color={theme.colors.textMuted} />
				</button>
			</div>
			<div
				className="keeper-layout"
				style={{ overflowY: "auto", ...styles.content }}
			>
				<div className="keeper-layout" style={{ ...{} }}>
					<SyncAccessButton
						style={styles.option}
						textStyle={styles.optionText}
					/>
					<span className="keeper-copy" style={styles.sectionTitle}>
						Type
					</span>
					{FILTER_OPTIONS.map((option) => (
						<FilterRow
							key={option.label}
							label={option.label}
							selected={selectedType === option.value}
							onPress={() => handleSelectType(option.value)}
							theme={theme}
							styles={styles}
						/>
					))}
					<span
						className="keeper-copy"
						style={{ ...styles.sectionTitle, ...styles.sectionTop }}
					>
						Options
					</span>
					<FilterRow
						label="Hide done"
						selected={hideDone}
						onPress={() => setHideDone(!hideDone)}
						theme={theme}
						styles={styles}
					/>
					{selectedType === "todo" ? (
						<>
							<span
								className="keeper-copy"
								style={{ ...styles.sectionTitle, ...styles.sectionTop }}
							>
								Status
							</span>
							{STATUS_OPTIONS.map((option) => (
								<FilterRow
									key={option.label}
									label={option.label}
									selected={status === option.value}
									onPress={() => handleSelectStatus(option.value)}
									theme={theme}
									styles={styles}
								/>
							))}
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}

function getTheme(theme: ExtendedTheme): ExtendedTheme {
	return theme;
}

function createStyles(theme: ExtendedTheme) {
	return {
		container: { flex: 1, backgroundColor: theme.colors.background },
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingLeft: 20,
			paddingRight: 20,
			paddingTop: 16,
			paddingBottom: 16,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
		},
		headerTitle: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
		content: {
			flex: 1,
			paddingLeft: 16,
			paddingRight: 16,
			paddingTop: 12,
			paddingBottom: 12,
		},
		sectionTitle: {
			fontSize: 12,
			fontWeight: "700",
			textTransform: "uppercase",
			letterSpacing: 0.5,
			color: theme.colors.textFaded,
			marginTop: 8,
			marginBottom: 6,
		},
		sectionTop: { marginTop: 16 },
		option: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingLeft: 12,
			paddingRight: 12,
			paddingTop: 12,
			paddingBottom: 12,
			borderRadius: 10,
			backgroundColor: theme.colors.card,
			marginBottom: 4,
		},
		optionSelected: { backgroundColor: theme.colors.primary },
		optionText: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
		optionTextSelected: { color: theme.colors.primaryContrast },
	} satisfies Record<string, React.CSSProperties>;
}
