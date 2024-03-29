const { ConsoleMessage } = require('puppeteer');
const Events = require('./NodeShowEvents')
const SecurityFilter = require('./SecurityFilter')

console.log(Events)

//ToDo: presentation metadata
const DESCRIPTOR_FIELD_ALLOW_LIST = {
	exact:{
		"nodeName":{sanitize:false, validate:true},
		"id":{sanitize:false},
		"childNodes":{sanitize:false},
		"parentId":{sanitize:false},
		"style":{sanitize:false},
		"computedStyle":{sanitize:false},
		"className":{sanitize:false},
		"src":{sanitize:false},
		"cssText":{sanitize:false},
		"data":{sanitize:false},
		"innerHTML":{sanitize:true},
	},
	partial:{}
}

class Presentation {

	constructor (id, storage, failOnNoStorage) {
		this.id = id;
		this.storage = storage;

		this.presentation = storage.get(id)
		this.roots = {}
		this.relations = {undefined:{}};
	
		if (!this.presentation) {
			if (failOnNoStorage) {
				throw `Failed to load ${id} - Owner @unknown`
			}
			this.presentation = {data:{}}
		}
		
		let owner = this.presentation.owner	
		this.rawData = this.presentation.rawData;
		if (!this.rawData) {
			throw `Invalid presentation format found in storage for ${id} - Owner @${owner}. Missing rawData`
		}

		storage.put(id, this.presentation);
		this.findRoots();
	}

	findRoots() {
		let unadresasble = 0;
		let brokenChildLinks = 0;
		let brokenParentLinks = 0;
		let nodeCount = Object.entries(this.rawData).length
		if (nodeCount == 0) {
			return;
		}

		console.log(`Finding roots of ${this.id} nodes ${nodeCount}`)
		for (const [key, value] of Object.entries(this.rawData)) {
			if(this.isRoot(value) || !this.rawData[value.parentId]) {
				this.roots[value.id] = true;
			}
			//broken parent node (parentId doesn't exist)
			//this is recoverable - just place it in root (body)
			if(value.parentId && !this.rawData[value.parentId]){
				brokenParentLinks++;
			}

			//broken child node
			//not recoverable
			if(value.childNodes) {
				for (const child of value.childNodes) {
					if (child.id) {
						if(!this.rawData[child.id]) {
							console.log(`----- broken child link ${value.id} -> ${child.id}`)
							brokenChildLinks++;
						}
					} else {
						unadresasble++;
					}
				}
			}
		}
		
		if (Object.keys(this.roots).length == 0) {
			throw `${this.id} (@${this.presentation.owner}) - has an invalid state. No root containers found, which means the presentation can't be constructed as it references unknown nodes`
		}
		
		console.log(`${this.id} (@${this.presentation.owner}) - roots(${Object.keys(this.roots).length}) nodes(${nodeCount}) unadressable(${unadresasble}) brokenParentLinks(${brokenParentLinks}) brokenChildLinks(${brokenChildLinks})`)
	}	

	sanitize(obj, schema) {
		let result = {}
		for (const key of Object.keys(obj)) {
			let rule = null
			//find sanitization rule
			if (key in schema.exact) {
				rule = schema.exact[key]
			} else {
				//console.log(`Unmatched key ${key}`)
				for (const wildc of Object.keys(schema.partial)) {
					if (key.includes(wildc)) {
						rule = schema.partial[wildc]
					}
				}
			}
				
			if (rule) {
				if (rule.sanitize) {
					result[key] = SecurityFilter.filterString(obj[key])
				} else {
					result[key] = obj[key]
				}
			}
		}
		return result
	}

	//ToDo maybe validate the outer object as well, not just the one about HTML Nodes
	validate(data) {
		if(data.detail && data.detail.descriptor) {
			data.detail.descriptor = this.sanitize(data.detail.descriptor, DESCRIPTOR_FIELD_ALLOW_LIST)
		}
		return data
	}

