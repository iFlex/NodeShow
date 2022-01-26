export class TextSize {

	#container = null
	#textEditor = null
	#measurer = null

	constructor (container, textEditor) {
		this.#container = container
		this.#textEditor = textEditor
		
		this.#measurer = this.#container.createFromSerializable(document.body, {
			nodeName: 'DIV',
			computedStyle: {
				'width':'auto',
				'height':'auto',
				'position':'absolute',
				'top':'-9999px',
				'left':'-9999px',
				'white-space':'pre'
			}
		}, null, textEditor.appId)
	}

	#loadText(text, style) {
		this.#measurer.innerHTML = text
		this.#container.styleChild(this.#measurer, style, this.#textEditor.appId)
	}

	positionToCharNumber (text, style, top, left) {
		this.#loadText("", style)

		let lastW = 0
		let w = this.#container.getWidth(this.#measurer)
		let i = 0
		while (w < left && i < text.length) {
			this.#measurer.innerHTML += text[i++]
			lastW = w
			w = this.#container.getWidth(this.#measurer)
		}
		
		let lastCharWidth = w - lastW
		let widthWithinLastChar = left - lastW
		if (widthWithinLastChar <= 0 || (widthWithinLastChar <= (lastCharWidth / 2))) {
			this.#measurer.innerHTML = this.#measurer.innerHTML.substring(0, this.#measurer.innerHTML.length - 1)
		}

		return this.#measurer.innerHTML.length
	}

	charNumberToPosition (text, style, charNo) {
		this.#loadText(text.substring(0, charNo), style)
		let w = this.#container.getWidth(this.#measurer)
		return {
			top: 0,
			left: w
		}
	}
}