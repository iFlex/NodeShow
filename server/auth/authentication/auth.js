const utils = require('../../common.js')

class Authenticator {
	#reg = {}
	storage = null;

	constructor(tokenStorage) {
		this.storage = tokenStorage

		let list = tokenStorage.list();
		for( const id of list) {
			let token = tokenStorage.get(id)
			this.#reg[id] = token
		}
	}

	verifyToken(userId, token) {
		let trusted = this.#reg[userId]; 
		if (!trusted) {
			return false;
		}

		return trusted === token
	}

	newToken(user) {
		let token = utils.makeAuthToken(128);
		this.#reg[user.id] = token
		this.storage.persist(user.id, token)
		return token
	}

	login(untrusted, trusted) {
		if (!trusted) {
			return null;
		}

		if (untrusted.password == trusted.password) {
			return this.newToken(trusted)
		}
		return null;
	}
}

module.exports = Authenticator