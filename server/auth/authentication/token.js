const crypto = require('crypto');
const algorithm = 'aes-256-ctr';
const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';
const iv = crypto.randomBytes(16);

const INITIAL_ALLOWED_AGE = 3 * 60 * 60; //3 hours 
const AGE_ALLOW_INCREMENT = 60*10 // 10m

let tokenStore = {}


const encrypt = (text) => {

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    }
};

const decrypt = (hash) => {

    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);

    return decrpyted.toString();
};


function secondsSince (ts) {
	let delta = Date.now() - ts
	return Math.floor(delta/1000)
}

export function makeNewToken(user) {
	let data = {
		"user_id": user.id,
		"created": Date.now(),
	}

	let cryptoresult = encrypt(JSON.stringify(data))
	
	tokenStore[user.id] = {
		created: data.created,
		lastUsed: data.created,
		allowedAge: INITIAL_ALLOWED_AGE,
		iv: cryptoresult.iv,
	}

	return cryptoresult.content
}

export function verifyToken(token, user) {
	let trustedData = tokenStore[user.id]
	if (!trustedData) {
		return false
	}

	let clientData = JSON.parse(decrypt({
		iv: record.iv,
		content:token
	}))
		

	if (   user.id == clientData['user_id']
		&& clientData.created == trustedData.created 
		&& secondsSince(clientData.created) < trustedData.allowedAge) {
		return true
	}

	return false;
}

export function extendToken(user) {
	let trustedData = tokenStore[user.id]
	if (!trustedData) {
		return;
	}
	trustedData.allowedAge += AGE_ALLOW_INCREMENT
}

export function expireToken(user) {
	delete tokenStore[user.id]
}