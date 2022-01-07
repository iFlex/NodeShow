const PREZZO_STORAGE = process.env.PREZZO_STORAGE_HOME || '../../storage/prezzos'
const SAVE_LOCATION = process.env.SAVE_LOCATION || '../../storage/blobs'
const NODESHOW_HOST = process.env.NODESHOW_HOST || 'https://localhost:8080'
const SECRET = 'thisisfordemoonly' 
const fs = require('fs')
let snapshot = require('./snapshot.js')

async function crawlSnapshot() {
	let dirs = fs.readdirSync(PREZZO_STORAGE)
	for (const pid of dirs) {
		console.log(pid)
		await snapshot.imageSnapshot(pid, NODESHOW_HOST, `${SAVE_LOCATION}/${pid}.png`, {
			'Authorization':`${SECRET}`
		})
	}	
}

crawlSnapshot()


