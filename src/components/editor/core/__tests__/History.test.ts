import { createDocumentFromMarkdown, documentToMarkdown } from "../Document";
import { History } from "../History";
import { TransactionBuilder } from "../Transaction";

describe("History", () => {
	it("undoes and redoes a transaction", () => {
		const history = new History({ groupingDelay: 0 });
		const original = createDocumentFromMarkdown("Alpha");
		const transaction = new TransactionBuilder()
			.updateContent(0, "Alpha", "Beta")
			.build();

		history.push(transaction, original);
		const undo = history.popUndo(original);
		expect(undo).not.toBeNull();
		if (!undo) {
			throw new Error("Expected undo transaction");
		}

		const updated = transaction.operations.reduce(
			(document, operation) => operation.apply(document),
			original,
		);
		const restored = undo.operations.reduce(
			(document, operation) => operation.apply(document),
			updated,
		);

		expect(documentToMarkdown(restored)).toBe(documentToMarkdown(original));
		expect(history.canRedo).toBe(true);

		const redo = history.popRedo(restored);
		expect(redo).not.toBeNull();
		if (!redo) {
			throw new Error("Expected redo transaction");
		}
		expect(
			documentToMarkdown(
				redo.operations.reduce(
					(document, operation) => operation.apply(document),
					restored,
				),
			),
		).toBe(documentToMarkdown(updated));
	});

	it("groups transactions within the configured delay", () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-03-17T10:00:00Z"));

		const history = new History({ groupingDelay: 500 });
		const document = createDocumentFromMarkdown("Alpha");
		const first = new TransactionBuilder()
			.updateContent(0, "Alpha", "Beta")
			.build();
		const second = new TransactionBuilder()
			.insertBlock(1, {
				...document.blocks[0],
				id: "block_static",
				content: "Gamma",
			})
			.build();

		history.push(first, document);
		jest.advanceTimersByTime(200);
		history.push(second, document);

		expect(history.undoDepth).toBe(1);

		jest.useRealTimers();
	});

	it("ignores empty transactions and trims history to max undo levels", () => {
		const history = new History({ maxUndoLevels: 2, groupingDelay: 0 });
		const document = createDocumentFromMarkdown("Alpha");

		history.push(new TransactionBuilder().build(), document);
		expect(history.undoDepth).toBe(0);

		history.push(
			new TransactionBuilder().updateContent(0, "Alpha", "Beta").build(),
			document,
		);
		history.push(
			new TransactionBuilder().updateContent(0, "Beta", "Gamma").build(),
			document,
		);
		history.push(
			new TransactionBuilder().updateContent(0, "Gamma", "Delta").build(),
			document,
		);

		expect(history.undoDepth).toBe(2);
	});
});
