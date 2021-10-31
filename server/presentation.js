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
	        this.relations[value.parentId][key] = true;
	        if (!value.parentId) { 
	        	this.roots[key] = true;
	        }
		}
	}

	update(data) {
        //ToDo: plug in logic to check if op is allowed
        try{
        	if (data.event == 'ngps.createSerialized') {
	        	let child = data.detail.descriptor;
		        this.rawData[child.id] = child;
		        this.rawData[child.id]['parentId'] = data.parentId

		        //keep relations
		        this.relations[data.parentId][child.id] = true;
		        if (!data.parentId) { 
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
			result.push({parentId:undefined, descriptor:this.rawData[root]});
			for (const item of this.getInOrder(root)) {
				result.push(item)	
			}
		}

		return result;
	}
}

module.exports = Presentation
	