import { ACTIONS } from '../../Container.js'
import { getSelection, lookupStyleRules } from '../utils/common.js'

//ToDo: implement. 
//importance: this allows determining how content is arranged, setting overflow rules, how to position elements
export class ContainerConfig {
	appId = 'container.configure'
	container = null;
	selection = null;
	
	type = 'transactional'
	modal = true
    displayName = "Config"

	#enabled = false
	#interface = null;
	#handlers = {}
	layouts = {
		"none":{
			"childClassName":"", 
			"parentClassName":""
		},
		"horizontal-list":{
			"childClassName":"ns-horizontal-list-unit", 
			"parentClassName":"ns-horizontal-list"
		},
		"vertical-list":{
			"childClassName":"ns-vertical-list-unit", 
			"parentClassName":"ns-vertical-list"
		},
		"grid":{
			"childClassName":"ns-grid-unit", 
			"parentClassName":"ns-grid"
		}
	}

	constructor (container) {
		this.container = container;
		container.registerComponent(this);
		
		this.#handlers['container.select.selected'] = (e) => this.onFocus(e.detail.id)
		this.#handlers['container.blur'] = (e) => this.onUnfocus(e)

		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"128px",
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

		//preload
		for (let entry of Object.entries(this.layouts)) {
			entry.parentStyle = lookupStyleRules(entry.parentClassName)
			entry.childStyle = lookupStyleRules(entry.childClassName)
		}
	}

	enable() {
		if (!this.#enabled) {
			this.#enabled = true

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.container.addEventListener(event, handler)
			}

			this.container.show(this.#interface, this.appId)
			this.container.bringToFront(this.#interface, this.appId)
			this.onFocus()
		}
	}

	disable() {
		if (this.#enabled) {
			this.#enabled = false

			for ( const [event, handler] of Object.entries(this.#handlers)) {
				this.container.removeEventListener(event, handler)
			}

			this.container.hide(this.#interface, this.appId)
		}
	}

	isEnabled() {
		return this.#enabled
	}

	onFocus(id) {
		this.selection = getSelection(this.container);
	}

	onUnfocus(e) {
		this.selection = [];
	}

	applyChanges() {
		this.selection = getSelection(this.container);
	}

	lockPosition() {
		this.selection = getSelection(this.container);
		for (const target of this.selection) {
			this.container.setPermission(target, ACTIONS.setPosition, "*", false, this.appId)
		}
	}

	unlockPosition() {
		this.selection = getSelection(this.container);
		for (const target of this.selection) {
			this.container.removePermission(target, ACTIONS.setPosition, null, this.appId)
		}
	}

	lockWidth() {
		this.selection = getSelection(this.container);
		for (const target of this.selection) {
			this.container.setPermission(target, ACTIONS.setWidth, "*", false, this.appId)
		}
	}

	unlockWidth() {
		this.selection = getSelection(this.container);
		for (const target of this.selection) {
			this.container.removePermission(target, ACTIONS.setWidth, null, this.appId)
		}
	}

	lockHeight() {
		this.selection = getSelection(this.container);
		for (const target of this.selection) {
			this.container.setPermission(target, ACTIONS.setHeight, "*", false, this.appId)
		}
	}

	unlockHeight() {
		this.selection = getSelection(this.container);
		for (const target of this.selection) {
			this.container.removePermission(target, ACTIONS.setHeight, null, this.appId)
		}
	}

	changePosType() {
		let type = document.getElementById('ns-pos-type').value
		this.selection = getSelection(this.container)
		for (const target of this.selection) {	
			let node = this.container.lookup(target)
			if (type == 'absolute') {
				let prevPos = this.container.getPosition(node)
				this.container.styleChild(node, {"position": type}, this.appId)
				this.container.setPosition(node, prevPos, this.appId)	
			} else {
				this.container.styleChild(node, {"position": type}, this.appId)
			}
		}
	}

	setParentLayout(parent, parentStyle) {
		for (let config of Object.entries(this.layouts)) {
			let style = config.parentStyle || lookupStyleRules(config.parentClassName)
			this.container.removeStyle(parent, style, this.appId)
			config.parentStyle = style
		}
		this.container.styleChild(parent, parentStyle, this.appId)
	}

	changeContentLayout() {
		let type = document.getElementById('ns-content-layout').value
		let layoutConfig = this.layouts[type]
		layoutConfig.parentStyle = layoutConfig.parentStyle || lookupStyleRules(layoutConfig.parentClassName)
		layoutConfig.childStyle = layoutConfig.childStyle || lookupStyleRules(layoutConfig.childClassName)

		this.selection = getSelection(this.container)
		for (const target of this.selection) {	
			let node = this.container.lookup(target)
			node.setAttribute("data-child-style", JSON.stringify(layoutConfig.childStyle))
			this.setParentLayout(node, layoutConfig.parentStyle)
		}
	}

	changeHeightUnit() {
		let newUnit = document.getElementById('ns-height-unit').value

		this.selection = getSelection(this.container)
		for (const target of this.selection) {	
			this.container.setHeightUnit(target, newUnit, this.appId)
		}
	}

	changeWidthUnit() {
		let newUnit = document.getElementById('ns-width-unit').value

		this.selection = getSelection(this.container)
		for (const target of this.selection) {	
			this.container.setWidthUnit(target, newUnit, this.appId)
		}
	}

	changePosYUnit() {
		let newUnit = document.getElementById('ns-pos-y-unit').value

		this.selection = getSelection(this.container)
		for (const target of this.selection) {	
			this.container.setPositionUnits(target, {top:newUnit}, this.appId)
		}
	}

	changePosXUnit() {
		let newUnit = document.getElementById('ns-pos-x-unit').value

		this.selection = getSelection(this.container)
		for (const target of this.selection) {	
			this.container.setPositionUnits(target, {left:newUnit}, this.appId)
		}
	}
}	