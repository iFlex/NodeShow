const fs = require('fs');

/*
* Implementation of file backed key: value storage.
* Cannot handle large loads in its current form. Can take up to 200RPS
*/
class DelayedMutationFolderKeyValueStore {
	#changed = {}

	constructor (rootDir, fastStorage) {
		this.rootDir = rootDir;
		this.fastStorage = fastStorage;
		DelayedMutationFolderKeyValueStore.initStorage(rootDir);

		//persist every second
		setInterval((e) => {
			this.step()
		}, 1000);	
	}
	
	setFastStorage(storage) {
		this.fastStorage = storage;
	}

	list () {
		return fs.readdirSync(this.rootDir);
	}

	get (id) {
		let path = DelayedMutationFolderKeyValueStore.getValuePath(this.rootDir, id)
		let filename = path +"/" +DelayedMutationFolderKeyValueStore.getLatestWrittenFile(path);

		try {	
			return JSON.parse(fs.readFileSync(filename, 'utf8'))
		} catch (e) {
			console.error(`Failed to locate storage file ${filename}`)
			console.error(e)
		}
		return null
	}

	put (id) {
		this.#changed[id] = true
	}

	persist(id, data) {
		let path = DelayedMutationFolderKeyValueStore.getValuePath(this.rootDir, id);
		DelayedMutationFolderKeyValueStore.initStorage(path)
		this.writeFile(id, data);
	}

	remove(id) {
		let path = DelayedMutationFolderKeyValueStore.getValuePath(this.rootDir, id);
		try {
			let versions = DelayedMutationFolderKeyValueStore.getAllVersions(path)
			for(let old of versions) {
				let delpath = path+"/"+old
				fs.unlinkSync(delpath)
			}
			fs.rmdirSync(path)
		} catch (e) {
			console.log(`Failure during remove for ${id}`)
			console.error(e)
			throw e
		}
	}

	step() {
		if (this.fastStorage) {
			for( let id of Object.keys(this.#changed)) {
				if (this.#changed[id]) {
					let data = this.fastStorage.get(id)
					this.persist(id, data)
					this.#changed[id] = false
				}
			}
		}
	}

	writeFile (id, data) {
		let path = DelayedMutationFolderKeyValueStore.getValuePath(this.rootDir, id);
		let filename = `${path}/${Date.now()}.json`

		try {
			fs.writeFileSync(filename, JSON.stringify(data));
			let oldVersions = DelayedMutationFolderKeyValueStore.getAllVersions(path)
			for(let old of oldVersions) {
				let oldPth = path+"/"+old
				if (oldPth != filename) {
					fs.unlinkSync(oldPth)
				}
			}
		} catch (e) {
			console.log(`Failure during persist for ${id} - ${e}`)
			console.error(e)
			DelayedMutationFolderKeyValueStore.initStorage(path)
		}
	}

	static getAllVersions(dir) {
		return fs.readdirSync(dir);
	}

	static getLatestWrittenFile(dir) {
		try {
			let list = fs.readdirSync(dir).sort();
			if (list.length == 0) {
				return undefined
			}

			return list[list.length - 1]
		} catch(e) {
			return undefined
		}
	}

	static getValuePath(dir, id) {
		return dir + "/" + id;
	}

	static initStorage(dir) {
		try {
			if (!fs.existsSync(dir)){
    			fs.mkdirSync(dir, { recursive: true });
			}
		} catch (e) {
			console.log("Cannot initiate storage for presentations")
			console.error(e)
		}
	}
}

module.exports = DelayedMutationFolderKeyValueStore