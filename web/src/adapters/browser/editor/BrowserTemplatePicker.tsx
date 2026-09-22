import type { BrowserNote } from "@web/ui/noteRepository";

type Props = {
	open: boolean;
	templates: BrowserNote[];
	onApply: (markdown: string) => void;
	onDismiss: () => void;
};

/** Browser port of TemplatePickerModal. Data stays behind browser notes boundary. */
export function BrowserTemplatePicker({
	open,
	templates,
	onApply,
	onDismiss,
}: Props) {
	if (!open) return null;
	return (
		<div
			className="browser-history-backdrop"
			role="presentation"
			onMouseDown={onDismiss}
		>
			<dialog
				className="browser-history-modal"
				open
				aria-labelledby="template-title"
				onMouseDown={(event) => event.stopPropagation()}
			>
				<header>
					<div>
						<h2 id="template-title">Choose template</h2>
						<p>Pick template content to insert.</p>
					</div>
					<button
						type="button"
						aria-label="Close templates"
						onClick={onDismiss}
					>
						×
					</button>
				</header>
				{templates.length ? (
					<ul className="browser-history-list">
						{templates.map((template) => (
							<li key={template.id}>
								<button
									type="button"
									className="browser-history-entry"
									onClick={() => {
										onApply(template.content);
										onDismiss();
									}}
								>
									<strong>{template.title || "Untitled template"}</strong>
									<span>
										{template.content.slice(0, 80) || "Empty template"}
									</span>
								</button>
							</li>
						))}
					</ul>
				) : (
					<p className="browser-history-loading">
						No templates yet. Change a note type to Template first.
					</p>
				)}
			</dialog>
		</div>
	);
}
