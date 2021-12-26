const Presentation = require('./presentation')

class PresentationBase {
	constructor (storage) {
		this.storage = storage;
		this.presentations = {}
		let keys = this.storage.list();

		for (let key of keys) {
			try {
				let prezzo = this.createNew(key, true);
				this.presentations[key] = prezzo
			} catch (e) {
				console.error(`Failed to load prezzo ${key} - ${e}`)
			}
		}
	}
	
	createMetadata(tag, creator) {
		return {
			id: tag,
			created: Date.now(),
			owner: creator, 
			creator: creator,
			last_updated: Date.now(),
			settings: {
				public: true,
				tbd: true
			},
			rawData: {}
		}
	}

	createNew(tag, creator, failOnNoStorage) {
		if (!tag) {
			tag = PresentationBase.makeId(5);
			if (this.storage.get(tag)) {
				throw 'Presentation ID already exists';
			}

			this.storage.persist(tag, this.createMetadata(tag, creator.id))
		}

		let prezzo = new Presentation(tag, this.storage, failOnNoStorage);
		this.presentations[tag] = prezzo
		return prezzo;
	}

	list() {
		return Object.keys(this.presentations);
	}

	remove (id) {
		delete this.presentations[id];
		this.storage.remove(id);
	}

	get (id) {
		return this.presentations[id];
	}

	//TODO
	getWithFilter(callerId, filters) {

	}

	static makeId(length) {
		let token = "";
	    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	    for( var i=0;i<length;++i)
	        token += possible.charAt(Math.floor(Math.random() * possible.length));
	    return token;
	}
}

module.exports = PresentationBase