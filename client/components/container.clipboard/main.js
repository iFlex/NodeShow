import { Container } from '../../Container.js'
import { NoSuitableComponentPresent } from '../../ContainerExcepitons.js'
import { getCursorPosition } from '../utils/mouse.js'
import { Clipboard, EVENTS as ClipboardEvents } from "../utils/clipboard.js"

//[TODO]: integrate nagivator.clipboard API as well
export class ContainerClipboard {
	appId = "container.clipboard"
	type = 'background'

	#clipboard = null;
	#container = null;
	#DOMbuffer = null;
	#enabled = false
	
	constructor (container) {
		this.#container = container;
		container.registerComponent(this);

		this.#clipboard = new Clipboard(this.appId)
		this.#clipboard.setAction(ClipboardEvents.paste, 
			(event) => this.onPaste(event.detail.originalEvent))

		this.#clipboard.setAction(ClipboardEvents.copy, 
			(event) => this.onCopy(event.detail.originalEvent))

		this.#clipboard.setAction(ClipboardEvents.cut, 
			(event) => this.onCut(event.detail.originalEvent))

		this.#DOMbuffer = this.#container.createFromSerializable(document.body, {
			nodeName:"TEXTAREA",
			"data":{
		    	"ignore":true,
		    	"containerPermissions":{
					"container.broadcast":{"*":false},
					"container.bridge":{"*":false}
				}
		    }
		}, null, this.appId)
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

	copy (subset) {
		let selection = this.#container.tryExecuteWithComponent("getSelection")
		if (selection.length > 0) {
			let clipboard = []
			let travqueue = []
			for (const id of selection) {
				try {
					let container = this.#container.lookup(id)
					let descriptor = this.#container.toSerializable(container, false, subset)
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
				let descriptor = this.#container.toSerializable(node, false, subset)
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
			return data
		}
		return undefined
	}

	paste (data) {
		let parent = this.#container.parent
		let selection = this.#container.tryExecuteWithComponent("getSelection")
		let cursorPos = getCursorPosition()

		if (selection.length > 0) {
			parent = selection[0]
		}

	 	console.log(`${this.appId} - paste ${data.length}B`)

	 	let toBuild = JSON.parse(data)
	 	this.translateIds(toBuild)

	 	for (const desc of toBuild) {
	 		this.#container.createFromSerializable(desc.parentId || parent, desc, null, this.appId)
	 	}

	 	this.normalizePositions(this.getRoots(toBuild), cursorPos.x, cursorPos.y)
	 }

	//[TODO]: consider if subset should be supported in cutting too
	cut () {
		let data = this.copy()
		console.log(`${this.appId} - cut ${data.length}B`)
		
		let selection = this.#container.tryExecuteWithComponent("getSelection")
		this.#container.tryExecuteWithComponent("clearSelection")
		for (const id of selection) {
			this.#container.delete(id, this.appId)
		}
		return data
	}

	//ToDo: set appropriate data type based on what's copied. I.e. groups of containers = json, picture element: image, text editor selection: rich text
	//add URL detection
	onCopy(e) {
		let data = this.copy()
		if (data) {
			e.clipboardData.setData("application/json", data)
			e.preventDefault()
		}
	}

	//ToDo: add decoders for supported data types
	onPaste(e) {
		console.log(`[${this.appId}] pasted data types ${JSON.stringify(e.clipboardData.types)}`)
		for (const type of e.clipboardData.types) {
			let operation = `materialize:${type}`
			try {
				this.#container.tryExecuteWithComponent(operation, e.clipboardData, this.#container.tryExecuteWithComponent("getSelection"), this.appId)
				return;
			} catch (e) {
				if (!(e instanceof NoSuitableComponentPresent)) {
					console.error(`Failed to process clipboard data as ${type} using ${operation}`, e);
					return;
				}
			}
		}

		let data = (e.clipboardData || window.clipboardData).getData("application/json")
		if (data) {
			this.paste(data)
		}
	}

	onCut(e) {
		let data = this.cut()
		if (data) {
			e.clipboardData.setData("application/json", data)
			e.preventDefault()
		}
	}

	doCopy(subset) {
		let data = this.copy(subset)
		if (data) {
			this.#DOMbuffer.value = data
			this.#DOMbuffer.select();
			document.execCommand("copy");
		}
	}

	doPaste(subset) {
		this.#DOMbuffer.focus();
		document.execCommand("paste");
	}

	doCut(subset) {
		let data = this.cut(subset)
		if (data) {
			this.#DOMbuffer.value = data
			this.#DOMbuffer.select();
  			document.execCommand("cut");
		}
	}
}