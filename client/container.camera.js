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
		pos.left += this.#container.getWidth(id) * 0.5
		pos.top += this.#container.getHeight(id) * 0.5

		let viewPortTop = this.#camNode.scrollTop
		let viewPortLeft = this.#camNode.scrollLeft

		this.setPosition(pos.left, pos.top, options)
	}

	pan() {

	}

	move(dx, dy, options) {
		if(!options) {
			options = {speed:0}
		}

		$(this.#camNode).animate({
			scrollTop: this.#camNode.scrollTop + dy,
			scrollLeft: this.#camNode.scrollLeft + dx
		}, options.speed)
	}

	setPosition(x, y, options) {
		if(!options) {
			options = {speed:0}
		}

		let viewPortW = this.#container.getWidth(this.#camNode)
		let viewPortH = this.#container.getHeight(this.#camNode)
		
		//this.#camNode.scrollTop = x - viewPortW/2
		//this.#camNode.scrollLeft = y - viewPortH/2
		$(this.#camNode).animate({
			scrollTop: y - viewPortH/2,
			scrollLeft: x - viewPortW/2
		}, options.speed)
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
