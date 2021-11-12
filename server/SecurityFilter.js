/*
descriptor: {

}
*/

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

//Filter with side effects
function filterUpdate(update) {
    let descriptor = update.detail.descriptor
    //Filter innerHTML
    if (descriptor) {
        descriptor.innerHTML = filterScriptsFromString(descriptor.innerHTML)
        descriptor.innerText = filterScriptsFromString(descriptor.innerText)
    }
}

module.exports = {
    filterUpdate:filterUpdate
}