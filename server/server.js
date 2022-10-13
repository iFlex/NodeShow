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
const USE_BULK_LOAD = false
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
const robotUploader = require('./metadata/beamer.js')

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

//ToDo: use debug mode and other settings to properly build the cors here
const io = require('socket.io')(server, {  
  cors: {
    //origin: "https://example.com",
    methods: ["GET", "POST"],
    allowedHeaders: ["Access-Control-Allow-Origin"],
    extraHeaders : {
      'Access-Control-Allow-Origin': '*'
    }
    //credentials: true 
  }
});

const HttpDispatcher = require('httpdispatcher');
const dispatcher = new HttpDispatcher();
const HttpUtils = require('./HttpUtils')
const UserBase = require('./UserBase')
const PresentationBase = require('./PresentationBase');

//Storage
const FolderKeyFileStorage = require('./FolderKeyFileStorage')
const Cache = require('./Cache.js')
const DelayedMutationFolderKeyValueStore = require('./store/DelayedMutationFolderKeyValueStore.js')
//const RAMStorage = require('./RAMKeyStorage')

const Authenticator = require('./auth/authentication/auth.js')
const auth = new Authenticator(new FolderKeyFileStorage(TOKEN_STORAGE))

const UserStorage = new FolderKeyFileStorage(USER_STORAGE);
const Users = new UserBase(UserStorage);

const PresentationStorage = new FolderKeyFileStorage(PERSIST_LOCATION);
const PrezPersister = new DelayedMutationFolderKeyValueStore(PERSIST_LOCATION);
const PrezCache = new Cache(PrezPersister);
PrezPersister.setFastStorage(PrezCache)
const Presentations = new PresentationBase(PrezCache);
const Events = require('./NodeShowEvents');
const { fail } = require('assert');

const debug_level = 0;

//RAM FAST PRESENTATION ROUTING
var presentations = {}
var socket2prezzo = {}

console.log(Presentations.list())
for (const prezzoId of Presentations.list()) {
  presentations[prezzoId] = {"id":prezzoId, sockets:{}, presentation: Presentations.get(prezzoId)}
}


function newPrezzo(creator) {
  let prezzo = Presentations.createNew(null, creator)
  presentations[prezzo.id] = {"id":prezzo.id, sockets:{}, presentation: prezzo}

  return prezzo.id;
}

