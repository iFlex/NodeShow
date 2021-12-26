const process = require('process')

//HTTP
const https = require('https');
const fs = require('fs')
const PORT = 8080

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

const server = https.createServer(options, (e) => {});

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

let totalServiceTime = 0
let services = 0
//revisit this. It has grown to be overcomplicated.
io.on('connection', function (socket) {
  console.log("New socket.io connection")
  socket.on('register', function (parsed) {
  });

  socket.on('update', (data, ack) => {
    ack();
  });
 
  socket.on("disconnect", (e) => {
    console.log(`Connection closed:${e}`);
  });
});

//listen
server.listen(PORT, function(){
    console.log("Server listening on: https://localhost:%s", PORT);
});
