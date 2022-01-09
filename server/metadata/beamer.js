const puppeteer = require('puppeteer');
const host = "https://localhost:8080"
const NODE_SHOW_CLIENT_ROOT = '../../client'
const NODE_SHOW_UPLOADER_ENTRYPOINT = `${NODE_SHOW_CLIENT_ROOT}/beam.js`

const SECRET = 'thisisfordemoonly' 
//NOTE: the pre shared secret or Authorization: Bearer token should not be sent to domain
//other than NodeShow host
async function beam(pid, htmlFile) {
	console.log(`Creating robot instance in NodeShow:${pid} to upload file ${htmlFile}`)
	const browser = await puppeteer.launch({ignoreHTTPSErrors: true, headless:true});
    const page = await browser.newPage();
    page.setExtraHTTPHeaders({'Authorization':`${SECRET}`})

    await page.goto(`${host}/${htmlFile}?pid=${pid}`, { waitUntil: 'networkidle2' });
	
	//Add required socket-io and jquery
	await page.addScriptTag({ 
		path: require.resolve(`${NODE_SHOW_CLIENT_ROOT}/libs/jquery.js`)})
	await page.addScriptTag({ 
		path: require.resolve(`${NODE_SHOW_CLIENT_ROOT}/libs/socket-io.js`)})
	
	//Add NodeShow beamer instnace
	await page.addScriptTag({ 
		path: require.resolve(NODE_SHOW_UPLOADER_ENTRYPOINT),
		type: 'module' 
	});
	
	//[TODO]: make this wait for some sort of event
	await page.waitFor(20000);
	await browser.close();
}

module.exports.beam = beam