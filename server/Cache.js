class Cache {
	cache = {}

	get (key) {
		return this.cache[key];
	}

	put(key, value) {
		this.cache[key] = value
	}

	remove () {
		let result = this.cache[key]
		delete this.cache[key]

		return result
	}

	list () {
		return Object.keys(this.cache)
	}
}

module.exports = Cache