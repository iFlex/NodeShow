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