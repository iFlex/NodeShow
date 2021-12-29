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

function updateLink(container, link, from, fromPos, to, toPos) {
    let leftPos = computeAbsoluteLinkPosition(container, from, fromPos)
    let rightPos = computeAbsoluteLinkPosition(container, to, toPos)

    let angle = calculateLinkAngle(leftPos, rightPos)

    container.setPosition(link, leftPos)
    container.setAngle(link, angle + "rad", "0%", "0%")
    container.setWidth(link, calculateDistance(leftPos, rightPos))
    container.setHeight(link, 5)
}

function createLinkUnit(container) {
    return container.createFromSerializable(null, {
        "nodeName": "div",
        permissions: {
            "container.setParent": {
                "*": false
            },
            "container.create": { //prevent other apps from adding children to this 
                "*": false
            }
        },
        computedStyle: {
            "height": 5,
            "width": 10,
            "background-color": "black",
            "position": "absolute"
        }
    })
}

export function draw(container, descriptor) {
    let linkUnits = []
    if (descriptor.linkUnits.length == 0) {
        linkUnits.push(createLinkUnit(container))
    } else {
        linkUnits.push(container.lookup(descriptor.linkUnits[0]))
    }
    
    let link = linkUnits[0]
    let from = container.lookup(descriptor.from)
    let to = container.lookup(descriptor.to)

    updateLink(container, link, from, descriptor.fromPos, to, descriptor.toPos)
    return linkUnits
}