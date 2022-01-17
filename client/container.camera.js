import {Container, ACTIONS} from "./Container.js"


Container.prototype.getCamera = function(camId) {
	return this.getMetadata(camId, 'camera')
}

Container.prototype.registerCamera = function(node, camera, callerId) {
	if (node === this.parent || node === document.documentElement) {
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

//[TODO]: clearly define options and parameters and standardise
/*
options: {
	speed: duration in seconds
	targetOriginX:, 
	targetOriginY:,
	camOriginX:,
	camOriginY:,
	function: transition method name
}
*/
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

	focusOn(id, options = {}) {
		let pos = this.#container.getPosition(id)
		pos.left += this.#container.getWidth(id) * (options.targetOriginX || 0.5)
		pos.top += this.#container.getHeight(id) * (options.targetOriginY || 0.5)

		let viewPortTop = this.#camNode.scrollTop
		let viewPortLeft = this.#camNode.scrollLeft

		this.setPosition(pos.left, pos.top, options)
	}

	pan() {

	}

	move(dx, dy, options = {speed:0}) {
		$(this.#camNode).animate({
			scrollTop: this.#camNode.scrollTop + dy,
			scrollLeft: this.#camNode.scrollLeft + dx
		}, options.speed)
	}

	setPosition(x, y, options = {speed:0}) {
		let viewPortW = this.#container.getWidth(this.#camNode)
		let viewPortH = this.#container.getHeight(this.#camNode)
		
		$(this.#camNode).animate({
			scrollTop: y - (viewPortH * (options.camOriginY || 0.5)),
			scrollLeft: x - (viewPortW * (options.camOriginX || 0.5))
		}, options.speed)
	}

	zoom(level, options = {speed:0}) {
		this.#camNode.style.transform = `scale(${level})`
		this.#camNode.style.transformOrigin = `${options.ox || "50%"} ${options.oy || "50%"}`
		this.#camNode.style.transitionDuration = `${options.speed}s`
		this.#camNode.style.transitionFunction= options.function || 'linear'
	}

	getPosition() {
		return {
			top:this.#camNode.scrollTop,
			left:this.#camNode.scrollLeft
		}
	}
}