function manuallyHandle(url, req, res) {
  verifyRequest(req, res)
  let content = ""

  req.on("error", function(exception) {
    response.writeHead(500, {'content-type': 'text/plain'});
    response.end("FAILED");
  });
  
  req.on("data", function(data) {
    content += data;
  });

  req.on("end", function() {
    let data = JSON.parse(content)

    try {
      if (url == '/configure') {
        console.log(content)
        setNodeShowMetadata(null, data)
      } else if (url == '/delete') {
        console.log(content)  
        deletePresentation(null, data)
      } else if (url == '/bulk') {
        handleBulkUpdate(content);
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
    } catch(e) {
      res.writeHead(500, {'Content-Type': 'application/json'})
    }

    res.end();
  });
};

dispatcher.onGet("/new", function(req, res) {
  console.log(`Call to /new`)
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
  for (const [key, val] of Object.entries(presentations)) {
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

//ToDo: enforce content size
//ToDo: make more resilient
function handleUpload(request, response) {
  verifyRequest(request, response)

  let fn = utils.makeAuthToken(128)
  let filename = `${BLOB_STORE}/${fn}`
  let uploaded = 0
  let MAX_CONTENT_SIZE = 0

  request.on("error", function(exception) {
    console.error("Error while uploading file: ", exception);
    response.writeHead(500, {'content-type': 'text/plain'});
    response.end("FAILED");
  });
  
  request.on("data", function(data) {
    //ToDo: handle failure
    fs.appendFileSync(filename, data)
  });

  request.on("end", function() {
    response.end(fn);
    //ToDo: fix -- this is just a glue and paper approach
    const headers = request.headers;
    if (headers["content-type"] == "text/html") {
      robotUploader.beam(headers["pid"], fn, headers["target"])
    }
  });
}

function handlePost(url, request, response) {
  var form = new formidable.IncomingForm({uploadDir:BLOB_STORE});
  form.parse(request, function(err, fields, files) {
      console.log(fields)
      console.log(files)
      if (err) {
        console.log(`Failed to parse post request`)
        console.error(err.message);
        return;
      }

      if (url == "/login.html") {
        let result = login(fields)
        if (result) {
          response.writeHead(303, {
            'content-type': 'text/plain',
            'Set-Cookie': `token=${(Buffer.from(JSON.stringify(result))).toString('base64')}`,
            'Location': '/home.html'
          });
        } else {
          response.writeHead(403, {'content-type': 'text/plain'});
        }
      } else if (url == "/signup.html") {
        let result = signup(fields)
        if (!result) {
          response.writeHead(403, {'content-type': 'text/plain'});
        } else {
          response.writeHead(303, {
            'content-type': 'text/plain',
            'Set-Cookie': `token=${(Buffer.from(JSON.stringify(result))).toString('base64')}`,
            'Location': '/home.html'
          });
        }
      } else {
        let data = JSON.stringify({fields: fields, files: files})
        response.writeHead(200, {'content-type': 'text/plain'});
        console.log(`User Uploaded:`)
        console.log(data)
        robotUploader.beam(fields.pid, files.file.newFilename, fields.rid)
      }
      response.end();
  });
}

let noTokenNeeded = new Set(["/signup.html","/login.html"])

function handleRequest(request, response) {
    console.log(`${request.method} - ${request.url}`)
    try {
      if (!noTokenNeeded.has(request.url)) {
        console.log("Verifying")
        verifyRequest(request, response)
      }

      var wasStatic = false;
      if(request.method.toLowerCase() == "get") {
        //static content server
        wasStatic = HttpUtils.handleStaticGet(request, response, NGPS_LOCATION)
        if (!wasStatic) {
          wasStatic = HttpUtils.handleStaticGet(request, response, STATIC_CONTENT)
        }
        if (!wasStatic) {
          wasStatic = HttpUtils.handleStaticGet(request, response, BLOB_STORE)
        }
        if (!wasStatic) {
          dispatcher.dispatch(request, response);
        }
      } else if(request.method.toLowerCase() == "post") {
        handlePost(request.url, request, response)
      } else if(request.method.toLowerCase() == "put") {
        handleUpload(request, response)
      } else if(request.method.toLowerCase() == 'delete') {
        manuallyHandle(request.url, request, response);
      } else if(request.method.toLowerCase() == 'patch') {
        manuallyHandle(request.url, request, response);
      }

    } catch(err) {
      console.log(err.stack);
    }
}

function parseCookies (headers) {
  var list = {},rc = headers.cookie;

  rc && rc.split(';').forEach(function( cookie ) {
      var parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
  });

  try {
    return JSON.parse(Buffer.from(list["token"],'base64').toString('ascii'))
  } catch(e) {
    return {}
  }
}

let totalServiceTime = 0
let services = 0
//revisit this. It has grown to be overcomplicated.
io.on('connection', function (socket) {
  console.log("New socket.io connection")
  socket.on('register', function (parsed) {
    console.log("Register request:")
    console.log(parsed)

    let prezId = parsed.presentationId;
    let prezzo = presentations[prezId];

    if (prezzo) {
      let cookie = authorize(socket.handshake.headers)
      let user = Users.lookup(cookie.id);
      user.sessionId = utils.makeAuthToken(64); 
      if (!user.id) {
        user.id = user.sessionId
      }

      prezzo.sockets[user.sessionId] = { user: user, socket: socket };
      socket2prezzo[socket] = prezzo;
      
      let registerMsg = {userId: user.id, sessionId: user.sessionId, name: user.name, presentationId: prezId}
      console.log(`Registered new user Name(${user.name}) UID(${user.id}) SID(${user.sessionId}) for prezzo ${prezId}`)
      socket.emit('register', registerMsg)
      //beam over presentation
      broadcast(null, ['user.joined', registerMsg], prezzo.sockets);
      sendPresentationToNewUser(socket, prezzo.presentation)//Presentations.get(prezId))
    }
  });

  socket.on('update', (data, ack) => {
    // let s = Date.now()
    try {
      handleBridgeUpdate(data, socket)    
      if (ack) {
        ack();
      }
    } catch (e) {
      console.error(`Failed to process bridge update`)
      console.error(e)
    }
    // let e = Date.now()
    // totalServiceTime += (e-s)
    // services++;
    // console.log(`Service time: ${e - s} avg:${totalServiceTime/servicesa}`)
  });
 
  socket.on("disconnect", (e) => {
    console.log(`Connection closed:${e}`);
    console.log(e)
    let prezzo = socket2prezzo[socket];
    delete socket2prezzo[socket];

    if (prezzo) {
      let leavingSessionId = findUserBySocket(socket, prezzo);
      delete prezzo.sockets[leavingSessionId];

      broadcast(null, ['user.left',{sessionId:leavingSessionId}], prezzo.sockets);
      console.log(`Session ${leavingSessionId} has ended`);
    }
  });
});
  
function findUserBySocket(socket, prezzo){
  for( const [sessionId, record] of Object.entries(prezzo.sockets)) {
    if (record.socket == socket) {
      return sessionId;
    }
  }
  return null;
}

/**
 * 
 */ 
function handleBulkUpdate(data) {
  try {
    data = JSON.parse(data)  
  } catch(e) {
    console.error('Failed to parse bulk update')
    console.error(e)
    return;
  }

  let prezId = data.presentationId
  let insertPoint = data.insertRootId
  let nodes = data.nodes
  let prezHandler = presentations[prezId];
  console.log(`Bulk updating Prezzo:${prezId} - ${nodes.length} items`)
  //ToDo better integration here (maybe pick prezzo from request, check prems to buld insert in prezzo, etc)
  //ToDo: broadcast bulk event at the end to all users/listeners rather than for each node
  let success = 0;
  let failure = 0;
  for (const node of nodes) {
    if (!node.parentId) {
      node.parentId = insertPoint
      console.log(`Bootstrapped node with parent: ${insertPoint}`)
    }

    try {
      prezHandler.presentation.update({
        presentationId: prezId,
        sessionId: "bulker",
        event: 'container.create',
        detail: node
      });
      success++
    } catch (e) {
      console.error(`Failed to bulk insert node ${node}`, e)
      failure++
    }
  }
  console.log(`Bulk inserted ${success} nodes. Failed to insert ${failure} nodes. Now broadcasting...`)
  //storing as html and then sendingggg
  console.log(`Sending bulk event to load from: ${data.url}`)
  broadcast("bulker", ['bulk.load', {
    detail: {
      parentId: insertPoint,
      url: data.url
    }
  }], prezHandler.sockets);
}

function handleBridgeUpdate(parsed, originSocket) {
  let cookie = authorize(originSocket.handshake.headers)
  let user = Users.lookup(cookie.id);
  
  if (debug_level > 2) {
    console.log(`UPDATE:`)
    console.log(parsed)  
    console.log(user)
  }
  if (debug_level > 0 && debug_level < 2) {
    console.log(`update from ${user} in ${parsed.presentationId}`)
  }

  let prezId = parsed.presentationId;
  let sessionId = parsed.sessionId;
  let prezzo = presentations[prezId];

  if (prezzo) {
    //identifying user
    let sessionData = prezzo.sockets[sessionId]
    let userId = undefined
    if (sessionData) {
      userId = sessionData.user.id;  
    }
    
    parsed = prezzo.presentation.update(parsed);
    parsed.userId = userId;
    broadcast(sessionId, ['update', parsed], prezzo.sockets);
  }
}

function broadcast(senderId, message, sockets) {
  if(debug_level > 1){
    console.log("Broadcasting to all users in prezzo")
    console.log(message)
  }
  if(message.length != 2) {
    console.log("Invalid broadcast call");
    return;
  }

  for (const [socSessionId, record] of Object.entries(sockets)) {
    if (socSessionId != senderId) {
      record.socket.emit(message[0], message[1]);
    }
  }
}

function sendPresentationToNewUser(socket, prezzo) {
  console.log("Beaming presentation to new user");
  if (USE_BULK_LOAD) {
    socket.emit('bulk.load', {
      detail: {
        html: prezzo.getAsHTML()
      }
    })
  } else {
    let nodes = prezzo.getNodesAnyOrder(); //prezzo.getNodesInOrder();
    console.log(`Node count ${nodes.length}`)
    for (const node of nodes) {
      if (debug_level > 1) {
        console.log(node)
      }
      socket.emit('update', {
        presentationId: prezzo.id,
        event: Events.create,
        detail: {
            parentId: node.parentId,
            descriptor: node
        }
      });
    }
  }
}

//TODO: user getWithFilters
function getPresentations(user, filters, pagination) {
  //just get all of them for now
  let result = []
  for (const prezzoId of Presentations.list()) {
    let prezzo = Presentations.get(prezzoId)
    let details = prezzo.presentation
    if (details.creator == user.id || details.owner == user.id) {
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

function authorize(headers) {
  let bearer = headers['authorization']
  let cookie = {}
  
  //[TODO]:Secure this. Temporary and super insecure - meant to me more than just nothing
  if (bearer) {
    cookie.id = 'robot'
    cookie.token = bearer
  } else {
    cookie = parseCookies(headers)
  }

  if(!auth.verifyToken(cookie.id, cookie.token)){
    throw `Unauthorised request`
  }
  return cookie
}

function verifyRequest(request, response) {
  try {
    return authorize(request.headers)
  } catch (e) {
    if (response) {
      redirect('/login.html', response)
    }
    console.log('Unauthorised')
    throw `Unauthorised request`
  }
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
  response.writeHead(302, {'content-type': 'text/plain','location':location});
  response.end();
}

function endWithError(res) {
  res.writeHead(500, {'content-type': 'text/plain'})
  res.end();
}

//listen
server.listen(PORT, function(){
    console.log("Server listening on: https://localhost:%s", PORT);
});
