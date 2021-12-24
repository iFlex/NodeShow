const process = require('process')

const PORT= process.env.PORT || 8080;
const SERVER=`http://localhost:${PORT}/`;
const NGPS_LOCATION = process.env.NODE_SHOW_CLIENT_HOME || "../client"
const NGPS_ENTRYPOINT = NGPS_LOCATION + "/index.html";
const USER_STORAGE = process.env.USER_STORAGE_HOME || '../storage/users'
const TOKEN_STORAGE = process.env.TOKEN_STORAGE || '../storage/tokens'
const PERSIST_LOCATION = process.env.PREZZO_STORAGE_HOME || '../storage/prezzos'
const BLOB_STORE = process.env.BLOB_STORAGE || '../storage/blobs'
const DEBUG_MODE = process.env.DEBUG_MODE || false;
const STATIC_CONTENT = './static'
const UPLOADS = './static/'
//ToDo: Handle content lookup by link rather than try each folder until something is found...

console.log(`Configured NodeShow server with`)
console.log(`Server config: ${SERVER}`)
console.log(`NodeShow client: ${NGPS_LOCATION}`)
console.log(`Presentation Storage: ${PERSIST_LOCATION}`)

//HTTP
const https = require('https');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable')
const utils = require('./common.js')

if (!process.env.TLS_CERT_KEY || !process.env.TLS_CERT) {
  console.log("Please provide environment variables for the HTTPS server TLS config")
  console.log("TLS_CERT: path to certificate")
  console.log("TLS_CERT_KEY: path to the key file")
  process.exit(0)
}

const options = {
  key: fs.readFileSync(process.env.TLS_CERT_KEY),
  cert: fs.readFileSync(process.env.TLS_CERT),
  ciphers: "DEFAULT:!SSLv2:!RC4:!EXPORT:!LOW:!MEDIUM:!SHA1"
};

const server = https.createServer(options, handleRequest);
//const HttpUtils = require('./HttpUtils')
const UserBase = require('./UserBase')
const PresentationBase = require('./PresentationBase');

//Storage
const FileStorage = require('./FileStorage')
const FolderKeyFileStorage = require('./FolderKeyFileStorage')
//const RAMStorage = require('./RAMKeyStorage')

const Authenticator = require('./auth/authentication/auth.js')
const auth = new Authenticator(new FolderKeyFileStorage(TOKEN_STORAGE))

const UserStorage = new FolderKeyFileStorage(USER_STORAGE);
const Users = new UserBase(UserStorage);

const PresentationStorage = new FolderKeyFileStorage(PERSIST_LOCATION);
const Presentations = new PresentationBase(PresentationStorage);
const Events = require('./NodeShowEvents');

const Streamer = require('./stream.js');
const streamer = new Streamer(server, Presentations)

const debug_level = 0;

function newPrezzo(creator) {
  let prezzo = Presentations.createNew(null, creator)
  return prezzo.id;
}

dispatcher.onGet("/new", function(req, res) {
  let cookie = verifyRequest(req, res);
  let id = null;
  try {
    id = newPrezzo(Users.lookup(cookie.id));  
  } catch (e) {
    console.error(`Failed to create new presentation for user ${cookie.id}: ${e}`)
    endWithError(res)
    return;
  }
  
  console.log(`Created new prezzo ${id}`)
  
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(id);
  res.end();
});


dispatcher.onGet("/list", function(req, res) {
  let result = []
  for (const [key, val] of Object.entries(Presentations.list())) {
    result.push(key)
  }
  
  state = JSON.stringify(result, null, 2)
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(state);
  res.end();
});

dispatcher.onGet("/getPresentations", function(req, res) {
  let cookie = verifyRequest(req, res)
  let response = getPresentations(Users.lookup(cookie.id), null, null)
  res.writeHead(200, {"Content-Type": "application/json"});
  res.write(JSON.stringify(response));
  res.end();
});

dispatcher.onGet("/edit", function(req, res) {
  const queryObject = url.parse(req.url, true).query;
  console.log(queryObject);

  try{
    let file = fs.readFileSync(NGPS_ENTRYPOINT);
    res.writeHead(200, {"Content-Type": "text/html"});
    res.write(file);
    res.end();
  }catch(e){
    console.log("Error locating:"+url);
    file = 0;
  } 
});

let noTokenNeeded = new Set(["/signup.html","/login.html"])

//TODO: user getWithFilters
function getPresentations(user, filters, pagination) {
  //just get all of them for now
  let result = []
  for (const prezzoId of Presentations.list()) {
    let prezzo = Presentations.get(prezzoId)
    let details = prezzo.presentation
    if (details.creator == user.id) {
      result.push(prezzo.serialize())
    }
  }

  result.sort((f, s) => { return s.created - f.created } )
  return result
}


function setNodeShowMetadata(user, details) {
  let prezzo = Presentations.get(details.id)
  if (prezzo) {
    prezzo.updateMetadata(details)
    return prezzo.serialize()
  } else {
    console.log("Couldn't find the prezzo you're looking for")
  }
  throw `Can't find the NodeShow`;
}

function deletePresentation(user, details) {
  Presentations.remove(details.id)
}

function verifyRequest(request, response) {
  let cookie = parseCookies(request.headers)
  if(!auth.verifyToken(cookie.id, cookie.token)){
    console.log('Unauthorised request');
    redirect('/login.html', response)
    throw `Unauthorised request`
  }
  return cookie
}

function login(data) {
  console.log('Login')
  console.log(data)
  let token = auth.login({id:data.identifier, password:data.password}, 
    Users.lookup(data.identifier, true))
  if (token) {
    return {
      id: data.identifier,
      token: token
    }
  }
  return null;
}

function signup(data) {
  let user = Users.newUser(data)
  if (user) {
    return {
      id: user.id,
      token: auth.newToken(user)
    }
  }
  return null;
}

function redirect(location, response) {
  response.writeHead(303, {'content-type': 'text/plain','location':location});
  response.end();
}

function endWithError(res) {
  res.writeHead(500, {'content-type': 'text/plain'})
  res.end();
}

//listen
streamer.start();
server.listen(PORT, function(){
    console.log("Server listening on: https://localhost:%s", PORT);
});
