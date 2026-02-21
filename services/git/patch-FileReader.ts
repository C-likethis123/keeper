/**
 * @format
 */
if (typeof globalThis.FileReader !== "undefined") {
	FileReader.prototype.readAsArrayBuffer = function (blob) {
		if (this.readyState === this.LOADING) throw new Error("InvalidStateError");
		this._setReadyState(this.LOADING);
		this._result = null;
		this._error = null;
		const fr = new FileReader();
		fr.onloadend = () => {
			const content = atob(
				fr.result.substr("data:application/octet-stream;base64,".length),
			);
			const buffer = new ArrayBuffer(content.length);
			const view = new Uint8Array(buffer);
			view.set(Array.from(content).map((c) => c.charCodeAt(0)));
			this._result = buffer;
			this._setReadyState(this.DONE);
		};
		fr.readAsDataURL(blob);
	};

	// from: https://stackoverflow.com/questions/42829838/react-native-atob-btoa-not-working-without-remote-js-debugging
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
	const atob = (input = "") => {
		const str = input.replace(/=+$/, "");
		let output = "";

		if (str.length % 4 === 1) {
			throw new Error(
				"'atob' failed: The string to be decoded is not correctly encoded.",
			);
		}
		for (
			let bc = 0, bs = 0, buffer: string | number = "", i = 0;
			// biome-ignore lint/suspicious/noAssignInExpressions: atob polyfill loop
			(buffer = str.charAt(i++));
			// biome-ignore lint/suspicious/noAssignInExpressions lint/style/noCommaOperator: atob polyfill
			~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
				? // biome-ignore lint/suspicious/noAssignInExpressions: atob polyfill
					(output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
				: 0
		) {
			buffer = chars.indexOf(buffer as string);
		}

		return output;
	};
}
