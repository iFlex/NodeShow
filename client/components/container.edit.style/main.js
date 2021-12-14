import { container } from '../../nodeshow.js'
import { getSelection } from '../utils/common.js'

class ContainerStyler {
	appId = 'container.edit.style'
	container = null;
	#enabled = false
	#interface = null;
	#handlers = {}
	
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

	#applyChange(style) {
		let selection = getSelection();
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

	changeWidthUnit (e) {
		let unit = e.target.value;
		let selection = getSelection();
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
		let selection = getSelection();
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
		let selection = getSelection();
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
		let selection = getSelection();
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