const Events = require('./NodeShowEvents')
console.log(Events)

class Presentation {

	constructor (id, storage) {
		this.id = id;
		this.storage = storage;

		this.rawData = storage.get(id);
		this.roots = {}
		this.relations = {undefined:{}};

		if (!this.rawData) {
			this.rawData = {}
		}

		storage.put(id, this.rawData);
		this.buildRelations();
	}

	buildRelations() {
		for (const [key, value] of Object.entries(this.rawData)) {
			//keep relations
			if (!(value.parentId in this.relations)) {
	        	this.relations[value.parentId] = {}	
	        }
	        this.relations[value.parentId][key] = true;
	        
	        //define roots
	        if (this.isParentNode(value.parentId)) { 
	        	this.roots[key] = true;
	        }
		}
	}

	update(data) {
        //ToDo: plug in logic to check if op is allowed
        try{
        	if (data.event == Events.CONTAINER_CREATE || data.event == Events.INJECTION) {
	        	let child = data.detail.descriptor;
		        let parentId = data.detail.parentId;
		        this.rawData[child.id] = child;
		        this.rawData[child.id]['parentId'] = parentId

		        //keep relations
		        if (!(parentId in this.relations)) {
		        	this.relations[parentId] = {}	
		        }
		        this.relations[parentId][child.id] = true;
		        
		        //track roots
		        if (this.isParentNode(parentId)) { 
		        	this.roots[child.id] = true;
		        }
	    	} else {
	    		this.rawData[data.detail.id]['computedStyle'] = data.detail.descriptor;
	    	}

	    	this.storage.put(this.id, this.rawData);
        } catch (e) {
        	console.log("Failed to update");
        	console.log(e);
        }
	}

	getInOrder(nodeId) {
		let result = []
		if (this.relations[nodeId]){
			for (let childId of Object.keys(this.relations[nodeId])) {
				result.push({parentId:nodeId, descriptor:this.rawData[childId]});
				for (const item of this.getInOrder(childId)) {
					result.push(item)	
				}
			}
		}

		return result;
	}

	getNodesInOrder() {
		let result = []
		for (let root of Object.keys(this.roots)) {
			result.push({parentId:this.rawData[root].parentId, descriptor:this.rawData[root]});
			for (const item of this.getInOrder(root)) {
				result.push(item)	
			}
		}

		return result;
	}

	isParentNode(id) {
		return !id || !(id in this.rawData)
	}
}

module.exports = Presentation
	