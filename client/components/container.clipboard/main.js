import { Container } from '../../Container.js'
import { getSelection } from '../utils/common.js'
import { getCursorPosition } from '../utils/mouse.js'
import { Clipboard, EVENTS as ClipboardEvents } from "../utils/clipboard.js"

export class ContainerClipboard {
	appId = "container.clipboard"
	type = 'background'

	#clipboard = null;
	#container = null;
	#enabled = false
	
	constructor (container) {
		this.#container = container;
		container.registerComponent(this);

		this.#clipboard = new Clipboard(this.appId)
		this.#clipboard.setAction(ClipboardEvents.paste, 
			(event) => this.paste(event.detail.originalEvent))

		this.#clipboard.setAction(ClipboardEvents.copy, 
			(event) => this.copy(event.detail.originalEvent))

		this.#clipboard.setAction(ClipboardEvents.cut, 
			(event) => this.cut(event.detail.originalEvent))
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			this.#clipboard.enable()
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
			this.#clipboard.disable()
		}
	}

	isEnabled () {
		return this.#enabled
	}

	//[TODO]: not complete, causes persistence issues
	translateIds (clipboard) {
		let idmap = {}
		for (const record of clipboard) {
			idmap[record.id] = Container.generateUUID()
		}
		console.log(`${this.appId} - paste ID translation`)
		console.log(idmap)
		
		for (const record of clipboard) {
			record.id = idmap[record.id]
			record.parentId = idmap[record.parentId]
			if (record.childNodes) {
				for (const child of record.childNodes) {
            		if(child.id) {
            			child.id = idmap[child.id]
            		}
            	}
			}
		}
	}

	normalizePositions(roots, dx, dy) {
		let minPos = null
		//find top left position
		for (const root of roots) {
			let pos = this.#container.getPosition(root)
			if (!minPos || (pos.top <= minPos.top && pos.left <= minPos.left)) {
				minPos = pos 
			}
		}

		//reposition clipboard paste
		for (const root of roots) {
			let pos = this.#container.getPosition(root)
			pos.top = pos.top - minPos.top + dy
			pos.left = pos.left - minPos.left + dx
			this.#container.setPosition(root, pos, this.appId)
		}	
	}

	getRoots(clipboard) {
		let roots = []
		for (const record of clipboard) {
			//only roots will be traspositioned
			if (!record.parentId) {
				roots.push(record.id)
			}
		}
		return roots
	}

	copy (e) {
		let selection = getSelection(this.#container)
		if (selection.length > 0) {
			let clipboard = []
			let travqueue = []
			for (const id of selection) {
				try {
					let container = this.#container.lookup(id)
					let descriptor = this.#container.toSerializable(container)
					descriptor.parentId = null

					clipboard.push(descriptor)
					if (container.children){
						for (const child of container.children) {
							travqueue.push(child)
						}	
					}
				} catch ( e ) {
					console.log(`${this.appId} could not serialize container ${id}`)
					console.error(e)
				}
			}

			let i = 0
			while ( i < travqueue.length ) {
				let node = travqueue[i]
				let descriptor = this.#container.toSerializable(node)
				descriptor.parentId = node.parentNode.id

				clipboard.push(descriptor)
				if (node.children) {
					for (const child of node.children) {
						travqueue.push(child)
					}
				}	
				i++
			}
			
			let data = JSON.stringify(clipboard)
			console.log(`${this.appId} - copy ${data.length}B`)
			console.log(data)
			e.clipboardData.setData("text/plain", data)
			//[TODO]Warning: this will prevent regular execution.
			//Figure out how to integrate with text editor and input fields
			e.preventDefault()
		}
	}

	paste (e) {
		let parent = this.#container.parent
		let selection = getSelection(this.#container)
		let cursorPos = getCursorPosition()

		if (selection.length > 0) {
			parent = selection[0]
		}

		let paste = (e.clipboardData || window.clipboardData).getData('text');
	 	console.log(`${this.appId} - paste ${paste.length}B`)

	 	let toBuild = JSON.parse(paste)
	 	this.translateIds(toBuild)

	 	for (const desc of toBuild) {
	 		let node = this.#container.createFromSerializable(desc.parentId || parent, desc, null, this.appId)
	 	}

	 	this.normalizePositions(this.getRoots(toBuild), cursorPos.x, cursorPos.y)
	 }

	cut (e) {
		this.copy(e)
		console.log(`${this.appId} - cut`)
		let selection = getSelection(this.#container)
		for (const id of selection) {
			this.#container.delete(id, this.appId)
		}
	}
}