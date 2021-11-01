class ContainerSizeNRotate {
	appId = 'container.edit.size.n.rotation'
	container = null;
	
	constructor (container) {
		this.container = container;
		container.registerComponent(this.appId, this);
	}
}

let csizerot = new ContainerSizeNRotate(container);
csizerot.enable()