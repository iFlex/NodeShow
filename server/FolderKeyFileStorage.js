const fs = require('fs');

class FolderKeyFileStorage {
	
	constructor (rootDir) {
		this.rootDir = rootDir;
		this.updatesQueue = {}

		FolderKeyFileStorage.initStorage(rootDir);
		let context = this;
		this.interval = setInterval(function (e) {
			context.persist();
		}, 1000);	
	}
	
	list () {
		return fs.readdirSync(this.rootDir);
	}

	get (id) {
		let path = FolderKeyFileStorage.getLatestWrittenFile(
			FolderKeyFileStorage.getValuePath(this.rootDir, id)
		);

		try {	
			return JSON.parse(fs.readFileSync(path, 'utf8'))
		} catch (e) {
			console.error(`Failed to locate storage file ${path}`)
			console.error(e)
		}
		return null
	}

	put (id, data) {
		this.updatesQueue[id] = data
	}

	writeFile (id, data) {
		let path = FolderKeyFileStorage.getValuePath(this.rootDir, id);
		let filename = `${path}/${Date.now()}.json`

		fs.writeFile(filename, JSON.stringify(data), e => {
			if (e) {	
			  console.log("Failure during file operation on persist");
			  console.error(e)
			  FolderKeyFileStorage.initStorage(path);
			} else {
				let oldVersions = FolderKeyFileStorage.getAllVersions(path)
				for(let old of oldVersions) {
					let oldPth = path+"/"+old
					if (oldPth != filename) {
						fs.unlinkSync(oldPth)
					}
				}
			}
		});
	}

	persist () {
		for (const [key, prezzoData] of Object.entries(this.updatesQueue)) {
			this.writeFile(key, prezzoData);
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

module.exports = FolderKeyFileStorage