const puppeteer = require('puppeteer');

function imageSnapshot() {

}

function htmlSnapshot() {

}

async function login (page, browser) {
  await page.type('[name="identifier"]', "Liviu");
  await page.type('[name="password"]', "nsizbst");
  console.log('about to press the bastard')
  await page.click('[value="Login"]')//.then(() => page.waitForNavigation({waitUntil: 'load'}));
  console.log(`Waiting for login`)
  await page.waitFor(1000); // await for a 1s
  const pc = (await browser.pages()).length
  console.log(`current page count ${pc}`)
  return (await browser.pages())[pc - 1]
}

(async () => {

  // 1. Launch the browser
  const browser = await puppeteer.launch();

  // 2. Open a new page
  let page = await browser.newPage();

  // 3. Navigate to URL
  await page.goto('https://mfs.milorad.net:8080/home.html',
    { waitUntil: 'networkidle2' });
  
  if (page.url().includes('/login')) {
    //need to login, damn it
    page = await login(page, browser);
    if (!page) {
      console.log("Login failed")
      await browser.close();
      return;
    }
  }
  
  await page.goto('https://mfs.milorad.net:8080/view.html?pid=RAU5N',
    { waitUntil: 'networkidle2' });
  
  const desiredWidth = 1920;
  const desiredHeight = 1080;
  const sf = 0.5;

  await page.setViewport({
      width: parseInt(desiredWidth / sf),
      height: parseInt(desiredHeight / sf),
      deviceScaleFactor: sf,
  });

  await page.screenshot({path: 'screenshot.png'});

  await browser.close();
})();
