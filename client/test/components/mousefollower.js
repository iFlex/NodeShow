import { Mouse } from '../../components/utils/mouse.js'

export class TestMouseFollower {
	appId = "test.mouse.follower"
	#container = null;
	#enabled = false
	#brick = null;

	constructor (container) {
		this.#container = container;
		container.registerComponent(this);	
		document.addEventListener('mousemove', (e) => this.mouseMoved(e));
		document.addEventListener('mousedown', (e) => this.printInfo(e));
		
		this.#brick = container.createFromSerializable(null, {
			"nodeName":"DIV",
			"computedStyle":{
				"position":"absolute",
				"top":"0px",
				"left":"0px",
				"width":"128px",
				"height":"128px",
				"background-color":"black"
			}
		}, null, this.appId)
	}

	enable () {
		if (!this.#enabled) {
			this.#enabled = true
		}
	}

	disable () {
		if (this.#enabled) {
			this.#enabled = false
		}
	}

	isEnabled () {
		return this.#enabled
	}

	mouseMoved(e) {
		//this.#container.setPosition(this.#brick, {top:e.pageY,left:e.pageX}, this.appId)
		let pos = this.#container.camera.viewPortToSurface(e.pageX, e.pageY)
		this.#container.setPosition(this.#brick, {top:pos.y,left:pos.x}, this.appId)
		console.log(`x:${e.pageX} y:${e.pageY} tx: ${pos.x} ty:${pos.y}`)
	}

	printInfo(e) {
		console.log(`w:${this.#container.getWidth(this.#container.camera.getSurface())} h:${this.#container.getHeight(this.#container.camera.getSurface())}`)
		let rect = this.#container.camera.getSurface().getBoundingClientRect();
		console.log(rect)
		let newpos = prompt('x,y')
		let bits = newpos.split(',')
		let x = parseInt(bits[0])
		let y = parseInt(bits[1])

		this.#container.setPosition(this.#brick, {top:y, left:x}, this.appId)
	}

}