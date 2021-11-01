class ContainerStyler {
	appId = 'container.edit.style'
	container = null;
	
	constructor (container) {
		this.container = container;
		container.registerComponent(this.appId, this);
	}
}

let cstyler = new ContainerStyler(container);
cstyler.enable()