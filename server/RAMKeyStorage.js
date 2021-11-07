class RAMKeyStorage {
	
	constructor () {
		this.storage = {}	
	}
	
	list () {
		return Object.keys(this.storage);
	}

	get (id) {
		return this.storage[id]
	}

	put (id, data) {
		this.storage[id] = data
	}
}

module.exports = RAMKeyStorage