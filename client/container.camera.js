import {Container, ACTIONS} from "./Container.js"


Container.prototype.getCamera = function(camId) {
	return this.getMetadata(camId, 'camera')
}

Container.prototype.registerCamera = function(node, camera, callerId) {
	if (node === this.parent) {
		this.camera = camera
	}

	let camdetails = camera.toString()
	this.setMetadata(node.id, 'camera', camdetails)
	node.dataset.camera = JSON.stringify(camdetails)
}

Container.prototype.makeCamera = function(id, options, callerId) {
	let node = this.lookup(id || this.parent)
	let camera = new Camera(this, node, options);
	this.registerCamera(node, camera, callerId)
	return camera
}

Container.registerPostSetterHook('create', function(parentId, node) {
	if (node.dataset.camera) {
		this.makeCamera(node, JSON.parse(node.dataset.camera))
	}
})

export class Camera {
	#container = null
	#camNode = null
	#options = null

	constructor(container, camNode, options) {
		this.#container = container
		this.#camNode = camNode
		this.#options = options
	}

	toString() {
		return JSON.stringify(this.#options)
	}

	focusOn(id, options) {
		let pos = this.#container.getPosition(id)
		//pos.left += this.#container.getWidth(node) * 0.5
		//pos.top += this.#container.getHeight(node) * 0.5

		let viewPortTop = this.#camNode.scrollTop
		let viewPortLeft = this.#camNode.scrollLeft

		this.setPosition(pos.left, pos.top, options)
	}

	pan() {

	}

	move(dx, dy) {
		this.#camNode.scrollTop += dy
		this.#camNode.scrollLeft += dx
	}

	setPosition(x, y, options) {
		if(!options) {
			options = {speed:0}
		}
		console.log(this.#camNode)
		this.#camNode.scrollTop = x
		this.#camNode.scrollLeft = y
	}

	zoom(level, ox, oy, speed) {
		// $(this.#camNode).animate({
		// 	scaleX:level,
		// 	scaleY:level,
		// 	transformOrigin:((ox*100)+"% "+(oy*100)+"%")
		// }, speed)
		this.#camNode.style.transform = `scale(${level})`
	}

	getPosition() {
		return {
			top:this.#camNode.scrollTop,
			left:this.#camNode.scrollLeft
		}
	}
}
