class UserBase {
	
	constructor (userStorage) {
		this.storage = userStorage;
	}

	newAnonymousUser () {
		return {
			id:'randooom',
			name:'Random Randomer',
			avatar_url:'nothing'
		}
	}

	lookup(id) {
		let user = this.storage.get(id)
		if (!user) {
			return this.newAnonymousUser();
		}
		return user;
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