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

Container.prototype.createLink = function(form, to, descriptor, callerId) {
	let fromNode = this.lookup(from)
	let toNode = this.lookup(to)
	this.isOperationAllowed('container.link', fromNode, callerId)
	this.isOperationAllowed('container.link', toNode, callerId)
	//generate id
	//draw
	//persist in dataset
}

Container.prototype.deleteLink = function(linkId, callerId) {
	//lookup link
	//clear from persist
	//delete
}