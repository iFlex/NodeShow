export function post(url, contentType, data, onComplete, onError) {
  var http = new XMLHttpRequest();
  
  http.open('PUT', url, true);
  http.setRequestHeader("Content-type", contentType);
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
 