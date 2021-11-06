/*
descriptor: {

}
*/

function filterScriptsFromHTML(html) {
    return html
}

//Filter with side effects
function filterUpdate(update) {
    let descriptor = update.detail.descriptor
    //Filter innerHTML
    descriptor.innerHTML = filterScriptsFromHTML(descriptor.innerHTML)
}

module.exports = filterUpdate