	updateRow (newData) {
		let rowId = newData.id;
		let row = (this.rawData[rowId] || {})
		
		if (!this.rawData[rowId]) {
			this.rawData[rowId] = row
		}
		
		for (const [key, value] of Object.entries(newData)) {
			row[key] = value
		}
	}

	update(data) {
		data = this.validate(data)
		if (data.detail && data.detail.descriptor && data.detail.descriptor.data && data.detail.descriptor.data.containerPermissions) {
			let perms = JSON.parse(data.detail.descriptor.data.containerPermissions)
			let persistPermission = perms[Events.persist];
			let broadcastPermission = perms[Events.broadcast];
			
			if (broadcastPermission && broadcastPermission['*'] == false) {
				return {}
			}

			if (persistPermission && persistPermission['*'] == false) {
				return data;
			}
		}
        
        //ToDo: plug in logic to check if op is allowed
        try{
			if (data.event == Events.create || data.event == Events.update) {
				console.log(`${data.event}(${data.detail.descriptor.id}) -> ${data.detail.insertAtIndex}`)
				let child = data.detail.descriptor;

				if (data.event == Events.create && this.rawData[child.id]) {
					console.error(`Child ${child.id} already exists. Ignoring re-creation of child.`)
					return data;
				}
				
				let parentId = data.detail.parentId;
				let parentNode = this.rawData[parentId];
				let insertAtIndex = (Number.isInteger(data.detail.insertAtIndex)) ? data.detail.insertAtIndex : -1;
		        let now = Date.now()

				if (data.event == Events.create) {
					child.ceratedAt = now
				}
				child.lastUpdated = now

		        this.updateRow(child)
				
				if (parentId) {
					//If a parent is specified, update parentLink in child record
					this.rawData[child.id]['parentId'] = parentId
					if (!this.rawData[parentId]) {
						this.roots[parentId] = true
					}
				}
				//on create, build list of childNodes (update doesn't need to do this)
				if (data.event == Events.create && parentNode) {
					if (!parentNode.childNodes) {
						parentNode.childNodes = []
					}
					
					//Compute correct index position
					insertAtIndex = (parentNode.childNodes.length == 0) ? 0 : (insertAtIndex % parentNode.childNodes.length);
					if (insertAtIndex < 0) {
						insertAtIndex = parentNode.childNodes.length + insertAtIndex
					}

					//TODO: fix this as it doesn't work
					console.log(`Inserting child at index: ${insertAtIndex} - with - ${JSON.stringify(data)}`);	
					parentNode.childNodes.splice( insertAtIndex, 0, {id:child.id})
				}
		        
				//track roots
		        if (this.isRoot(child)) { 
		        	this.roots[child.id] = true;
		        }
	    	} else if(data.event == Events.delete) {
	    		let id = data.detail.id
				if (id in this.rawData) {
					let toBeDeleted = this.rawData[id];
					delete this.rawData[id];

					if (toBeDeleted.parentId) {
						//remove child ref
						let parent = this.rawData[toBeDeleted.parentId]
						if (parent && parent.childNodes) {
							//remove from child links
							for (let i = 0 ; i < parent.childNodes.length; ++i) {
								if (parent.childNodes[i].id == id) {
									parent.childNodes.splice(i, 1)
									break;
								}
							}
						}
					}
				}
				if (id in this.roots) {
					delete this.roots[id]
				}
			} else if(data.event == Events.setParent) {
				let childId = data.detail.id;
				let prevParentId = data.detail.prevParent;
				let newParentId = data.detail.parentId;
				
				//add new link
				if (!this.rawData[newParentId].childNodes) {
					this.rawData[newParentId].childNodes = []
				}
				this.rawData[newParentId].childNodes.push({id:childId})

				//update graph links
				this.rawData[childId].parentId = newParentId
				
				//remove old link
				if (this.rawData[prevParentId]) {
					let prevChildLinks = this.rawData[prevParentId].childNodes;
					if (prevChildLinks) {
						for (let i = 0 ; i < prevChildLinks.length; ++i ) {
							if(prevChildLinks[i].id == childId) {
								prevChildLinks.splice(i,1)
								break;
							}
						}
					}
				}
			} else {
				//console.log(`WARNING: uncategorised event type ${data.event}`)
			}
			
			//Can be heavy, FolderKeyFileStorage can take a max of 200rps
			this.storage.put(this.id, this.presentation);
        } catch (e) {
        	console.log("Failed to update");
        	console.log(e);
        }

		return data
	}

