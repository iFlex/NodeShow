const Presentation = require('./presentation')

class PresentationBase {
	constructor (storage) {
		this.storage = storage;
		this.presentations = {}
		let keys = this.storage.list();

		for (let key of keys) {
			let prezzo = this.createNew(key);
			this.presentations[key] = prezzo
		}
	}

	createNew(tag) {
		if (!tag) {
			tag = PresentationBase.makeId(5);
			if (this.storage.get(tag)) {
				throw 'Presentation ID already exists';
			}	
		}

		let prezzo = new Presentation(tag, this.storage);
		return prezzo;
	}

	list() {
		return Object.keys(this.presentations);
	}

	remove (id) {
		delete this.presentations[id];
	}

	get (id) {
		return this.presentations[id];
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