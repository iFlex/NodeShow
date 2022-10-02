function calculateDistance(leftPos, rightPos) {
    let deltaX = leftPos.left - rightPos.left
    let deltaY = leftPos.top - rightPos.top

    return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
}

function calculateLinkAngle(leftPos, rightPos) {
    let deltaX = rightPos.left - leftPos.left
    let deltaY = rightPos.top - leftPos.top
    return Math.atan2(deltaY, deltaX);
}

function computeAbsoluteLinkPosition(container, target, targetPos) {
    let pos = container.getPosition(target)
    pos.top += container.getHeight(target) * targetPos.percentY
    pos.left += container.getWidth(target) * targetPos.percentX

    return pos
}

function updateLink(container, link, from, fromPos, to, toPos, callerId) {
    let leftPos = computeAbsoluteLinkPosition(container, from, fromPos)
    let rightPos = computeAbsoluteLinkPosition(container, to, toPos)
    //This creates an event loop - investigate...
    // let a = container.createFromSerializable(null, {
    //     "nodeName": "div",
    //     data:{
    //         containerPermissions: {
    //             "container.setParent": {"*": false},
    //             "container.create": {"*": false} //prevent other apps from adding children to this 
    //         }
    //     },
    //     computedStyle: {
    //         "height": 5,
    //         "width": 5,
    //         "background-color": "green",
    //         "position": "absolute"
    //     }
    // }, null, callerId)
    // let b = container.createFromSerializable(null, {
    //     "nodeName": "div",
    //     data:{
    //         containerPermissions: {
    //             "container.setParent": {"*": false},
    //             "container.create": {"*": false} //prevent other apps from adding children to this 
    //         }
    //     },
    //     computedStyle: {
    //         "height": 5,
    //         "width": 5,
    //         "background-color": "green",
    //         "position": "absolute"
    //     }
    // }, null, callerId)
    // container.setPosition(a, leftPos, callerId)
    // container.setPosition(b, rightPos, callerId)

    let angle = calculateLinkAngle(leftPos, rightPos)

    container.setPosition(link, leftPos, callerId)
    container.setAngle(link, angle + "rad", "0%", "0%", callerId)
    container.setWidth(link, calculateDistance(leftPos, rightPos), callerId)
    container.setHeight(link, 5, callerId)
}

function createLinkUnit(container, callerId) {
    return container.createFromSerializable(null, {
        "nodeName": "div",
        data:{
            containerPermissions: {
                "container.setParent": {"*": false},
                "container.create": {"*": false} //prevent other apps from adding children to this 
            }
        },
        computedStyle: {
            "height": 5,
            "width": 10,
            "background-color": "black",
            "position": "absolute"
        }
    }, null, callerId)
}

export function draw(container, descriptor, callerId) {
    let linkUnits = []
    if (descriptor.linkUnits.length == 0) {
        linkUnits.push(createLinkUnit(container, callerId))
    } else {
        linkUnits.push(container.lookup(descriptor.linkUnits[0]))
    }
    
    let link = linkUnits[0]
    let from = container.lookup(descriptor.from)
    let to = container.lookup(descriptor.to)

    updateLink(container, link, from, descriptor.fromPos, to, descriptor.toPos, callerId)
    return linkUnits
}