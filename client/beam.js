import { ACTIONS } from "./Container.js"
import { container } from "./nodeshow.js";
import { httpReq } from "./components/utils/http.js"

let result = []
let queue = [container.parent]
let index = 0;
var count = 0;
const snapshot = true;
var faliures = 0;

do {
    let item = queue[index]
    let parentId = null;
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

console.log(`QueuedyRYqX up ${result.length} nodes for update`)
let data = JSON.stringify(result)
console.log(`Size:${data.length}B`)
httpReq('PATCH','/bulk','application/json',data, (e) => {
    console.log('SUCCESS');
}, (e) => {
    console.log('FAILURE');
})