	getNodesInOrder() {
		let result = []
		let visited = {}
		
		//add roots
		for (const key of Object.keys(this.roots)) {
			result.push(this.rawData[key])
			console.log(`push root ${key}`)
		}

		let i = 0;
		let noChildNodes = 0;
		while(i < result.length) {
			let current = result[i]
			visited[current.id] = true

			if (current.childNodes){
				for (const child of current.childNodes) {
					if(child.id && !visited[child.id]) {
						result.push(this.rawData[child.id])
						console.log(`${current.id} Push child ${child.id}`)
						visited[child.id] = true
					}
				}
			} else {
				noChildNodes++;
			}
			i++;
		}
		console.log(`number of leafs: ${noChildNodes}`)
		return result;
	}

	getNodesAnyOrder() {
		return Object.values(this.rawData)
	}

	isRoot(node) {
		return !node.parentId
	}

	serialize() {
		return {
			id: this.id,
		    title:`${this.presentation.title || this.id}`,
      		created:this.presentation.created,
      		last_updated:this.presentation.created,
      		last_opened:this.presentation.last_opened,
      		owner: this.presentation.owner,
      		settings:this.presentation.settings
		}
	}

	updateMetadata(data) {
		let fields = ['title']
		for (const key of fields) {
			if (data[key]) {
				console.log(`Setting ${key}=${data[key]} on ${data.id} `)
				this.presentation[key] = data[key]
			}
		}
		this.storage.put(this.id, this.presentation);
	}

	#HTMLizeDescriptor(desc) {
		if (!desc) {
			return ""
		}

		let nodeName = desc.nodeName || "span"
		let result = `<${nodeName}`
		let specials = new Set(['nodeName', 'data', 'computedStyle', 'cssText', 'innerHTML', 'childNondes', 'createdAt', 'lastUpdated', 'parentId'])
		for (let [key, value] of Object.entries(desc)) {
			if (!specials.has(key)) {
				result +=  ` ${key}="${value}"`
			}
		}

		let style = desc.cssText || ""
		// for (const [key, value] of Object.entries(desc.computedStyle || {})) {
		// 	style += `${key}:${value};`
		// }
		if (style.length > 0) {
			result += ` style="${style.replaceAll('"','\\"')}"`
		}
		result += ">"

		if (desc.innerHTML && desc.innerHTML.length > 0) {
			result += desc.innerHTML
		}

		return result
	}

	#HTMLize(node) {
		if (!node) {
			//probably incorrect reference...
			return ""
		}

		let nodeName = node.nodeName
		if (nodeName == '#text') {
			return node.text
		}

		let result = this.#HTMLizeDescriptor(node)
		for (let child of (node.childNodes || [])) {
			if (child.id) {
				result += this.#HTMLize(this.rawData[child.id])
			} else {
				result += this.#HTMLize(child)
			}
		}
		result += `</${nodeName}>`
		return result
	}

	getAsHTML(root) {
		let queue = []
		if (root) {
			queue.push(root)
		} else {
			for (let r of Object.keys(this.roots)) {
				queue.push(r)
			}
		}

		let html = ""
		for (let root of queue) {
			html += this.#HTMLize(this.rawData[root])
		}
		return html
	}
}

module.exports = Presentation