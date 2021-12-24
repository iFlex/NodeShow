class RequestHandler {
  #maxUploadSize = 1024

  constructor(settings) {

  }
  
  //ToDo: enforce content size
  //ToDo: make more resilient
  handleUpload(request, response) {
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
    });
  }

  handleForm () {
    var form = new formidable.IncomingForm({uploadDir:UPLOADS});
    form.parse(request, function(err, fields, files) {
        if (err) {
          console.log(`Failed to parse post request`)
          console.error(err.message);
          return;
        }

        if (url == "/login.html") {
          let result = login(fields, request)
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
          let result = signup(fields, request, response)
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
          //ToDo: submit this to a headless browser which can then beam the contents over to everyone (via this server ofc)
        }
        response.end();
    });
  }

  manuallyHandle(url, req, res) {
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
      console.log(content)
      let data = JSON.parse(content)

      try {
        if (url == '/configure') {
          setNodeShowMetadata(null, data)
        } else if (url == '/delete') {
          deletePresentation(null, data)
        } 
        res.writeHead(200, {'Content-Type': 'application/json'});
      } catch(e) {
        res.writeHead(500, {'Content-Type': 'application/json'})
      }

      res.end();
    })
  }

  onRequest(request, response) {
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
        this.handleForm(request.url, request, response)
      } else if(request.method.toLowerCase() == "put") {
        this.handleUpload(request, response)
      } else if(request.method.toLowerCase() == 'delete') {
        manuallyHandle(request.url, request, response);
      } else if(request.method.toLowerCase() == 'patch') {
        manuallyHandle(request.url, request, response);
      }

    } catch(err) {
      console.log(err.stack);
    }
  }
}