var stripJs = require('strip-js');

function filterScriptsFromString(html) {
    let result = null;
    try {
        result = stripJs(html)
    } catch (e) {
        console.log(`Coultn'd safely strip scripts from html - ${e}`)
    } 
    return result; 
}

module.exports = {
    filterString: filterScriptsFromString,
}