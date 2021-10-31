const fs = require('fs')
const protocols = ["http://","https://"];

const mime = require('mime');

class HttpUtils {
	static handleStaticGet(request, res, locationInject) {
		var url = request.url;
		var startIndex = 0;
		for(let i in protocols ){
			startIndex = url.indexOf(protocols[i]);
			if(startIndex != -1)
			  startIndex += protocols[i].length;
		}

		var params = url.indexOf("?");
		var location = url.substring(0,params);
		var filename = "";
		var lastBackSlsh = url.lastIndexOf("/");
		
		if(params != -1) {
			var index = params;
			params = url.substring(params+1,url.length);
			url = url.substring(0,index);
		}

		filename = url.substring(lastBackSlsh+1,url.length);
		if(filename.length<2) {
			if(params == -1)
		  		filename = "index.html";
		}

		url = url.substring(startIndex,url.length).replaceAll("../","");
		url = locationInject + url;

		console.log(`Trying to serve statig file ${url}`)
		var file = 0;
		try{
			file = fs.readFileSync(url);
		} catch(e) {
			console.log("Error locating:"+url);
			file = 0;
		}

		if(file) {
			res.writeHead(200, {'Content-Type': mime.getType(url)});
			res.write(file);
			res.end();

			return true;
		}
		return false;
	}
}

module.exports = HttpUtils;
