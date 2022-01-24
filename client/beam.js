import { ACTIONS, Container } from "./Container.js"
import { container, bridge } from "./nodeshow.js";
import { httpReq } from "./components/utils/http.js"

let rootId = Container.getQueryVariable("rid")
function stream() {
    try {
        bridge.beam(true, rootId)
    } catch (e) {
        console.log('Could not beam, encountered exceptin. Retrying later...');
        console.error(e);
        setTimeout(stream, 250);
    }
}

function bulkSend() {
    let result = []
    let queue = [container.parent]
    let index = 0;
    var count = 0;
    const snapshot = true;
    var faliures = 0;

    do {
        let item = queue[index]
        let parentId = rootId;
        if (item != container.parent && item.parentNode != container.parent) {
            parentId = item.parentNode.id;
        }

        if (item.id) {
            let raw = container.toSerializable(item.id, snapshot);

            let jsndata = {
                presentationId: container.presentationId,
                //sessionId: this.sessionId,
                event: ACTIONS.create,
                detail: {
                    parentId: parentId,
                    descriptor:raw
                }
            }
            result.push(jsndata)
        }

        if (item.children) {
            for (const child of item.children) {
                queue.push(child)
            }
        }

        index ++;
    } while(index < queue.length)

    console.log(`Queuedy up ${result.length} nodes for update`)
    let data = JSON.stringify(result)
    console.log(`Size:${data.length}B`)
    httpReq('PATCH','/bulk','application/json',data, (e) => {
        console.log('SUCCESS');
    }, (e) => {
        console.log('FAILURE');
    })
}

stream();