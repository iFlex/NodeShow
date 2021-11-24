const { filter } = require('httpdispatcher');
const Events = require('./NodeShowEvents')
const SecurityFilter = require('./SecurityFilter')

console.log(Events)

//ToDo impose schema on update object as well and validate fields
//allow list of fields in a presentation unit descriptor

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
		"permissions":{sanitize:false},
		"data":{sanitize:false},
		"innerHTML":{sanitize:true},
	},
	partial:{}
}

class Presentation {

	constructor (id, storage, failOnNoStorage) {
		this.id = id;
		this.storage = storage;

		this.rawData = storage.get(id);
		this.roots = {}
		this.relations = {undefined:{}};

		if (!this.rawData) {
			if (failOnNoStorage) {
				throw `Failed to load ${id}`
			}
			this.rawData = {}
		}

		storage.put(id, this.rawData);
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
							brokenChildLinks++;
						}
					} else {
						unadresasble++;
					}
				}
			}
		}
		
		if (Object.keys(this.roots).length == 0) {
			throw `${this.id} - has an invalid state. No root containers found, which means the presentation can't be constructed as it references unknown nodes`
		}
		
		console.log(`${this.id} - roots(${Object.keys(this.roots).length}) nodes(${nodeCount}) unadressable(${unadresasble}) brokenParentLinks(${brokenParentLinks}) brokenChildLinks(${brokenChildLinks})`)
	}	

	sanitize(obj, schema) {
		let result = {}
		for (const key of Object.keys(obj)) {
			let rule = null
			//find sanitization rule
			if (key in schema.exact) {
				rule = schema.exact[key]
			} else {
				console.log(`Unmatched key ${key}`)
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
	
	update(data) {
		data = this.validate(data)
        //ToDo: plug in logic to check if op is allowed
        try{
			if (data.event == Events.CONTAINER_CREATE || data.event == Events.CONTAINER_UPDATE) {
	        	console.log(`${data.event} -> ${data.detail.descriptor.nodeName}`)
				let child = data.detail.descriptor;
		        let parentId = data.detail.parentId;
		        this.rawData[child.id] = child;
				
				if (parentId) {
					this.rawData[child.id]['parentId'] = parentId
					if (!this.rawData[parentId]) {
						this.roots[parentId] = true
					}
				}
		        
				//track roots
		        if (this.isRoot(child)) { 
		        	this.roots[child.id] = true;
		        }
	    	} else if(data.event == Events.DELETE) {
				let id = data.detail.id
				if (id in this.rawData) {
					delete this.rawData[id]
				}
				if (id in this.roots) {
					delete this.roots[id]
				}
			} else if(this.rawData[data.detail.id]) {
				this.rawData[data.detail.id]['computedStyle'] = data.detail.descriptor.computedStyle;
			}

			this.storage.put(this.id, this.rawData);
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
}

module.exports = Presentation
	