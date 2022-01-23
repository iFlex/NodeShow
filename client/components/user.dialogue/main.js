//[TODO]: make it pretty...
export class UserDialogue {
	appId = "user.dialogue"
	#container = null;
	#enabled = false
	
	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
		}
	}

	isEnabled () {
		return this.#enabled
	}

	toast(message, options) {
		alert(message)
	}

	confirm(message, onComplete) {
		let result = confirm(message)
		if (typeof onComplete === 'function') {
			onComplete(result)
		}
	}

	alert(message, onClose) {
		alert(message)
		if (typeof onClose === 'function') {
			onClose();
		}
	}

	addStackMessage(message, options) {
		alert(message)
	}
}