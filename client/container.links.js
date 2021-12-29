/**
 * Container Framework Functionality for linking containers, it draws & redraws links as containers are being manipulated.
 * Currently supports only straight line links & links that avoid siblings
 
Link Descriptor: {
	"id": "link_id"
	"from": "container_id_1",
	"to": "container_id_2",
	"linkUnits": [node1, node2, node3], //list of DOM elements forming the link
	"fromPos": {
		percentX: px, //at what % of the width to place the link [0 - 1]
        percentY: py, //at what % of the height to place the link [0 - 1]
    },
	"toPos": {
		percentX: px,
        percentY: py
	}
	"drawer": "name_of_draw_method"
	"data":{} || [], //extra information about the link
}

Persist:
On first LinkUnit of Descriptor
data-link = Stringified descriptor
data-linkId = link_id

In Memory Storage:
 stored within the container.links.js component
*/ 

//[TODO]
import {Container} from "./Container.js"

Container.prototype.links = {}
Container.prototype.linkWatch = {} //Map of sets
Container.prototype.linkDrawers = {}

Container.prototype.addLinkDrawer = function(id, method) {
	//[TODO]: check method is function
	this.linkDrawers[id] = method
}

Container.prototype.createLink = function(from, to, descriptor, callerId) {
	let fromNode = this.lookup(from)
	let toNode = this.lookup(to)
	this.isOperationAllowed('container.link', fromNode, callerId)
	this.isOperationAllowed('container.link', toNode, callerId)
	
	const linkId = Container.generateUUID()

	descriptor = Container.clone(descriptor)
	descriptor.from = fromNode.id
	descriptor.to = toNode.id
	descriptor.linkId = linkId
	descriptor.linkUnits = []

	//draw link
	console.log(this.linkDrawers)
	let nodelist = this.linkDrawers[descriptor.drawer].apply(this, [this, descriptor])
	
	//persist
	for (let linkUnit of nodelist) {
		linkUnit.dataset.linkId = linkId
		descriptor.linkUnits.push(linkUnit.id)
	}
	nodelist[0].dataset.link = JSON.stringify(descriptor)
	
	this.links[linkId] = descriptor
	//this.linkWatch[fromNode.id] = linkId
	//this.linkWatch[to.id] = linkId

	return linkId
}

Container.prototype.deleteLink = function(linkId, callerId) {
	const descriptor = this.links[linkId]
	for (const linkUnitId of descriptor.linkUnits) {
		try {
			this.delete(this.lookup(linkUnitId), callerId)
		} catch (e) {
			console.error(`[CORE_LINKING]: failed to delete link ${linkId} component ${linkUnitId}`)
			console.error(e)			
		}
	}
	
	delete this.links[linkId]
	//delete this.linkWatch[descriptor.from]
	//delete this.linkWatch[descriptor.to]
}

//TODO: maintain links
//TODO: detect deletes and delete entire link