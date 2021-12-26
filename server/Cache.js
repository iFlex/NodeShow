class Cache {
	cache = {}
	#slowStorage

	constructor(slowStorage) {
		this.#slowStorage = slowStorage
		
		if (this.#slowStorage) {
			//init cache
			let keys = this.#slowStorage.list()
			for (let key of keys) {
				this.cache[key] = this.#slowStorage.get(key)
			}
		}
	}

	//immediately read frm storage
	get (key) {
		return this.cache[key];
	}

	//May make the change in storage immediately or at a later point in time
	put(key, value) {
		this.cache[key] = value
		if (this.#slowStorage) {
			this.#slowStorage.put(key)
		}
	}

	//Immediately makes the change in storage
	persist (key, value) {
		this.put(key, value)
		if (this.#slowStorage) {
			this.#slowStorage.persist(key, value)
		}
	}

	//May remove immediately or at a later point in time
	remove (key) {
		let result = this.cache[key]
		delete this.cache[key]
		
		if (this.#slowStorage) {
			this.#slowStorage.remove(key)
		}

		return result
	}

	//Immediately reads from storage
	list () {
		return Object.keys(this.cache)
	}
}

module.exports = Cache