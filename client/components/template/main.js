export class Template {
	appId = "app.id.here"
	#container = null;
	#enabled = false
	#brick = null;

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
		document.addEventListener('mousemove', (e) => this.mouseMoved(e));
		
		this.#brick = container.createFromSerializable(null, {
			"nodeName":"DIV",
			"computedStyle":{
				"position":"absolute",
				"top":"0px",
				"left":"0px",
				"width":"128px",
				"height":"128px"
			}
		}, null, this.appId)
		//this.#container.loadHtml(null, this.#container.toComponentLocalURL("interface.html", "template"), this.appId)
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

	mouseMoved(e) {
		this.#container.setPosition(this.#brick, {top:e.pageY,left:e.pageX}, this.appId)
	}
}