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

	persist (id, data) {
		this.put(id, data)
	}
	
	remove (id, data) {
		delete this.storage[id]
	}
}

module.exports = RAMKeyStorage