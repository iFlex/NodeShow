import { container } from '../../nodeshow.js'
import { Mouse } from '../utils/mouse.js'

class ContainerStyler {
	appId = 'container.edit.style'
	container = null;
	#enabled = false
	#interface = null;
	#handlers = {}
	#mouse = null;

	state = {
		backgroundColor: '#000000',
		borderType: null,
		borderWidth: '5px',
		borderColor: 'grey',
		borderRadius: '5px 5px 5px 5px',
		transparency: '0%'
	}

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		
		this.#mouse = new Mouse(this.appId);
		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"64px",
				"position":"absolute"
			},
			"permissions":{"container.broadcast":{"*":false}}
		},
		null,
		this.appId)
		this.container.hide(this.#interface, this.appId)
		this.container.loadHtml(this.#interface, "interface.html", this.appId)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				document.addEventListener(event, handler)
			}

			this.container.show(this.#interface, this.appId)
			this.container.bringToFront(this.#interface, this.appId)
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				document.removeEventListener(event, handler)
			}

			this.container.hide(this.#interface, this.appId)
		}
	}

	isEnabled() {
		return this.#enabled
	}

	getSelection() {
		let selectorApp = this.container.getComponent('container.select')
		let selection = selectorApp.getSelection() || []
		
		let focusTarget = this.#mouse.getFocusTarget();
		if (focusTarget) {
			selection.push(focusTarget)
		}

		return selection
	}

	#applyChange(style) {
		let selection = this.getSelection();
		console.log(`${this.appId} got selection:`)
		console.log(selection)
		for ( const item of selection) {
			try {
				let child = this.container.lookup(item)
				this.container.styleChild(child, style, this.appId)
			} catch (e) {
				console.error(`${this.appId} - failed to style child ${item}`)
				console.error(e)
			}
		}
	}

	#getBorderStyle(trg) {
		let stl = {}
		for (const key of trg.style) {
			if (key.includes('border')) {
				stl[key] = trg.style[key]
			}
		}
		console.log(`${this.appId} - border style:`)
		console.log(stl)
		return stl
	}

	changeBackgroundColor (e) {
		this.container.setMetadata(null, 'background-color', e.target.value)
		this.#applyChange({'background-color':e.target.value})
	}

	changeBorderType (e) {
		console.log(`${this.appId} - changeBorderType`)
		
		let target = e.target
		let bstyle = this.#getBorderStyle(target)
		
		this.container.setMetadata(null, 'border-style', JSON.stringify(bstyle))
		this.#applyChange(bstyle)
	}

	changeBorderColor (e) {
		this.container.setMetadata(null, 'border-color', e.target.value)
		this.#applyChange({'border-color':e.target.value})
	}

	changeShape (e) {
		this.changeBorderType(e);
	}

	changeWidthUnit (e) {
		let unit = e.target.value;
		let selection = this.getSelection();
		for (const item of selection) {
			try {
				let widthPx = this.container.getWidth(item)
				this.container.setWidth(item, widthPx, this.appId, unit)
			} catch( e ){
				console.error(`${this.appId} failed to change width unit to ${unit}`)
			}
		}
	}

	changeHeightUnit (e) {
		let unit = e.target.value;
		let selection = this.getSelection();
		for (const item of selection) {
			try {
				let widthPx = this.container.getHeight(item)
				this.container.setHeight(item, widthPx, this.appId, unit)
			} catch( e ){
				console.error(`${this.appId} failed to change height unit to ${unit}`)
			}
		}
	}

	changePosXUnit (e) {
		let unit = e.target.value;
		let selection = this.getSelection();
		for (const item of selection) {
			try {
				let pos = this.container.getPosition(item)
				pos['leftUnit'] = unit
				this.container.setPosition(item, pos, this.appId)
			} catch( e ){
				console.error(`${this.appId} failed to change x-axis unit to ${unit}`)
			}
		}
	}

	changePosYUnit (e) {
		let unit = e.target.value;
		let selection = this.getSelection();
		for (const item of selection) {
			try {
				let pos = this.container.getPosition(item)
				pos['topUnit'] = unit
				this.container.setPosition(item, pos, this.appId)
			} catch( e ){
				console.error(`${this.appId} failed to change y-axis unit to ${unit}`)
			}
		}
	}
}

let cstyler = new ContainerStyler(container);