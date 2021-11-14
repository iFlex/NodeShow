const Events = require('./NodeShowEvents')
console.log(Events)

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
		let nodeCount = Object.entries(this.rawData).length
		if (nodeCount == 0) {
			return;
		}

		console.log(`Finding foots of ${this.id} nodes ${nodeCount}`)
		for (const [key, value] of Object.entries(this.rawData)) {
			if(this.isRoot(value)) {
				this.roots[value.id] = true;
			}
			delete this.rawData[key].children
		}
		if (Object.keys(this.roots).length == 0) {
			throw `${this.id} - has an invalid state. No root containers found, which means the presentation can't be constructed as it references unknown nodes`
		}
		let rootCount = Object.keys(this.roots).length
		let prevOrphanCount = 0;
		let linked = 0;
		let curOrphanCount = Object.keys(this.rawData).length;
		
		do {
			prevOrphanCount = curOrphanCount;
			curOrphanCount = 0;
			for (const [key, value] of Object.entries(this.rawData)) {
				if (!this.isRoot(value)) {
					let parentId = value.parentId;
					let parent = this.rawData[parentId];
					
					if (!parent) {
						curOrphanCount += 1
					} else {
						if (!parent.children) {
							parent.children = {}
						}
						if (!(value.id in parent.children)) {	
							linked++;
							parent.children[value.id] = true
						}
					}
				}
			}
		} while(curOrphanCount != prevOrphanCount)

		console.log(`Linked Children: ${linked} Remaining orphans: ${curOrphanCount}`)
		if(curOrphanCount > 0) {
			throw `Presentation ${this.id} has ${curOrphanCount} orphaned nodes. It should have 0`
		}
		if (rootCount + linked != nodeCount) {
			throw `Presentation ${this.id} has ${rootCount} roots and ${linked} linked children. Which should add up to ${nodeCount} total nodes.`
		}
	}	

	update(data) {
        //ToDo: plug in logic to check if op is allowed
        try{
			if (data.event == Events.CONTAINER_CREATE || data.event == Events.CONTAINER_UPDATE) {
	        	let child = data.detail.descriptor;
		        let parentId = data.detail.parentId;
		        this.rawData[child.id] = child;
				if (!child.children) {
					child['children'] = {}
				}

				if (parentId) {
					this.rawData[child.id]['parentId'] = parentId
					if (!this.rawData[parentId]) {
						this.roots[parentId] = true
						this.rawData[parentId] = {id:parentId, children:{}}
					}
					this.rawData[parentId].children[child.id] = true
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
			} else {
				this.rawData[data.detail.id]['computedStyle'] = data.detail.descriptor.computedStyle;
			}

			this.storage.put(this.id, this.rawData);
        } catch (e) {
        	console.log("Failed to update");
        	console.log(e);
        }
	}

	getNodesInOrder() {
		let result = []
		let visited = {}
		
		//add roots
		for (let [key, value] of Object.entries(this.roots)) {
			result.push(this.rawData[key])
		}

		let i = 0;
		while(i < result.length) {
			let current = result[i]
			if (current.children){
				for (const child of Object.keys(current.children)) {
					if(!(child in visited)) {
						result.push(this.rawData[child])
						visited[child] = true
					}
				}
			}
			i++;
		}
		return result;
	}

	isRoot(node) {
		return !node.parentId
	}
}

module.exports = Presentation
	