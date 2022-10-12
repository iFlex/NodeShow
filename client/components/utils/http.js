export function httpReq(method, url, contentType, data, onComplete, onError, headers = {}) {
  var http = new XMLHttpRequest();
  
  http.open(method, url, true);
  http.setRequestHeader("Content-type", contentType);
  for (const header in headers) {
    http.setRequestHeader(header, headers[header])
  }
  
  http.onreadystatechange = function() {
    if(http.readyState == 4 && http.status == 200) {
      console.log(http);
      onComplete(http.responseText);
    }
    else if( http.status != 200 && onError) {
      onError();
    }
  }
  http.send(data);
}

export function post(url, contentType, data, onComplete, onError, headers = {}) {
  httpReq('PUT',url, contentType, data, onComplete, onError, headers)
}
 