import { Container } from '../../Container.js'
import { getSelection } from '../utils/common.js'
 
export class ContainerClipboard {
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

	copy (e) {
		let selection = getSelection()
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
		let selection = getSelection()
		if (selection.length > 0) {
			parent = selection[0]
		}

		let paste = (e.clipboardData || window.clipboardData).getData('text');
	 	console.log(`${this.appId} - paste ${paste.length}B`)

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