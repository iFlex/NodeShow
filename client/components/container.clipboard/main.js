import { container } from '../../nodeshow.js'
import { Container } from '../../Container.js'
import { getSelection } from '../utils/common.js'
 
class ContainerClipboard {
	appId = "container.clipboard"
	#container = null;
	#enabled = false
	#handlers = {}

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);

		this.#handlers['paste'] = (event) => this.paste(event)
		this.#handlers['copy'] = (event) => this.copy(event)
		this.#handlers['cut'] = (event) => this.cut(event)	
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
			for (const [key, value] of Object.entries(this.#handlers)) {
				document.addEventListener(key, value)
			}
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
			for (const [key, value] of Object.entries(this.#handlers)) {
				document.removeEventListener(key, value)
			}
		}
	}

	isEnabled () {
		return this.#enabled
	}

	translateIds (descriptor) {
		let idmap = {}
		for (const record of descriptor) {
			idmap[record.id] = Container.generateUUID()
		}

		for (const record of descriptor) {
			record.id = idmap[record.id]
			record.parentId = idmap[record.parentId]
			if (record.childNodes) {
				for (const child of record.childNodes) {
            		if(!child.id) {
            			child.id = idmap[child.id]
            		}
            	}
			}
		}
	}

	copy (e) {
		let selection = getSelection()
		if (selection.length > 0) {
			let clipboard = []
			let travqueue = []
			let idmap = {}
			for (const id of selection) {
				try {
					let container = this.#container.lookup(id)
					let descriptor = this.#container.toSerializable(container)
					
					idmap[descriptor.id] = ""
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
				idmap[descriptor.id] = ""

				clipboard.push(descriptor)
				if (node.children) {
					for (const child of node.children) {
						travqueue.push(child)
					}
				}	
				i++
			}
			console.log(`${this.appId} - copy`)
			console.log(clipboard)
			
			let data = JSON.stringify(clipboard)
			e.clipboardData.setData("text/plain", data)
			//[TODO]Warning: this will prevent regular execution. Figure out how to integrate with text editor
			e.preventDefault()
		}
	}

	paste (e) {
		let parent = this.#container.parent
		let selection = getSelection()
		if (selection.length > 0) {
			parent = selection[0]
		}

		let paste = (e.clipboardData || window.clipboardData).getData('text');
	 	console.log(`${this.appId} - paste`)
		console.log(paste)

	 	let toBuild = JSON.parse(paste)
	 	this.translateIds(toBuild)
		
	 	for (const desc of toBuild) {
	 		this.#container.createFromSerializable(desc.parentId || parent, desc, null, this.appId)
	 	}   
	 }

	cut (e) {
		this.copy(e)
		console.log(`${this.appId} - cut`)
		let selection = getSelection()
		for (const id of selection) {
			this.#container.delete(id, this.appId)
		}
	}

}

let ccp = new ContainerClipboard(container)
ccp.enable()