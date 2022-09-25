import { getSelection, positionVerticalMenu } from '../utils/common.js'
import { Clipboard, EVENTS as ClipboardEvents } from '../utils/clipboard.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

export class ContainerStyler {
	appId = 'container.edit.style'
	container = null;
	displayName = "Style"
	type = 'transactional'
	modal = true

	#enabled = false
	#interface = null;
	#handlers = {}
	#clipboard = null
	#keyboard = null
	
	stateKeys = ["background-color","border-color","border-style","border-width","border-radius"]

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		
		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"className":"ns-vertical-slice-interface",
			"computedStyle":{
				"top":"0px",
				"left":"64px",
				"position":"fixed"
			},
			"data":{
		    	"ignore":true,
		    	"containerPermissions":{
					"container.broadcast":{"*":false},
					"container.bridge":{"*":false}
				}
		  }
		},
		null,
		this.appId)
		this.container.hide(this.#interface, this.appId)
		this.container.loadHtml(this.#interface, "interface.html", this.appId)

		this.#clipboard = new Clipboard(this.appId);
		for (let evid of Object.values(ClipboardEvents)) {
			this.#clipboard.setAction(evid,
			  (event) => {},//noop
			  ACCESS_REQUIREMENT.EXCLUSIVE)
		}

		this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.EXCLUSIVE)
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.container.addEventListener(event, handler)
			}

			this.container.show(this.#interface, this.appId)
			this.container.bringToFront(this.#interface, this.appId)
			positionVerticalMenu(this.container, this.#interface, this.appId)
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false
			this.onTextFieldBlur()

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.container.removeEventListener(event, handler)
			}
			this.container.hide(this.#interface, this.appId)
		}
	}

	isEnabled() {
		return this.#enabled
	}

	#applyChange(style) {
		let selection = getSelection(this.container);
		console.log(`${this.appId} got selection:`)
		console.log(selection)
		for ( const item of selection ) {
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
		this.container.setMetadata(null, 'border-style', bstyle)
		this.#applyChange(bstyle)
	}

	changeBorderColor (e) {
		this.container.setMetadata(null, 'border-color', e.target.value)
		this.#applyChange({'border-color':e.target.value})
	}

	changeBorderSize (e) {
		let borderSize = document.getElementById('ns-border-size').value
		let unit       = document.getElementById('ns-border-size-unit').value
		let size       = `${borderSize}${unit}`

		this.container.setMetadata(null, 'border-width', size)
		this.#applyChange({'border-width':size})	
	}

	changeBorderCorners (e) {
		let corner_id = 'ns-corner-'
		let value = ''
		for (let i = 1; i < 5; ++i) {
			let corner1     = document.getElementById(`${corner_id}${i}`).value
			let unit1       = document.getElementById(`${corner_id}${i}-unit`).value
			let value1       = `${corner1}${unit1}`	

			if (corner1.length > 0) {
				value += value1 + ' '	
			}
		}
		console.log(`${this.appId} setting border config ${value}`)

		this.container.setMetadata(null, 'border-radius', value)
		this.#applyChange({'border-radius': value})	
	}

	changeShape (e) {
		this.changeBorderType(e);
	}

	changeMarginOrPadding (e) {
		let styleKey = e.target.getAttribute("name")
		let value = e.target.value
		let unit = document.getElementById(`${styleKey}-unit`).value
		let toset = `${value}${unit}`

		let style = {}
		style[styleKey] = toset
		this.container.setMetadata(null, styleKey, toset)
		this.#applyChange(style)
	}
	
	getStyleKeys() {
		return this.stateKeys
	}

	onTextFieldFocus() {
		this.#clipboard.enable()
		this.#keyboard.enable()
	}

	onTextFieldBlur() {
		this.#clipboard.disable()
		this.#keyboard.disable()
	}
}