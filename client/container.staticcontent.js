import {Container, ACTIONS} from "./Container.js"

Container.prototype.toComponentLocalURL = function(resource, callerId) {
    return `components/${callerId}/${resource}`
}

/**
 * @summary Loads HTML content into a given container
 * @description [TODO]
 * @param {DOMReference} node - The id (or DOM Reference) of the DOM Object 
 * @param {string} resource - name of the HTML file to load
 * @param {string} callerId - name of the calling component
 * @param {boolean} emit - wether to emit events or not when indexing the loaded content
 * @return a promise with one parameter with the loaded content
 */
Container.prototype.loadHtml = function(node, url, callerId, emit = true) {
    node = this.lookup(node)
    this.isOperationAllowed(ACTIONS.loadHTML, node, callerId)
    this.isOperationAllowed(ACTIONS.create, node, callerId)   

    console.log(`Fetching: ${url}`) 
    return fetch(url)
    .then(resp => {
        if (resp.ok) {
            return resp.body
        }
        throw `Response from server: ${resp.status} - ${resp.statusText}`
    })
    .then(rb => {
        const reader = rb.getReader();
        return new ReadableStream({
        start(controller) {
            return pump();
            function pump() {
            return reader.read().then(({ done, value }) => {
                // When no more data needs to be consumed, close the stream
                if (done) {
                    controller.close();
                    return;
                }
                // Enqueue the next data chunk into our target stream
                controller.enqueue(value);
                return pump();
            });
            }
        }
        })
    })
    .then(stream => new Response(stream))
    .then(response => response.blob())
    .then(blob => blob.text())
    .then(text => {
        //ToDo: consider append or overwrite mode too
        node.innerHTML += text;
        this.index(node, emit)
        if (emit !== false) {
            this.emit(ACTIONS.loadHTML, {id:node.id, callerId:callerId})
        }
    })
    .catch(err => {
        console.error(`Failed to fetch html fragment from ${url}`)
        console.error(err)
    })
}

/**
 * @summary Loads a Stylesheet into the page's head
 * @description [TODO]
 * @param {string} resource - name of the stylesheet file
 * @param {string} callerId - name of the calling component
 */
Container.prototype.loadStyle = function(resource, callerId, external=false) {
    var head  = document.getElementsByTagName('head')[0];
    var link  = document.createElement('link');
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = (external) ? resource : `components/${callerId}/${resource}`;
    link.media = 'all';
    head.appendChild(link);
}