const https = require('http')

const templateInject = {
  presentationId: "",
  userId: null,
  event:"container.createSerialized",
  detail: {
    parentId: null,
    descriptor:{}
  }
}

const category = {
  "nodeName":"DIV",
  "className":"news-feed-category",
  "id":""
}

const card = {
  "nodeName":"DIV",
  "className":"news-feed-card",
  "id":""
}

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/inject',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': 0
  }
}

function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}

function sendInject (pid, parentId, unserialized) {
  const unserdata = clone(templateInject)
  unserdata.presentationId = pid
  unserdata.parentId = parentId
  unserdata.detail.parentId = parentId
  unserdata.detail.descriptor = unserialized

  const data = JSON.stringify(unserdata)

  const opts = clone(options)
  opts.headers['Content-Length'] = data.length;

  const req = https.request(opts, res => {
    console.log(`statusCode: ${res.statusCode}`)

    res.on('data', d => {
      process.stdout.write(d)
    })
  })
  req.on('error', error => {
    console.error(error)
  })
  req.write(data)
  req.end()
}

function sendCategory (pid, name) {
  let cat = clone(category)
  cat.id = name

  sendInject(pid, "news-viewport", cat)
}

function sendArticle (pid, category, title, source, data) {
  let crd = clone(card)
  crd.id = title
  crd.innerHTML = data

  sendInject(pid, category, crd)
}

function newPrezzo() {

}


let pid = 'cPrqq'

sendCategory(pid, "Science")
sendCategory(pid, "Technology")
sendCategory(pid, "Politics")

let dummyhtml = "<h1>Asta e un titlu frumos</h1><p>Sa ma sugi de pula ba Salame...</p>"
sendArticle(pid, "Science", "Morcovi fierti", "caca.com", dummyhtml)
sendArticle(pid, "Science", "Telina Fiarta", "caca.com", dummyhtml)
sendArticle(pid, "Science", "Cur fiert", "caca.com", dummyhtml)
