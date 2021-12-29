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

	newUser(details) {
		if (!details.identifier) {
			return;
		}

		let existing = this.storage.get(details.identifier); 
		if (existing) {
		 	return null;
		}

		let user = {
			id:details.identifier,
			name:details.name,
			email:details.identifier,
			password:details.password
		}
		console.log(user)
		this.storage.persist(user.id, user)
		return user;
	}

	lookup(id, failOnNotFound) {
		let user = this.storage.get(id)
		if (!user && !failOnNotFound) {
			return this.newAnonymousUser();
		}
		return user;
	}

	update(id) {

	}

	delete(id) {

	}
}

module.exports = UserBase