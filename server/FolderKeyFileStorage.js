const fs = require('fs');

class FolderKeyFileStorage {
	
	constructor (rootDir) {
		this.rootDir = rootDir;
		this.updatesQueue = []

		FolderKeyFileStorage.initStorage(rootDir);
		let context = this;

		let lock = false;
		this.interval = setInterval(function (e) {
			if (!context.lock) {
				context.lock = true;
				context.persist();
				context.lock = false;
			}
		}, 1000);	
	}
	
	list () {
		return fs.readdirSync(this.rootDir);
	}

	get (id) {
		let path = FolderKeyFileStorage.getValuePath(this.rootDir, id)
		let filename = path +"/" +FolderKeyFileStorage.getLatestWrittenFile(path);

		try {	
			return JSON.parse(fs.readFileSync(filename, 'utf8'))
		} catch (e) {
			console.error(`Failed to locate storage file ${filename}`)
			console.error(e)
		}
		return null
	}

	put (id, data) {
		this.updatesQueue.push({id:id, data:data})
	}

	writeFile (id, data) {
		let path = FolderKeyFileStorage.getValuePath(this.rootDir, id);
		let filename = `${path}/${Date.now()}.json`
		
		try{
			fs.writeFileSync(filename, JSON.stringify(data));
			let oldVersions = FolderKeyFileStorage.getAllVersions(path)
			for(let old of oldVersions) {
				let oldPth = path+"/"+old
				if (filename && oldPth != filename) {
					fs.unlinkSync(oldPth)
				}
			}
		} catch (e) {
			console.log(`Failure during persist for ${id} - ${e}`)
			FolderKeyFileStorage.initStorage(path)
		}
	}

	persist () {
		let start = Date.now()
		while (this.updatesQueue.length > 0) {
			let update = this.updatesQueue.pop();
			this.writeFile(update.id, update.data);
		}
		let end = Date.now()
		console.log(`Persiste step took: ${end - start}ms`)
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

module.exports = FolderKeyFileStorage