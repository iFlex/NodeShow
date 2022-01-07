const puppeteer = require('puppeteer');

async function login (nodeShow) {
  const browser = await puppeteer.launch({ignoreHTTPSErrors: true});
  let page = await browser.newPage();
  await page.goto(`${nodeShow}/login.html`,{ waitUntil: 'networkidle2'});
  await page.type('[name="identifier"]', "Livache");
  await page.type('[name="password"]', "test");
  await page.click('[value="Login"]')//.then(() => page.waitForNavigation({waitUntil: 'load'}));
  await page.waitFor(1000); // await for 1s
  
  return browser
}

async function imageSnapshot(prezId, nodeShow, saveAs, headers) {
  const browser = await puppeteer.launch({ignoreHTTPSErrors: true});
  let page = await browser.newPage();
  page.setExtraHTTPHeaders(headers)
  
  await page.goto(`${nodeShow}/view.html?pid=${prezId}`,
    { waitUntil: 'networkidle2'});
  
  const desiredWidth = 1920;
  const desiredHeight = 1080;
  const sf = 0.5;

  await page.setViewport({
      width: parseInt(desiredWidth / sf),
      height: parseInt(desiredHeight / sf),
      deviceScaleFactor: sf,
  });

  await page.screenshot({path: saveAs});
  console.log(`Snapshot saved ${saveAs}`)
  await browser.close();
}

function htmlSnapshot() {

}

exports.imageSnapshot = imageSnapshot;