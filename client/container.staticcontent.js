import {Container} from "./Container.js"

//ToDo: tidy
Container.prototype.loadHtml = function(node, resource, callerId, emit) {
    let url = `components/${callerId}/${resource}`;
    if (!callerId) {
        url = resource
    }

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
        node.innerHTML = text;
        this.index(node, emit)
    })
    .catch(err => {
        console.error(`Failed to fetch html fragment from ${resource}`)
        console.error(err)
    })
}

Container.prototype.loadStyle = function(resource, callerId) {
    var head  = document.getElementsByTagName('head')[0];
    var link  = document.createElement('link');
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = `components/${callerId}/${resource}`;
    link.media = 'all';
    head.appendChild(link);
}