class ContainerCreator {
	appId = 'container.create'
	container = null;
	target = null;
	#control = false;

	constructor (container) {
		this.container = container;
		container.registerComponent(this.appId, this);
	}

	enable() {
		document.addEventListener('keydown',(e) => this.keyDown(e))
		document.addEventListener('keyup',(e) => this.keyUp(e))
		document.addEventListener('dblclick',(e) => this.onClick(e))
		
	    document.addEventListener('container.edit.pos.selected', e => this.target = this.container.lookup(e.detail.id));
		document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);
	}

	disable() {
		document.removeEventListener('keydown',(e) => this.keyDown(e))
		document.removeEventListener('keyup',(e) => this.keyUp(e))
		document.removeEventListener('dblclick',(e) => this.onClick(e))

		document.removeEventListener('container.edit.pos.selected', e => this.target = this.container.lookup(e.detail.id));
		document.removeEventListener('container.edit.pos.unselected', (e) => this.target = null);
	}

	delete () {
		console.log("Deleting current target");
		console.log(this.target);

		if(this.target) {
			this.container.delete(this.target.id);
		}
		this.target = null;
	}

	create (x, y) {
		console.log("Creating child");
		if (!this.target) {
			this.target = this.container.parent
		}
		
		console.log("No children");
		let div = {
			"nodeName":"div",
			"computedStyle":{
				'width':'150px',
				'height':'150px',
				'margin': '5px',
				'padding': '5px',
				'background-color':'grey'}
		}
			 
			
		let node = this.container.createFromSerializable(this.target.id, div)
		if (x != undefined && y!= undefined) {
			this.container.setPosition(node.id, {top:y, left:x})
		}
	}

	onClick(e) {
		this.create(e.pageX, e.pageY)
	}

	keyDown(e) {
		if(e.key == 'Control') {
			this.#control = true;
		}
		if (e.key == 'Delete') {
			this.delete();
		}
	}

	keyUp(e) {
		if(e.key == 'Control') {
			this.#control = false;
		}
		if (e.key == 'Insert' && this.#control) {
			this.create();
		}
	}
}

let ccreator = new ContainerCreator(container);
ccreator.enable()