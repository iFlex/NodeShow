//EXPERIMENTAL
import { ACTIONS, Container } from "./Container.js"
import { container } from "./nodeengine.js";
import { httpReq } from "./components/utils/http.js"

let rootId = Container.getQueryVariable("rid")
function stream() {
    try {
        bridge.beam(false, rootId)
    } catch (e) {
        console.log('Could not beam, encountered exception. Retrying later...');
        console.error(e);
        setTimeout(stream, 250);
    }
}

function bulkSend() {
    console.log("About to lookup all this shit")
    let nodes = container.getSerialisedDescendents(null, true, true);
    let jsndata = {
        presentationId: container.presentationId,
        insertRootId: rootId,
        nodes: nodes,
        //html: document.body.innerHTML
        url: window.location.pathname
    }

    console.log(`Sending ${nodes.length} nodes for update`)
    let data = JSON.stringify(jsndata)
    console.log(`Size:${data.length}B`)
    httpReq('PATCH','/bulk','application/json',data, (e) => {
        console.log('SUCCESS');
    }, (e) => {
        console.error('FAILURE',e);
    })
}

//stream();
setTimeout(bulkSend, 10000)