
export class DefaultColorPicker {
    appId = 'edit.defaults.colors'

    #enabled = false

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false
		}
	}

	isEnabled() {
		return this.#enabled
	}

    #getRandomColor() {
        let R = Math.floor(Math.random() * 255);
        let G = Math.floor(Math.random() * 255);
        let B = Math.floor(Math.random() * 255);

        return `rgb(${R}, ${G}, ${B})`
    }

    overlayWith(containers) {
        return this.#getRandomColor();
    }

    softOverlayWith(containers) {
        return this.#getRandomColor();
    }
}