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
		
	    document.addEventListener('container.edit.pos.selected', e => this.target = this.container.lookup(e.detail.id));
		document.addEventListener('container.edit.pos.unselected', (e) => this.target = null);
	}

	disable() {
		document.addRemoveListener('keydown',(e) => this.keyDown(e))
		document.addRemoveListener('keyup',(e) => this.keyUp(e))

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

	create () {
		console.log("Creating child");
		if (!this.target) {
			this.target = this.container.parent
		}
		//clone last child
		let lastChild = this.target.lastChild;
		if (lastChild && lastChild.nodeName != '#text') {
			console.log("Last child")
			console.log(lastChild)
			let newNode = lastChild.cloneNode();
			this.container.addDomChild(this.target.id, newNode)
		} else {
			console.log("No children");
			let div = {
				"nodeName":"div",
				"computedStyle":{
					'width':'35%',
					'height':'35%',
					'margin': '5px',
					'padding': '5px',
					'background-color':'grey'}
			}
			this.container.createFromSerializable(this.target.id, div)
		}
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