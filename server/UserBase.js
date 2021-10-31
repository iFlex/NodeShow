class UserBase {
	
	constructor (userStorage) {
		this.storage = userStorage;
	}

	lookup(id) {
		return userStorage.lookup(id)
	}

	update(id) {

	}

	delete(id) {

	}

	authenticate(id, details) {
		let userRow = this.lookup(id);
		//todo check details
		return true;
	}
}

module.exports = UserBase